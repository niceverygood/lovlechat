import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeMutation } from '../../../../lib/db-helper';
import { CORS_HEADERS } from '../../../../lib/cors';

// 🔄 캐릭터 새로 받기 API (하트 50개 소진, 개인화 추천)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    console.log('캐릭터 새로 받기 요청:', { userId });

    if (!userId) {
      return NextResponse.json({
        ok: false,
        error: 'userId가 필요합니다.'
      }, {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    // 1. 현재 사용자 하트 확인
    const user = await executeQuery(
      'SELECT hearts FROM users WHERE userId = ?',
      [userId]
    );

    console.log('사용자 조회 결과:', user);

    if (!user || user.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '사용자를 찾을 수 없습니다.'
      }, {
        status: 404,
        headers: CORS_HEADERS
      });
    }

    const currentHearts = user[0].hearts;
    const requiredHearts = 50;

    console.log('하트 확인:', { currentHearts, requiredHearts });

    // 2. 하트 부족 체크
    if (currentHearts < requiredHearts) {
      return NextResponse.json({
        ok: false,
        error: '하트가 부족합니다. 캐릭터 카드를 새로 받으려면 50개의 하트가 필요해요! 💖',
        currentHearts,
        requiredHearts,
        needMore: requiredHearts - currentHearts
      }, {
        status: 402, // Payment Required
        headers: CORS_HEADERS
      });
    }

    // 3. 새로받기 횟수 확인 (5개 + 이전 횟수)
    const refreshHistory = await executeQuery(
      'SELECT COUNT(*) as refreshCount FROM heart_transactions WHERE userId = ? AND type = "refresh"',
      [userId]
    );

    const previousRefreshCount = refreshHistory[0]?.refreshCount || 0;
    const charactersToReceive = 5 + previousRefreshCount; // 첫 번째는 5개, 그 다음부터 +1씩

    console.log('새로받기 기록:', { previousRefreshCount, charactersToReceive });

    // 4. 사용자 선호도 분석
    const userPreferences = await analyzeUserPreferences(userId);
    console.log('사용자 선호도:', userPreferences);

    // 5. 개인화된 캐릭터 추천
    const recommendedCharacters = await getRecommendedCharacters(userId, charactersToReceive, userPreferences);

    console.log('추천 캐릭터 수:', recommendedCharacters.length);

    if (!recommendedCharacters || recommendedCharacters.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '추천할 캐릭터를 찾을 수 없습니다.'
      }, {
        status: 404,
        headers: CORS_HEADERS
      });
    }

    const newHearts = currentHearts - requiredHearts;

    console.log('새 하트 수:', newHearts);

    // 6. 하트 차감
    await executeMutation(
      'UPDATE users SET hearts = ? WHERE userId = ?',
      [newHearts, userId]
    );

    console.log('하트 차감 완료');

    // 7. 사용 내역 저장
    await executeMutation(
      'INSERT INTO heart_transactions (userId, amount, type, description, beforeHearts, afterHearts, relatedId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, -requiredHearts, 'refresh', `캐릭터 카드 새로 받기 (${charactersToReceive}장)`, currentHearts, newHearts, `refresh_${Date.now()}`]
    );

    console.log('거래 내역 저장 완료');

    // 8. 응답 반환
    return NextResponse.json({
      ok: true,
      message: `하트 ${requiredHearts}개를 사용해서 새로운 캐릭터 ${charactersToReceive}장을 받았어요! 💖`,
      characters: recommendedCharacters.map(char => ({
        id: char.id,
        name: char.name,
        profileImg: char.profileImg,
        age: char.age,
        job: char.job,
        oneLiner: char.oneLiner,
        backgroundImg: char.backgroundImg,
        firstScene: char.firstScene,
        firstMessage: char.firstMessage,
        category: char.category,
        tags: parseJsonField(char.tags) || [],
        selectedTags: []
      })),
      charactersCount: charactersToReceive,
      beforeHearts: currentHearts,
      afterHearts: newHearts,
      usedHearts: requiredHearts,
      refreshCount: previousRefreshCount + 1
    }, {
      status: 200,
      headers: CORS_HEADERS
    });

  } catch (error: any) {
    console.error('캐릭터 새로 받기 실패:', error);
    return NextResponse.json({
      ok: false,
      error: '캐릭터 새로 받기 중 오류가 발생했습니다.',
      details: error.message
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

// 사용자 선호도 분석 함수
async function analyzeUserPreferences(userId: string) {
  try {
    // 1. 좋아요한 캐릭터들의 특성 분석
    const favoriteCharacters = await executeQuery(`
      SELECT cp.gender, cp.job, cp.category, cp.tags, cp.age
      FROM character_favors cf
      JOIN character_profiles cp ON cf.characterId = cp.id
      JOIN personas p ON cf.personaId = p.id
      WHERE p.userId = ? AND cf.favor > 0
      ORDER BY cf.favor DESC
      LIMIT 10
    `, [userId]);

    // 2. 대화한 캐릭터들의 특성 분석
    const chattedCharacters = await executeQuery(`
      SELECT cp.gender, cp.job, cp.category, cp.tags, cp.age, COUNT(*) as chatCount
      FROM chats c
      JOIN character_profiles cp ON c.characterId = cp.id
      JOIN personas p ON c.personaId = p.id
      WHERE p.userId = ?
      GROUP BY cp.id, cp.gender, cp.job, cp.category, cp.tags, cp.age
      ORDER BY chatCount DESC
      LIMIT 10
    `, [userId]);

    // 특성별 선호도 계산
    const preferences: {
      genders: { [key: string]: number },
      jobs: { [key: string]: number },
      categories: { [key: string]: number },
      ages: { [key: string]: number },
      tags: { [key: string]: number }
    } = {
      genders: {},
      jobs: {},
      categories: {},
      ages: {},
      tags: {}
    };

    // 좋아요 데이터 가중치 적용 (2배)
    favoriteCharacters.forEach((char: any) => {
      if (char.gender) preferences.genders[char.gender] = (preferences.genders[char.gender] || 0) + 2;
      if (char.job) preferences.jobs[char.job] = (preferences.jobs[char.job] || 0) + 2;
      if (char.category) preferences.categories[char.category] = (preferences.categories[char.category] || 0) + 2;
      if (char.age) preferences.ages[char.age] = (preferences.ages[char.age] || 0) + 2;
      
      const tags = parseJsonField(char.tags) || [];
      tags.forEach((tag: string) => {
        preferences.tags[tag] = (preferences.tags[tag] || 0) + 2;
      });
    });

    // 채팅 데이터 가중치 적용 (1배, 채팅 횟수 고려)
    chattedCharacters.forEach((char: any) => {
      const weight = Math.min(char.chatCount / 5, 3); // 최대 3배까지
      if (char.gender) preferences.genders[char.gender] = (preferences.genders[char.gender] || 0) + weight;
      if (char.job) preferences.jobs[char.job] = (preferences.jobs[char.job] || 0) + weight;
      if (char.category) preferences.categories[char.category] = (preferences.categories[char.category] || 0) + weight;
      if (char.age) preferences.ages[char.age] = (preferences.ages[char.age] || 0) + weight;
      
      const tags = parseJsonField(char.tags) || [];
      tags.forEach((tag: string) => {
        preferences.tags[tag] = (preferences.tags[tag] || 0) + weight;
      });
    });

    return preferences;
  } catch (error) {
    console.error('선호도 분석 실패:', error);
    return { 
      genders: {} as { [key: string]: number }, 
      jobs: {} as { [key: string]: number }, 
      categories: {} as { [key: string]: number }, 
      ages: {} as { [key: string]: number }, 
      tags: {} as { [key: string]: number } 
    };
  }
}

// 개인화된 캐릭터 추천 함수
async function getRecommendedCharacters(userId: string, count: number, preferences: any) {
  try {
    // 이미 받은 캐릭터 제외 (최근 30일 내 새로받기로 받은 캐릭터)
    const recentRefreshCharacters = await executeQuery(`
      SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(ht.relatedId, '$')) as characterId
      FROM heart_transactions ht
      WHERE ht.userId = ? 
      AND ht.type = 'refresh' 
      AND ht.createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [userId]);

    const excludeIds = recentRefreshCharacters
      .map(row => row.characterId)
      .filter(id => id && !isNaN(parseInt(id)))
      .map(id => parseInt(id));

    // 숨긴 캐릭터 제외
    const hiddenCharacters = await executeQuery(`
      SELECT characterId FROM character_hidden WHERE userId = ?
    `, [userId]);

    const hiddenIds = hiddenCharacters.map(row => row.characterId);
    const allExcludeIds = [...excludeIds, ...hiddenIds];

    // 기본 캐릭터 쿼리
    let baseQuery = `
      SELECT id, name, profileImg, age, job, oneLiner, backgroundImg, 
             firstScene, firstMessage, category, tags, gender
      FROM character_profiles 
      WHERE scope = '공개'
    `;

    const queryParams = [];

    // 제외할 캐릭터가 있는 경우
    if (allExcludeIds.length > 0) {
      baseQuery += ` AND id NOT IN (${allExcludeIds.map(() => '?').join(',')})`;
      queryParams.push(...allExcludeIds);
    }

    // 모든 공개 캐릭터 조회
    const allCharacters = await executeQuery(baseQuery, queryParams);

    if (allCharacters.length === 0) {
      // 제외 조건을 완화하여 다시 시도
      const fallbackCharacters = await executeQuery(`
        SELECT id, name, profileImg, age, job, oneLiner, backgroundImg, 
               firstScene, firstMessage, category, tags, gender
        FROM character_profiles 
        WHERE scope = '공개'
        ORDER BY RAND()
        LIMIT ?
      `, [count]);
      
      return fallbackCharacters;
    }

    // 선호도 기반 점수 계산
    const scoredCharacters = allCharacters.map((char: any) => {
      let score = 0;

      // 성별 선호도
      if (char.gender && preferences.genders[char.gender]) {
        score += preferences.genders[char.gender] * 3;
      }

      // 직업 선호도
      if (char.job && preferences.jobs[char.job]) {
        score += preferences.jobs[char.job] * 2;
      }

      // 카테고리 선호도
      if (char.category && preferences.categories[char.category]) {
        score += preferences.categories[char.category] * 2;
      }

      // 나이 선호도
      if (char.age && preferences.ages[char.age]) {
        score += preferences.ages[char.age] * 1;
      }

      // 태그 선호도
      const tags = parseJsonField(char.tags) || [];
      tags.forEach((tag: string) => {
        if (preferences.tags[tag]) {
          score += preferences.tags[tag] * 1.5;
        }
      });

      // 랜덤 요소 추가 (다양성 확보)
      score += Math.random() * 5;

      return { ...char, score };
    });

    // 점수 기준으로 정렬하고 상위 캐릭터들 선택
    scoredCharacters.sort((a, b) => b.score - a.score);

    // 상위 후보군에서 랜덤하게 선택 (다양성 확보)
    const topCandidates = scoredCharacters.slice(0, Math.min(count * 3, scoredCharacters.length));
    const selectedCharacters = [];

    for (let i = 0; i < count && topCandidates.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      selectedCharacters.push(topCandidates[randomIndex]);
      topCandidates.splice(randomIndex, 1); // 중복 방지
    }

    return selectedCharacters;

  } catch (error) {
    console.error('캐릭터 추천 실패:', error);
    
    // fallback: 랜덤 캐릭터 반환
    const fallbackCharacters = await executeQuery(`
      SELECT id, name, profileImg, age, job, oneLiner, backgroundImg, 
             firstScene, firstMessage, category, tags, gender
      FROM character_profiles 
      WHERE scope = '공개'
      ORDER BY RAND()
      LIMIT ?
    `, [count]);
    
    return fallbackCharacters;
  }
}

// JSON 필드 안전하게 파싱하는 헬퍼 함수
function parseJsonField(field: any): any {
  if (!field) return null;
  if (typeof field === 'object') return field;
  if (typeof field !== 'string') return field;
  
  try {
    const trimmed = field.trim();
    if (!trimmed) return null;
    
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
      return trimmed;
    }
    
    return JSON.parse(trimmed);
  } catch (error) {
    console.warn('JSON parsing failed:', { input: field });
    return field;
  }
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  });
} 