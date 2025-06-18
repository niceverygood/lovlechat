import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { executeQuery, executeMutation } from "@/lib/db-helper";

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
  
  if (!personaId || !characterId || !message || !sender) {
    console.log('Missing fields:', { personaId, characterId, message, sender });
    return NextResponse.json(
      { ok: false, error: "Missing personaId, characterId, message, or sender" },
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

  try {
    if (sender === "user") {
      // 1. 캐릭터 정보 조회 & 유저 메시지 저장을 병렬로 실행
      const [characterRows] = await Promise.all([
        executeQuery(
          "SELECT * FROM character_profiles WHERE id = ?",
          [characterId],
          4000
        ),
        executeMutation(
          "INSERT INTO chats (personaId, characterId, message, sender) VALUES (?, ?, ?, ?)",
          [personaId, characterId, message, sender],
          3000
        )
      ]);
      
      if (!Array.isArray(characterRows) || characterRows.length === 0) {
        return NextResponse.json({ ok: false, error: "Character not found" }, { status: 404 });
      }
      const character = characterRows[0] as any;

      // 2. 최근 대화 이력 조회 (LIMIT 5로 줄여서 성능 향상)
      const chatHistory = await executeQuery(
        "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt DESC LIMIT 5",
        [personaId, characterId],
        3000
      );

      // 3. OpenAI 요청 준비 (메시지 간소화)
      const systemPrompt = makeSystemPrompt(character);
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory.reverse().map((msg: any) => ({
          role: msg.sender === "user" ? "user" : "assistant" as "user" | "assistant",
          content: String(msg.message),
        })),
        { role: "user", content: String(message) },
      ];

      // 4. OpenAI 답변 생성 (최적화된 설정)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 150, // 응답 길이 제한으로 속도 향상
        temperature: 0.8, // 적당한 창의성
      });

      const aiText = completion.choices[0].message.content || "죄송해요, 응답을 생성할 수 없어요.";

      // 5. AI 메시지 저장 & 호감도 처리를 병렬로 실행
      const favorKey = `${personaId}_${characterId}`;
      let favorDelta = 0;

      // 호감도 계산 (확률적 처리)
      if (!(favorKey in favorCheckMap)) favorCheckMap[favorKey] = Math.floor(Math.random() * 3) + 1;
      favorCheckMap[favorKey]--;
      
      if (favorCheckMap[favorKey] <= 0 && Math.random() > 0.7) { // 30% 확률로만 호감도 계산
        favorDelta = Math.floor(Math.random() * 21) - 10; // -10 ~ +10
        favorCheckMap[favorKey] = Math.floor(Math.random() * 3) + 1;
      }

      // 6. AI 메시지 저장 & 호감도 업데이트 병렬 실행
      const savePromises = [
        executeMutation(
          "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [personaId, characterId, aiText, "ai", character.name, character.profileImg, character.age, character.job],
          3000
        )
      ];

      if (favorDelta !== 0) {
        savePromises.push(
          executeMutation(
            `INSERT INTO character_favors (personaId, characterId, favor) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE favor = favor + VALUES(favor)`,
            [personaId, characterId, favorDelta],
            2000
          ).catch(err => console.log("Favor update failed:", err))
        );
      }

      await Promise.all(savePromises);

      return NextResponse.json({ 
        ok: true, 
        aiText, 
        favorDelta 
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      // sender가 ai로 직접 오는 경우
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Chat API error:", err);
    
    // DB 에러시 기본 AI 응답 반환
    if (sender === "user") {
      const fallbackResponse = "죄송해요, 일시적으로 연결에 문제가 있어요. 잠시 후 다시 시도해주세요.";
      return NextResponse.json({ 
        ok: true, 
        aiText: fallbackResponse, 
        favorDelta: 0, 
        fallback: true 
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      return NextResponse.json({ ok: true, fallback: true });
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