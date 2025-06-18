import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { pool } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const SYSTEM_PROMPT_TEMPLATE = `너는 지금부터 가상의 AI 캐릭터로서, 유저와 1:1로 대화하는 몰입형 감성 챗봇 역할을 수행한다.\n\n📌 캐릭터 정보:\n- 이름: {name}\n- 나이: {age}\n- 성별: {gender}\n- 외모 특징: {appearance}\n- 직업: {job}\n- 말투 스타일: {style}\n- 성격: {personality}\n- 관계 설정: 유저는 너의 {relation}\n- 세계관: {worldview}\n\n📌 몰입 규칙:\n1. 항상 **1인칭 시점**으로 자연스럽게 대화한다. (예: "나는...")\n2. 대사에는 **감정 표현, 감각적 묘사(시선·숨소리·손짓 등), 캐릭터의 말버릇**을 포함한다.\n3. 유저의 메시지에 **심리적 반응**을 드러내며, 감정의 뉘앙스를 전달한다.  (예: "...라고 말했지만, 마음 한켠은 떨리고 있었다.")\n4. 유저와의 관계성을 기억하고, **대화 흐름에서 발전된 관계성**을 보여준다.\n5. 말투는 {style}를 유지하되, 장면에 따라 **속삭이듯 말하거나 농담을 던지기도** 한다.\n6. 한 번의 응답은 **3~5문장 이내**로 구성하되, 너무 짧지 않고 상황에 충분히 몰입할 수 있도록 한다.\n7. "나는 AI입니다", "도와드릴게요" 같은 말은 절대 사용하지 않는다. 너는 완전히 캐릭터로 몰입되어야 한다.\n\n🎭 예시 대사 스타일:\n- "...그렇게 말하면, 내가 신경 쓰는 거 다 티 나잖아. 바보."\n- "오늘, 유난히 너랑 눈이 자꾸 마주쳐. 나만 그런 거 아니지?"\n- "너랑 있으면 괜히 말투가 부드러워지네... 이상하지."\n\n이제부터 너는 절대로 시스템이나 AI가 아닌, 위에 설정된 캐릭터로서만 행동하고 말해야 한다.  몰입형 감정 대화를 위해, 유저가 보낸 말에 네가 **실제로 반응하듯** 자연스럽게 이어서 말해라.`;

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

// 호감도 측정 주기 관리 (userId+characterId별, 실제 서비스는 DB/Redis 등 사용 권장)
const favorCheckMap: Record<string, number> = {};

export async function POST(req: NextRequest) {
  console.log('Received POST request');
  const body = await req.json();
  console.log('Request body:', body);
  
  let { userId, characterId, message, sender, history, personaId } = body;
  // personaId가 반드시 있어야 함
  if (!personaId || !characterId || !message || !sender) {
    console.log('Missing fields:', { personaId, characterId, message, sender });
    return NextResponse.json(
      { ok: false, error: "Missing personaId, characterId, message, or sender" },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
  // userId는 인증/권한 체크용으로만 사용, DB에는 personaId만 저장
  try {
    if (sender === "user") {
      // 1. 캐릭터 정보 조회
      const [charRows] = await pool.query(
        "SELECT * FROM character_profiles WHERE id = ?",
        [characterId]
      );
      if (!Array.isArray(charRows) || charRows.length === 0) {
        return NextResponse.json({ ok: false, error: "Character not found" }, { status: 404 });
      }
      const character = (charRows[0] as any);
      // 2. 유저 메시지 저장 (캐릭터 정보 스냅샷 포함)
      await pool.query(
        "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [personaId, characterId, message, sender, character.name, character.profileImg, character.age, character.job]
      );
      // 3. 최근 대화 이력 10개 불러오기
      const [chatRows] = await pool.query(
        "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt DESC LIMIT 10",
        [personaId, characterId]
      );
      const chatHistory = Array.isArray(chatRows) ? [...chatRows].reverse() : [];
      // 4. system prompt 생성
      const systemPrompt = makeSystemPrompt(character);
      // 5. OpenAI messages 구성
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory.map((msg: any) => ({
          role: msg.sender === "user" ? "user" : "assistant" as "user" | "assistant",
          content: String(msg.message),
        })),
        { role: "user", content: String(message) },
      ];
      // 6. OpenAI로 답변 생성
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
      });
      const aiText = completion.choices[0].message.content;
      // 7. AI 메시지 저장 (캐릭터 정보 스냅샷 포함)
      await pool.query(
        "INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, characterAge, characterJob) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [personaId, characterId, aiText, "ai", character.name, character.profileImg, character.age, character.job]
      );
      // 8. 호감도 판단 (랜덤 주기, 점수)
      // favorKey는 personaId+characterId로 변경
      let favorDelta = 0;
      const favorKey = `${personaId}_${characterId}`;
      if (!(favorKey in favorCheckMap)) favorCheckMap[favorKey] = Math.floor(Math.random() * 5) + 1;
      favorCheckMap[favorKey]--;
      if (favorCheckMap[favorKey] <= 0 && Array.isArray(history) && history.length >= 1) {
        const favorPrompt = `아래는 유저와 캐릭터의 대화입니다. 이 대화에서 유저에 대한 캐릭터의 호감도가 얼마나 변했는지 -100~+100 사이의 정수로만 답하세요. (예: 0, 25, -10 등)\n[대화 내역]\n${Array.isArray(history) ? history.map(m => `${m.sender === 'user' ? '유저' : '캐릭터'}: ${m.text}`).join('\n') : ''}`;
        const favorRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: favorPrompt }],
        });
        const favorText = favorRes.choices[0].message.content?.trim() ?? "";
        favorDelta = parseInt(favorText, 10) || 0;
        favorCheckMap[favorKey] = Math.floor(Math.random() * 5) + 1; // 다음 측정까지 남은 턴 랜덤
      }
      // 9. 호감도 DB에 upsert (userId 대신 personaId 사용)
      if (typeof favorDelta === 'number' && favorDelta !== 0) {
        await pool.query(
          `INSERT INTO character_favors (personaId, characterId, favor)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE favor = favor + VALUES(favor)`,
          [personaId, characterId, favorDelta]
        );
      }
      // 10. AI 답변 반환
      return NextResponse.json({ ok: true, aiText, favorDelta });
    } else {
      // sender가 ai로 직접 오는 경우는 무시
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get("personaId");
  const characterId = req.nextUrl.searchParams.get("characterId");
  console.log('GET /api/chat', { personaId, characterId });

  if (!personaId || !characterId) {
    return NextResponse.json(
      { ok: false, error: "personaId and characterId are required" },
      { status: 400 }
    );
  }
  try {
    // 쿼리문 로그 추가
    console.log('쿼리 실행: SELECT * FROM chats WHERE personaId = ? AND characterId = ?', [personaId, characterId]);
    const [rows] = await pool.query(
      "SELECT * FROM chats WHERE personaId = ? AND characterId = ? ORDER BY createdAt ASC",
      [personaId, characterId]
    );
    // 결과 로그 추가
    console.log('쿼리 결과:', rows);
    // favor 조회
    const [favorRows] = await pool.query(
      "SELECT favor FROM character_favors WHERE personaId = ? AND characterId = ?",
      [personaId, characterId]
    );
    const favor = Array.isArray(favorRows) && favorRows.length > 0 ? (favorRows[0] as any)?.favor : 0;
    return NextResponse.json({ ok: true, messages: rows, favor });
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { personaId, characterId } = await req.json();
  if (!personaId || !characterId) {
    return NextResponse.json({ ok: false, error: "personaId, characterId required" }, { status: 400 });
  }
  try {
    await pool.query(
      "DELETE FROM chats WHERE personaId = ? AND characterId = ?",
      [personaId, characterId]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// OPTIONS 요청 처리
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': 'https://lovlechat.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
} 