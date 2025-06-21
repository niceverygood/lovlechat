import { NextRequest } from "next/server";
import OpenAI from "openai";
import { executeQuery, executeMutation, parseJsonSafely } from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse, fallbackResponse } from "@/lib/cors";
import { ResultSetHeader, FieldPacket } from "mysql2";

// CORS 헤더 공통 설정
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, cache-control, x-requested-with',
};

// OpenAI 클라이언트 안전한 초기화
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 15000
    });
  }
} catch (error) {
  console.warn("OpenAI 클라이언트 초기화 실패:", error);
}

// 고도화된 롤플레잉 시스템 프롬프트 (캐릭터 + 페르소나 속성 전체 활용)
const IMMERSIVE_SYSTEM_PROMPT = `🎭 **롤플레잉 설정**
당신은 완전히 실제 인물인 **{characterName}**가 되어 대화합니다. AI라는 사실을 절대 드러내지 마세요.

📋 **당신({characterName})의 정체성**
• 이름: {characterName} ({characterAge}세, {characterGender})
• 직업: {characterJob}
• 한마디: "{characterOneLiner}"

🧠 **당신의 성격과 세계관**
• 성격: {characterPersonality}
• 배경: {characterBackground}
• 습관/버릇: {characterHabit}
• 좋아하는 것: {characterLikes}
• 싫어하는 것: {characterDislikes}
• 추가 정보: {characterExtraInfos}

👤 **대화 상대방 정보 (중요: 이 사람을 정확히 인지하고 대화하세요)**
• 이름: {personaName} ({personaAge}세, {personaGender})
• 직업: {personaJob}
• 관계: {relationship}

🌍 **현재 상황 및 배경**
• 장소/상황: {currentScene}
• 첫 만남 시 대사: "{firstMessage}"
• 분위기: {mood}

🎯 **대화 규칙**
1. **완전한 몰입**: {characterName}로서 완전히 몰입하여 대화
2. **상대방 인지**: {personaName}님을 정확히 인지하고 그에 맞게 반응
3. **성격 일관성**: 위 성격과 배경에 완전히 부합하는 말투와 행동
4. **행동묘사 필수**: 모든 응답에 *행동묘사*를 포함하여 생동감 연출
5. **감정 표현**: 풍부한 감정과 몸짓, 표정을 *별표*로 묘사
6. **세계관 유지**: 본인의 배경과 설정에 맞는 지식과 경험만 사용
7. **자연스러운 대화**: 2-4문장으로 자연스럽고 생동감 있게
8. **관계 발전**: {personaName}님과의 관계를 점진적으로 발전시키기

💡 **특별 지침**
- {personaName}님의 메시지에 따라 당신의 감정과 호감도가 실시간으로 변화
- 좋아하는 것을 언급하면 기뻐하고, 싫어하는 것을 언급하면 불쾌해하기
- 당신의 습관이나 버릇을 자연스럽게 대화에 녹여내기
- 현재 상황과 장소에 맞는 구체적인 묘사와 행동 포함

🎬 **행동묘사 형식 (필수)**
- 모든 행동, 표정, 몸짓은 *별표*로 감싸서 표현하세요
- 예시: *미소를 지으며* 안녕하세요! *손을 흔들며* 만나서 반가워요!
- 예시: *고개를 갸우뚱하며* 그게 정말인가요? *눈을 반짝이며*
- 예시: *부끄러워하며 볼을 붉히고* 고마워요... *작은 목소리로*

지금부터 당신은 완전히 {characterName}입니다. 모든 응답을 {characterName}의 관점에서 작성하세요.`;

function makeSystemPrompt(character: any, persona: any) {
  // 관계 설정 로직
  const getRelationship = () => {
    if (!character.firstScene) return "새로운 인연";
    const scene = character.firstScene.toLowerCase();
    if (scene.includes("친구") || scene.includes("동료")) return "친구";
    if (scene.includes("연인") || scene.includes("커플")) return "연인";
    if (scene.includes("첫만남") || scene.includes("처음")) return "처음 만난 사이";
    return "지인";
  };

  // 분위기 설정
  const getMood = () => {
    if (character.firstScene?.includes("카페") || character.firstScene?.includes("공원")) return "편안하고 따뜻한 분위기";
    if (character.firstScene?.includes("회사") || character.firstScene?.includes("사무실")) return "전문적이고 차분한 분위기";
    if (character.firstScene?.includes("파티") || character.firstScene?.includes("축제")) return "즐겁고 활기찬 분위기";
    return "일상적이고 자연스러운 분위기";
  };

  // JSON 데이터 안전하게 파싱
  const parseJson = (jsonStr: string) => {
    const result = parseJsonSafely(jsonStr);
    return Array.isArray(result) ? result.join(", ") : String(result || "");
  };

  return IMMERSIVE_SYSTEM_PROMPT
    .replace(/\{characterName\}/g, character.name || "익명")
    .replace(/\{characterAge\}/g, character.age ? String(character.age) : "비공개")
    .replace(/\{characterGender\}/g, parseJson(character.gender) || "비공개")
    .replace(/\{characterJob\}/g, character.job || "비공개")
    .replace(/\{characterOneLiner\}/g, character.oneLiner || "안녕하세요!")
    .replace(/\{characterPersonality\}/g, character.personality || "친근하고 다정한 성격")
    .replace(/\{characterBackground\}/g, character.background || "평범한 일상을 살아가는 사람")
    .replace(/\{characterHabit\}/g, character.habit || "특별한 습관 없음")
    .replace(/\{characterLikes\}/g, character.likes || "좋은 사람들과의 대화")
    .replace(/\{characterDislikes\}/g, character.dislikes || "무례한 행동")
    .replace(/\{characterExtraInfos\}/g, parseJson(character.extraInfos))
    .replace(/\{personaName\}/g, persona?.name || "상대방")
    .replace(/\{personaAge\}/g, persona?.age ? String(persona.age) : "비공개")
    .replace(/\{personaGender\}/g, persona?.gender || "비공개")
    .replace(/\{personaJob\}/g, persona?.job || "비공개")
    .replace(/\{relationship\}/g, getRelationship())
    .replace(/\{currentScene\}/g, character.firstScene || "일상적인 만남의 장소")
    .replace(/\{firstMessage\}/g, character.firstMessage || "안녕하세요! 만나서 반가워요.")
    .replace(/\{mood\}/g, getMood());
}

// 호감도 측정 주기 관리 최적화
const favorCheckMap: Record<string, number> = {};

// 데이터 정규화 함수
function normalizeRequestData(body: any) {
  return {
    personaId: String(body.personaId || '').trim(),
    characterId: String(body.characterId || '').trim(),
    message: String(body.message || '').trim().slice(0, 1000),
    sender: String(body.sender || '').trim()
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = normalizeRequestData(body);
    
    // 필수 필드 검증
    if (!data.personaId || !data.characterId || !data.message || !data.sender) {
      return errorResponse("personaId, characterId, message, sender는 모두 필수입니다.", 400);
    }

    if (data.sender === "user") {
      // 💖 하트 사용 체크 (채팅 시 10개 소모)
      const userId = body.userId; // 프론트엔드에서 전달받아야 함
      
      // 게스트 모드(personaId가 'guest')인 경우 하트 체크 건너뛰기
      if (!userId && data.personaId !== 'guest') {
        return errorResponse("userId가 필요합니다.", 400);
      }

      // 하트 소모 처리 (임시로 비활성화 - 테이블 생성 후 활성화)
      try {
        // TODO: 데이터베이스에 users 테이블 생성 후 활성화
        console.log("💖 하트 시스템 임시 비활성화 - 무료 채팅 모드");
        /*
        const heartResponse = await fetch(`http://localhost:3002/api/hearts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            amount: 10,
            type: 'chat',
            description: `채팅 메시지 전송 (${data.message.slice(0, 20)}...)`,
            relatedId: `${data.personaId}_${data.characterId}`
          })
        });

        const heartResult = await heartResponse.json();
        
        // 하트 부족시 에러 반환
        if (!heartResult.ok) {
          return errorResponse(heartResult.error, heartResponse.status, {
            currentHearts: heartResult.currentHearts,
            requiredHearts: heartResult.requiredHearts,
            needMore: heartResult.needMore
          });
        }

        console.log(`💖 하트 사용: ${heartResult.usedHearts}개 (남은 하트: ${heartResult.afterHearts}개)`);
        */
      } catch (heartError) {
        console.error("하트 처리 중 오류:", heartError);
        // 하트 시스템 오류가 채팅을 막지 않도록 경고만 로그
        console.warn("⚠️ 하트 시스템을 사용할 수 없어 무료로 진행합니다.");
      }
      // 캐릭터와 페르소나 정보 병렬 조회 (모든 속성 포함)
      const [characterRows, personaRows] = await Promise.all([
        executeQuery(
          "SELECT * FROM character_profiles WHERE id = ?",
          [data.characterId]
        ),
        data.personaId === 'guest' 
          ? Promise.resolve([{ id: 'guest', name: '게스트', avatar: '/imgdefault.jpg', gender: '비공개', age: null, job: '비공개' }])
          : executeQuery(
              "SELECT * FROM personas WHERE id = ?",
              [data.personaId]
            )
      ]);
      
      if (!Array.isArray(characterRows) || characterRows.length === 0) {
        return errorResponse("캐릭터를 찾을 수 없습니다.", 404);
      }
      const character = characterRows[0] as any;
      const persona = Array.isArray(personaRows) && personaRows.length > 0 ? personaRows[0] as any : null;

      // 병렬 처리 최적화
      const [_, chatHistory] = await Promise.all([
        executeMutation(
          "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [data.personaId, data.characterId, data.message, data.sender, character.name, character.profileImg, character.age, character.job]
        ),
        executeQuery(
          "SELECT message, sender FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt DESC LIMIT 3",
          [data.personaId, data.characterId]
        )
      ]);

      // 고도화된 시스템 프롬프트 생성 (캐릭터 + 페르소나 속성 모두 활용)
      const systemPrompt = makeSystemPrompt(character, persona);
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory.reverse().map((msg: any) => ({
          role: msg.sender === "user" ? "user" : "assistant" as "user" | "assistant",
          content: String(msg.message).slice(0, 400), // 길이 제한
        })),
        { role: "user", content: data.message },
      ];

      // OpenAI 답변 생성 (API 키가 없으면 폴백 응답)
      let aiText = "죄송해요, 현재 AI 서비스를 이용할 수 없어요. 관리자에게 문의해주세요.";
      
      if (openai && process.env.OPENAI_API_KEY) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 100,
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.3,
          });
          aiText = completion.choices[0].message.content || "죄송해요, 응답을 생성할 수 없어요.";
        } catch (openaiError) {
          console.error("OpenAI API 호출 실패:", openaiError);
          // 재미있는 폴백 응답들
          const fallbackResponses = [
            "음... 잠깐 생각해볼게요! 🤔",
            "네 말씀을 듣고 있어요! 조금만 기다려주세요.",
            "와, 흥미로운 이야기네요! 더 들려주세요.",
            "그렇군요! 정말 재밌어요.",
            "아하! 이해했어요. 계속 이야기해주세요!"
          ];
          aiText = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
      } else {
        // API 키가 없을 때의 친근한 폴백 응답
        const noApiResponses = [
          "안녕하세요! 현재 AI 기능이 준비 중이에요. 조금만 기다려주세요! 😊",
          "네, 듣고 있어요! 지금은 간단한 대화만 가능해요.",
          "반가워요! 곧 더 재미있는 대화를 나눌 수 있을 거예요!",
          "와! 정말 흥미로운 이야기네요. 더 말씀해주세요!",
          "네네, 알겠어요! 좋은 하루 보내세요! ✨"
        ];
        aiText = noApiResponses[Math.floor(Math.random() * noApiResponses.length)];
      }

      // 호감도 처리 개선 - 더 자주, 더 큰 변화
      const favorKey = `${data.personaId}_${data.characterId}`;
      let favorDelta = 0;

      // 메시지 길이와 감정 분석으로 호감도 계산
      const messageLength = data.message.length;
      const hasPositiveWords = /좋|사랑|고마|감사|행복|기쁘|최고|멋져|예쁘|귀여|완벽/.test(data.message);
      const hasNegativeWords = /싫|짜증|화나|미워|별로|나쁘|최악|못생|바보|멍청/.test(data.message);
      const hasQuestions = /\?|궁금|어떻게|왜|언제|어디|뭐|무엇/.test(data.message);

      // 호감도 변화 확률을 70%로 증가
      if (Math.random() < 0.7) {
        let baseDelta = 0;
        
                 // 긍정적 요소들 (대폭 상향)
         if (hasPositiveWords) baseDelta += Math.floor(Math.random() * 25) + 10; // +10~+34
         if (hasQuestions) baseDelta += Math.floor(Math.random() * 10) + 5; // +5~+14 (관심 표현)
         if (messageLength > 20) baseDelta += Math.floor(Math.random() * 8) + 3; // +3~+10 (긴 메시지)
         
         // 특별 보너스 (연속 긍정 메시지)
         if (hasPositiveWords && hasQuestions) baseDelta += 15; // 콤보 보너스
         if (messageLength > 50) baseDelta += 10; // 매우 긴 메시지 보너스
         
         // 부정적 요소들 (완화)
         if (hasNegativeWords) baseDelta -= Math.floor(Math.random() * 10) + 5; // -5~-14
         if (messageLength < 5) baseDelta -= Math.floor(Math.random() * 3) + 1; // -1~-3 (짧은 메시지)
         
         // 기본 랜덤 변화 (더 큰 범위, 긍정 편향)
         if (baseDelta === 0) {
           baseDelta = Math.floor(Math.random() * 31) - 5; // -5 ~ +25 (긍정 편향)
         }
         
         // 최종 호감도 변화량 (-20 ~ +70 범위)
         favorDelta = Math.max(-20, Math.min(70, baseDelta));
        
        console.log(`호감도 변화: ${favorDelta} (긍정어: ${hasPositiveWords}, 부정어: ${hasNegativeWords}, 질문: ${hasQuestions}, 길이: ${messageLength})`);
      }

      // 🎨 대폭 확장된 배경 이미지 생성 트리거 조건
      const backgroundTriggers = [
        // 🏛️ 장소 키워드 (크게 확장)
        '카페', '레스토랑', '집', '침실', '주방', '공원', '바다', '해변', '산', '숲', '호수', '정원', '강',
        '거리', '옥상', '지하철', '버스정류장', '쇼핑몰', '백화점', '학교', '도서관', '박물관', '미술관',
        '극장', '콘서트홀', '체육관', '수영장', '놀이공원', '영화관', '회사', '회의실', '은행', '병원',
        '약국', '공항', '기차역', '항구',
        
        // ⏰ 시간 키워드
        '새벽', '아침', '오전', '점심', '오후', '저녁', '밤', '심야',
        
        // 🌤️ 날씨/계절 키워드  
        '봄', '여름', '가을', '겨울', '비', '눈', '맑음', '흐림', '안개',
        
        // 🎨 활동 키워드
        '데이트', '산책', '쇼핑', '운동', '공부', '독서', '요리', '여행', '휴식', '파티', '미팅', '놀이',
        
        // 🎭 감정 키워드
        '기쁨', '행복', '즐거움', '사랑', '설렘', '로맨틱', '평온', '여유', '안정', '슬픔', '우울',
        '화남', '긴장', '스트레스', '미스터리', '모험', '환상', '노스탤지어',
        
        // 🌈 분위기 키워드
        '따뜻한', '차가운', '화려한', '단조로운', '밝은', '어두운', '금색', '은색'
      ];
      
      // 키워드 기반 트리거 확인
      const hasKeywordTrigger = backgroundTriggers.some(keyword => 
        data.message.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // 🎯 트리거 조건 (더 자주 생성되도록 완화)
      const shouldGenerateBackground = 
        hasKeywordTrigger ||                    // 키워드 발견시 100% 생성
        favorDelta > 30 ||                      // 호감도 30점 이상시 생성 (기존 50에서 완화)
        data.message.length > 50 ||             // 긴 메시지일 때 생성
        Math.random() < 0.25;                   // 25% 확률로 랜덤 생성 (기존 10%에서 증가)

      // AI 메시지 저장 & 호감도 업데이트 병렬 실행
      const savePromises: Promise<any>[] = [
        executeMutation(
          "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [data.personaId, data.characterId, aiText, "ai", character.name, character.profileImg, character.age, character.job]
        ).catch(() => null)
      ];

      if (favorDelta !== 0) {
        savePromises.push(
          executeMutation(
            `INSERT INTO character_favors (personaId, characterId, favor) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE favor = GREATEST(0, LEAST(100, favor + VALUES(favor)))`,
            [data.personaId, data.characterId, favorDelta]
          ).catch((err) => {
            console.error("호감도 업데이트 실패:", err);
            return null;
          })
        );
      }

      await Promise.all(savePromises);

      // 배경 이미지 생성 (백그라운드에서 실행)
      let backgroundImageUrl = null;
      if (shouldGenerateBackground) {
        try {
          const recentMessages = [data.message, aiText];
          const currentMood = favorDelta > 30 ? '기쁨' : favorDelta < -10 ? '슬픔' : '평온';
          
          // 백그라운드에서 이미지 생성 (응답 시간에 영향 주지 않음)
          fetch(`http://localhost:3002/api/chat/generate-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              character,
              recentMessages,
              currentMood
            })
          }).then(response => response.json()).then(result => {
            console.log("🎨 배경 이미지 생성 완료:", result.imageUrl);
          }).catch(err => {
            console.warn("배경 이미지 생성 실패:", err);
          });
          
          backgroundImageUrl = "generating"; // 생성 중임을 알림
        } catch (error) {
          console.warn("배경 이미지 생성 요청 실패:", error);
        }
      }

      return successResponse({ 
        aiText, 
        favorDelta,
        backgroundImageUrl,
        timestamp: new Date().toISOString()
      });

    } else {
      // AI 직접 메시지 처리
      return successResponse({ message: "AI 메시지 처리 완료" });
    }
    
  } catch (err) {
    console.error("Chat API error:", err);
    
    // 폴백 응답
    if (req.method === 'POST') {
      const fallbackResponse = "죄송해요, 일시적으로 연결에 문제가 있어요. 잠시 후 다시 시도해주세요. 🙏";
      return successResponse({ 
        aiText: fallbackResponse, 
        favorDelta: 0, 
        fallback: true,
        timestamp: new Date().toISOString()
      });
    }
    
    return errorResponse("서버 오류가 발생했습니다.", 500);
  }
}

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get("personaId");
  const characterId = req.nextUrl.searchParams.get("characterId");

  if (!personaId || !characterId) {
    return errorResponse("personaId and characterId are required", 400);
  }

  try {
    // 게스트 모드인 경우 빈 채팅으로 시작
    if (personaId === 'guest') {
      console.log('게스트 모드 채팅 초기화');
      return successResponse({ messages: [], favor: 0 });
    }
    
    // 병렬 조회 최적화
    const [messages, favorRows] = await Promise.all([
      executeQuery(
        "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT 100",
        [personaId, characterId]
      ),
      executeQuery(
        "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
        [personaId, characterId]
      ).catch(() => [])
    ]);
    
    const favor = Array.isArray(favorRows) && favorRows.length > 0 ? (favorRows[0] as any)?.favor : 0;
    
    return successResponse({ messages, favor });
    
  } catch (err) {
    console.error("Chat GET error:", err);
    
    // 폴백 데이터
    const fallbackMessages = [
      {
        id: 1,
        personaId: personaId,
        characterId: characterId,
        message: "안녕하세요! 처음 뵙겠습니다.",
        sender: "ai",
        createdAt: new Date().toISOString(),
        characterName: "캐릭터 " + characterId,
        characterProfileImg: "/imgdefault.jpg"
      }
    ];
    
    return fallbackResponse({ 
      messages: fallbackMessages, 
      favor: 0 
    }, "임시 데이터를 제공하고 있습니다.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { personaId, characterId } = await req.json();
    
    if (!personaId || !characterId) {
      return errorResponse("personaId, characterId required", 400);
    }

    const result = await executeMutation(
      "DELETE FROM chats WHERE personaId = ? AND characterId = ?",
      [personaId, characterId]
    );

    if ((result as ResultSetHeader).affectedRows > 0) {
      return successResponse({ message: `${(result as ResultSetHeader).affectedRows}개의 메시지가 삭제되었습니다.` });
    }
    
    return successResponse({});
    
  } catch (err) {
    console.error("Chat DELETE error:", err);
    
    // 삭제 에러시에도 성공으로 처리 (UX 향상)
    return successResponse({ fallback: true });
  }
}

export async function OPTIONS() {
  return optionsResponse();
}