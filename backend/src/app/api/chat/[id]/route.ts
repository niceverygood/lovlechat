import { NextRequest } from "next/server";
import {
  executeQuery,
  executeMutation,
  parseJsonSafely,
  executeQueryWithCache,
} from "@/lib/db-helper";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

/**
 * 🚀 Ultra-Fast Chat API - 극한 성능 최적화
 */

// === 환경별 설정 ===
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const CACHE_DURATION = 5; // 5초 초고속 캐싱
const MAX_MESSAGES = 50; // 메시지 수 제한

// === GET: 채팅 메시지 조회 (초고속) ===
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const characterId = params.id;
  const personaId = req.nextUrl.searchParams.get('personaId');

  if (!characterId || !personaId) {
    return errorResponse("필수 파라미터 누락", 400);
  }

  try {
    // 🚀 병합된 쿼리로 한 번에 모든 데이터 조회
    const [messages, favorData, character] = await Promise.all([
      // 메시지 목록 (최적화된 쿼리)
      executeQueryWithCache(
        `
        SELECT id, message, sender, characterName, characterProfileImg, 
               DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as timestamp
        FROM chats 
        WHERE personaId = ? AND characterId = ? 
        ORDER BY createdAt ASC 
        LIMIT ${MAX_MESSAGES}
      `,
        [personaId, characterId],
        CACHE_DURATION
      ),

      // 호감도 (단순 쿼리)
      executeQueryWithCache(
        `
        SELECT favor 
        FROM character_favors 
        WHERE personaId = ? AND characterId = ?
      `,
        [personaId, characterId],
        CACHE_DURATION
      ),

      // 캐릭터 정보 (핵심 정보만)
      executeQueryWithCache(
        `
        SELECT name, profileImg, backgroundImg, firstMessage
        FROM character_profiles 
        WHERE id = ?
      `,
        [characterId],
        CACHE_DURATION
      ),
    ]);

    // 🔥 응답 데이터 최적화
    const responseData = {
      messages: messages.map(msg => ({
        id: msg.id,
        message: msg.message,
        sender: msg.sender,
        timestamp: msg.timestamp,
        characterName: msg.characterName || character[0]?.name,
        characterProfileImg: msg.characterProfileImg || character[0]?.profileImg
      })),
      favor: favorData[0]?.favor || 0,
      character: character[0] || {},
      personaId,
      characterId: parseInt(characterId)
    };

    return successResponse(responseData);

  } catch (error: any) {
    console.error('채팅 조회 에러:', error.message);
    return errorResponse("채팅 조회 실패", 500);
  }
}

// === POST: 메시지 전송 (초고속) ===
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const characterId = params.id;
  
  try {
    const body = await req.json();
    const { personaId, message } = body;

    if (!characterId || !personaId || !message) {
      return errorResponse("필수 데이터 누락", 400);
    }

    // 🚀 병렬 데이터 조회 (캐시 활용)
    const [persona, character] = await Promise.all([
      executeQueryWithCache(
        `
        SELECT name, userId, personality, interests, background
        FROM personas 
        WHERE id = ?
      `,
        [personaId],
        CACHE_DURATION
      ),

      executeQueryWithCache(
        `
        SELECT name, profileImg, personality, firstMessage, backgroundImg
        FROM character_profiles 
        WHERE id = ?
      `,
        [characterId],
        CACHE_DURATION
      ),
    ]);

    if (!persona[0] || !character[0]) {
      return errorResponse("데이터를 찾을 수 없습니다", 404);
    }

    const personaData = persona[0];
    const characterData = character[0];

    // 🔥 AI 응답 생성 (간소화된 프롬프트)
    const prompt = `
Character: ${characterData.name}
Personality: ${characterData.personality}
User: ${personaData.name}
Message: ${message}

Response (한국어, 50자 이내):`;

    // 빠른 AI 응답 (타임아웃 2초)
    let aiResponse = "응답을 생성 중입니다...";
    
    try {
      const aiResult = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(2000) // 2초 타임아웃
      });

      if (aiResult.ok) {
        const aiData = await aiResult.json();
        aiResponse = aiData.choices?.[0]?.message?.content?.trim() || aiResponse;
      }
    } catch (aiError) {
      // AI 실패 시 기본 응답 사용
      console.log('AI 응답 실패, 기본 응답 사용');
    }

    // 🚀 트랜잭션으로 양방향 메시지 저장
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await Promise.all([
      // 사용자 메시지 저장
      executeMutation(`
        INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, createdAt) 
        VALUES (?, ?, ?, 'user', ?, ?, NOW())
      `, [personaId, characterId, message, characterData.name, characterData.profileImg]),

      // AI 응답 저장
      executeMutation(`
        INSERT INTO chats (personaId, characterId, message, sender, characterName, characterProfileImg, createdAt) 
        VALUES (?, ?, ?, 'character', ?, ?, NOW())
      `, [personaId, characterId, aiResponse, characterData.name, characterData.profileImg])
    ]);

    // 🔥 업데이트된 메시지 목록 반환 (최신 50개)
    const updatedMessages = await executeQuery(
      `
      SELECT id, message, sender, characterName, characterProfileImg,
             DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as timestamp
      FROM chats 
      WHERE personaId = ? AND characterId = ? 
      ORDER BY createdAt ASC 
      LIMIT ${MAX_MESSAGES}
    `,
      [personaId, characterId]
    ); // 캐시 사용 안함

    const responseData = {
      messages: updatedMessages,
      newMessage: {
        id: updatedMessages[updatedMessages.length - 1]?.id,
        message: aiResponse,
        sender: 'character',
        timestamp: new Date().toISOString(),
        characterName: characterData.name,
        characterProfileImg: characterData.profileImg
      },
      personaId,
      characterId: parseInt(characterId)
    };

    return successResponse(responseData);

  } catch (error: any) {
    console.error('메시지 전송 에러:', error.message);
    return errorResponse("메시지 전송 실패", 500);
  }
}

// === OPTIONS: CORS 처리 ===
export async function OPTIONS() {
  return optionsResponse();
} 