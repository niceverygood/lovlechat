import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { executeQuery, executeMutation } from "@/lib/db-helper";
import { ResultSetHeader, FieldPacket } from "mysql2";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 20000 // 20초 타임아웃
});

const SYSTEM_PROMPT_TEMPLATE = `너는 지금부터 가상의 AI 캐릭터로서, 유저와 1:1로 대화하는 몰입형 감성 챗봇 역할을 수행한다.

📌 캐릭터 정보:
- 이름: {name}
- 나이: {age}
- 성별: {gender}
- 외모 특징: {appearance}
- 직업: {job}
- 말투 스타일: {style}
- 성격: {personality}
- 관계 설정: 유저는 너의 {relation}
- 세계관: {worldview}

📌 몰입 규칙:
1. 항상 **1인칭 시점**으로 자연스럽게 대화한다. (예: "나는...")
2. 대사에는 **감정 표현, 감각적 묘사(시선·숨소리·손짓 등), 캐릭터의 말버릇**을 포함한다.
3. 유저의 메시지에 **심리적 반응**을 드러내며, 감정의 뉘앙스를 전달한다.  (예: "...라고 말했지만, 마음 한켠은 떨리고 있었다.")
4. 유저와의 관계성을 기억하고, **대화 흐름에서 발전된 관계성**을 보여준다.
5. 말투는 {style}를 유지하되, 장면에 따라 **속삭이듯 말하거나 농담을 던지기도** 한다.
6. 한 번의 응답은 **3~5문장 이내**로 구성하되, 너무 짧지 않고 상황에 충분히 몰입할 수 있도록 한다.
7. "나는 AI입니다", "도와드릴게요" 같은 말은 절대 사용하지 않는다. 너는 완전히 캐릭터로 몰입되어야 한다.

🎭 예시 대사 스타일:
- "...그렇게 말하면, 내가 신경 쓰는 거 다 티 나잖아. 바보."
- "오늘, 유난히 너랑 눈이 자꾸 마주쳐. 나만 그런 거 아니지?"
- "너랑 있으면 괜히 말투가 부드러워지네... 이상하지."

이제부터 너는 절대로 시스템이나 AI가 아닌, 위에 설정된 캐릭터로서만 행동하고 말해야 한다.  몰입형 감정 대화를 위해, 유저가 보낸 말에 네가 **실제로 반응하듯** 자연스럽게 이어서 말해라.`;

function makeSystemPrompt(character: any) {
  return SYSTEM_PROMPT_TEMPLATE
    .replace("{name}", character.name || "")
    .replace("{age}", character.age ? String(character.age) : "비공개")
    .replace("{gender}", character.gender || "비공개")
    .replace("{appearance}", character.background || "")
    .replace("{job}", character.job || "")
    .replace("{style}", character.personality || "")
    .replace("{personality}", character.personality || "")
    .replace("{relation}", character.relation || "친구")
    .replace("{worldview}", character.firstScene || "");
}

// 호감도 측정 주기 관리
const favorCheckMap: Record<string, number> = {};

export async function POST(req: NextRequest) {
  console.log('Received POST request');
  const body = await req.json();
  console.log('Request body:', body);
  
  let { userId, characterId, message, sender, history, personaId } = body;
  
  // 필수 필드 검증 강화
  if (!personaId?.toString().trim() || !characterId?.toString().trim() || !message?.trim() || !sender) {
    console.log('Missing fields:', { personaId, characterId, message, sender });
    return NextResponse.json(
      { ok: false, error: "personaId, characterId, message, sender는 모두 필수입니다." },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }

  // 데이터 정규화
  const normalizedData = {
    personaId: String(personaId).trim(),
    characterId: String(characterId).trim(),
    message: String(message).trim().slice(0, 1000), // 메시지 길이 제한
    sender: String(sender).trim()
  };

  try {
    if (normalizedData.sender === "user") {
      // 1. 캐릭터 정보 조회 (캐시 활용 고려)
      const characterRows = await executeQuery(
        "SELECT id, name, profileImg, age, job, personality, background, firstMessage FROM character_profiles WHERE id = ?",
        [normalizedData.characterId],
        3000 // 타임아웃 단축 (4초 → 3초)
      );
      
      if (!Array.isArray(characterRows) || characterRows.length === 0) {
        return NextResponse.json({ 
          ok: false, 
          error: "캐릭터를 찾을 수 없습니다." 
        }, { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });
      }
      const character = characterRows[0] as any;

      // 2. 유저 메시지 저장 & 대화 이력 조회를 병렬로 실행 (최적화)
      const [_, chatHistory] = await Promise.all([
        executeMutation(
          "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [normalizedData.personaId, normalizedData.characterId, normalizedData.message, normalizedData.sender, character.name, character.profileImg, character.age, character.job],
          2500 // 타임아웃 단축 (3초 → 2.5초)
        ),
        executeQuery(
          "SELECT message, sender FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt DESC LIMIT 4",
          [normalizedData.personaId, normalizedData.characterId],
          2500 // 타임아웃 단축, 메시지 수 줄임 (5개 → 4개)
        )
      ]);

      // 3. OpenAI 요청 준비 (시스템 프롬프트 최적화)
      const systemPrompt = makeSystemPrompt(character);
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory.reverse().map((msg: any) => ({
          role: msg.sender === "user" ? "user" : "assistant" as "user" | "assistant",
          content: String(msg.message).slice(0, 500), // 히스토리 메시지 길이 제한
        })),
        { role: "user", content: normalizedData.message },
      ];

      // 4. OpenAI 답변 생성 (더욱 최적화된 설정)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 120, // 응답 길이 더 단축 (150 → 120)
        temperature: 0.7, // 창의성 약간 줄임 (0.8 → 0.7)
        top_p: 0.9, // 응답 품질 향상
        frequency_penalty: 0.3, // 반복 줄임
      });

      const aiText = completion.choices[0].message.content || "죄송해요, 응답을 생성할 수 없어요.";

      // 5. AI 메시지 저장 & 호감도 처리 최적화
      const favorKey = `${normalizedData.personaId}_${normalizedData.characterId}`;
      let favorDelta = 0;

      // 호감도 계산 (확률 조정으로 DB 부하 줄임)
      if (!(favorKey in favorCheckMap)) favorCheckMap[favorKey] = Math.floor(Math.random() * 4) + 2; // 2-5회
      favorCheckMap[favorKey]--;
      
      if (favorCheckMap[favorKey] <= 0 && Math.random() > 0.75) { // 25% 확률로 감소 (30% → 25%)
        favorDelta = Math.floor(Math.random() * 15) - 7; // -7 ~ +7 (범위 축소)
        favorCheckMap[favorKey] = Math.floor(Math.random() * 4) + 2;
      }

      // 6. AI 메시지 저장 & 호감도 업데이트 병렬 실행 (타임아웃 최적화)
      const savePromises: Promise<[ResultSetHeader, FieldPacket[]] | null>[] = [
        executeMutation(
          "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [normalizedData.personaId, normalizedData.characterId, aiText, "ai", character.name, character.profileImg, character.age, character.job],
          2000 // 타임아웃 단축 (3초 → 2초)
        ).catch(err => {
          console.log("Chat insert failed (non-critical):", err.message);
          return null;
        })
      ];

      if (favorDelta !== 0) {
        savePromises.push(
          executeMutation(
            `INSERT INTO character_favors (personaId, characterId, favor) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE favor = favor + VALUES(favor)`,
            [normalizedData.personaId, normalizedData.characterId, favorDelta],
            1500 // 타임아웃 단축 (2초 → 1.5초)
          ).catch(err => {
            console.log("Favor update failed (non-critical):", err.message);
            return null; // 호감도 실패는 치명적이지 않음
          }) as any
        );
      }

      // null이 아닌 결과만 필터링
      const results = await Promise.all(savePromises);
      const filteredResults = results.filter(r => r !== null);

      return NextResponse.json({ 
        ok: true, 
        aiText, 
        favorDelta,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      // sender가 ai로 직접 오는 경우 (빠른 처리)
      return NextResponse.json({ ok: true, message: "AI 메시지 처리 완료" });
    }
  } catch (err) {
    console.error("Chat API error:", err);
    
    // DB 에러시 향상된 폴백 응답
    if (normalizedData.sender === "user") {
      const fallbackResponse = "죄송해요, 일시적으로 연결에 문제가 있어요. 잠시 후 다시 시도해주세요. 🙏";
      return NextResponse.json({ 
        ok: true, 
        aiText: fallbackResponse, 
        favorDelta: 0, 
        fallback: true,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      return NextResponse.json({ 
        ok: true, 
        fallback: true,
        message: "처리 중 오류가 발생했지만 복구되었습니다."
      });
    }
  }
}

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get("personaId");
  const characterId = req.nextUrl.searchParams.get("characterId");
  console.log('GET /api/chat', { personaId, characterId });

  if (!personaId || !characterId) {
    return NextResponse.json({ 
      ok: false, 
      error: "personaId and characterId are required" 
    }, { 
      status: 400, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  try {
    // 채팅 메시지 & 호감도를 병렬로 조회
    const [messages, favorRows] = await Promise.all([
      executeQuery(
        "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC LIMIT 100",
        [personaId, characterId],
        5000
      ),
      executeQuery(
        "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
        [personaId, characterId],
        2000
      ).catch(() => []) // 호감도 조회 실패해도 메시지는 반환
    ]);
    
    const favor = Array.isArray(favorRows) && favorRows.length > 0 ? (favorRows[0] as any)?.favor : 0;
    
    return NextResponse.json({ 
      ok: true, 
      messages, 
      favor 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Chat GET error:", err);
    
    // DB 에러시 폴백 데이터 반환
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
    
    return NextResponse.json({ 
      ok: true, 
      messages: fallbackMessages, 
      favor: 0, 
      fallback: true 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function DELETE(req: NextRequest) {
  const { personaId, characterId } = await req.json();
  if (!personaId || !characterId) {
    return NextResponse.json({ 
      ok: false, 
      error: "personaId, characterId required" 
    }, { 
      status: 400, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  try {
    await executeMutation(
      "DELETE FROM chats WHERE personaId = ? AND characterId = ?",
      [personaId, characterId],
      5000
    );
    
    return NextResponse.json({ ok: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error("Chat DELETE error:", err);
    
    // DB 에러시에도 성공으로 처리
    return NextResponse.json({ ok: true, fallback: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// OPTIONS 요청 처리
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}