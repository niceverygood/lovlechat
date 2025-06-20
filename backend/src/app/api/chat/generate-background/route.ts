import { NextRequest } from "next/server";
import OpenAI from "openai";
import { successResponse, errorResponse, optionsResponse } from "@/lib/cors";

// OpenAI 클라이언트 (채팅 API와 동일)
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000 // 이미지 생성은 시간이 더 걸림
    });
  }
} catch (error) {
  console.warn("OpenAI 클라이언트 초기화 실패:", error);
}

// 대화 내용을 분석해서 이미지 프롬프트 생성
function generateImagePrompt(character: any, recentMessages: string[], currentMood: string): string {
  const lastMessage = recentMessages[recentMessages.length - 1] || "";
  
  // 🏛️ 장소/건물 키워드 (대폭 확장)
  const placeKeywords = {
    // 기본 장소
    '카페': 'cozy coffee shop with warm lighting, wooden tables, books on shelves',
    '레스토랑': 'elegant restaurant interior, dim lighting, romantic setting',
    '집': 'comfortable home interior, warm living room, soft lighting',
    '침실': 'cozy bedroom with soft bed, warm lighting, intimate atmosphere',
    '주방': 'modern kitchen with cooking area, warm family atmosphere',
    
    // 자연 환경
    '공원': 'beautiful park with green trees, walking paths, peaceful atmosphere',
    '바다': 'serene ocean view with waves, blue sky, romantic sunset',
    '해변': 'sandy beach with ocean waves, seashells, tropical paradise',
    '산': 'majestic mountain landscape, hiking trails, fresh air',
    '숲': 'enchanted forest with tall trees, mysterious atmosphere',
    '호수': 'peaceful lake with reflections, surrounded by nature',
    '정원': 'beautiful garden with flowers, butterflies, zen atmosphere',
    '강': 'flowing river with rocks, bridge, natural scenery',
    
    // 도시 환경
    '거리': 'busy city street with buildings, people, urban atmosphere',
    '옥상': 'rooftop terrace with city skyline view, urban sunset',
    '지하철': 'modern subway station, clean and bright',
    '버스정류장': 'city bus stop with benches, urban setting',
    '쇼핑몰': 'modern shopping mall, bright lights, bustling atmosphere',
    '백화점': 'luxury department store, elegant interior',
    
    // 교육/문화 시설
    '학교': 'bright classroom or school hallway, clean and modern',
    '도서관': 'quiet library with bookshelves, reading tables, warm atmosphere',
    '박물관': 'art museum with exhibitions, cultural atmosphere',
    '미술관': 'modern art gallery with paintings, sophisticated setting',
    '극장': 'theater interior with red seats, dramatic stage lighting',
    '콘서트홀': 'grand concert hall with orchestra, elegant atmosphere',
    
    // 운동/레저 시설
    '체육관': 'modern fitness gym with equipment, energetic atmosphere',
    '수영장': 'indoor pool with clear blue water, relaxing environment',
    '놀이공원': 'colorful amusement park with rides, festive atmosphere',
    '영화관': 'cinema interior with big screen, cozy movie atmosphere',
    
    // 비즈니스/업무
    '회사': 'modern office space, professional atmosphere, city view',
    '회의실': 'corporate meeting room with large table, professional setting',
    '은행': 'modern bank interior, clean and professional',
    
    // 의료/치료
    '병원': 'clean hospital room or waiting area, bright and sterile',
    '약국': 'modern pharmacy with medicine shelves, clean environment',
    
    // 교통
    '공항': 'busy airport terminal, modern architecture, travel atmosphere',
    '기차역': 'train station platform, departure boards, travel vibes',
    '항구': 'harbor with ships, ocean breeze, maritime atmosphere'
  };

  // 🎭 감정/분위기 키워드 (세분화)
  const moodKeywords = {
    // 긍정적 감정
    '기쁨': 'bright, cheerful, warm colors, happy atmosphere',
    '행복': 'joyful, vibrant colors, celebratory mood',
    '즐거움': 'fun, lively, energetic atmosphere',
    '흥미': 'curious, engaging, dynamic environment',
    '만족': 'content, peaceful, harmonious setting',
    
    // 로맨틱 감정
    '사랑': 'romantic lighting, soft pink/red hues, dreamy atmosphere',
    '설렘': 'exciting, heart-fluttering, magical ambiance',
    '로맨틱': 'intimate, candlelit, romantic dinner setting',
    
    // 평온한 감정
    '평온': 'peaceful, calm colors, gentle lighting, serene atmosphere',
    '여유': 'relaxed, leisurely, comfortable environment',
    '안정': 'stable, secure, warm and cozy atmosphere',
    
    // 부정적 감정
    '슬픔': 'soft, muted colors, gentle lighting, comforting atmosphere',
    '우울': 'melancholic, gray tones, reflective mood',
    '화남': 'dramatic lighting, intense colors, stormy atmosphere',
    '긴장': 'dramatic shadows, cool colors, tense atmosphere',
    '스트레스': 'chaotic, overwhelming, intense environment',
    
    // 특별한 분위기
    '미스터리': 'mysterious, dark shadows, enigmatic atmosphere',
    '모험': 'adventurous, exciting, exploration vibes',
    '환상': 'fantasy, magical, dreamlike environment',
    '노스탤지어': 'nostalgic, vintage, warm memories'
  };

  // ⏰ 시간대 키워드 (세분화)
  const timeKeywords = {
    '새벽': 'early dawn light, quiet peaceful morning',
    '아침': 'morning sunlight, fresh atmosphere, golden hour',
    '오전': 'mid-morning brightness, active daytime',
    '점심': 'bright daylight, clear and vibrant, noon sun',
    '오후': 'afternoon sunshine, warm natural light',
    '저녁': 'sunset lighting, warm orange glow, romantic',
    '밤': 'night scene, soft moonlight, intimate lighting',
    '심야': 'late night, city lights, mysterious darkness'
  };

  // 🌤️ 날씨/계절 키워드 (새로 추가)
  const weatherKeywords = {
    '봄': 'spring season, cherry blossoms, fresh green leaves',
    '여름': 'summer vibes, bright sunshine, vivid colors',
    '가을': 'autumn colors, fallen leaves, warm golden tones',
    '겨울': 'winter atmosphere, snow, cozy indoor warmth',
    '비': 'rainy day, water drops, cozy indoor atmosphere',
    '눈': 'snowy landscape, white winter wonderland',
    '맑음': 'clear sky, bright sunshine, perfect weather',
    '흐림': 'overcast sky, soft diffused lighting',
    '안개': 'misty atmosphere, dreamy foggy environment'
  };

  // 🎨 활동 키워드 (새로 추가)
  const activityKeywords = {
    '데이트': 'romantic date setting, intimate atmosphere',
    '산책': 'walking path, leisurely stroll environment',
    '쇼핑': 'shopping district, boutique stores, retail therapy',
    '운동': 'fitness activity, energetic sports environment',
    '공부': 'study environment, focused learning atmosphere',
    '독서': 'reading nook, quiet contemplative space',
    '요리': 'cooking scene, kitchen activity, homey atmosphere',
    '여행': 'travel destination, adventure and exploration',
    '휴식': 'relaxation spot, peaceful resting place',
    '파티': 'celebration venue, festive party atmosphere',
    '미팅': 'meeting place, professional gathering spot',
    '놀이': 'playground, fun recreational area'
  };

  // 🌈 색상/조명 키워드 (새로 추가)
  const colorKeywords = {
    '따뜻한': 'warm color palette, cozy orange and yellow tones',
    '차가운': 'cool color scheme, blue and teal atmosphere',
    '화려한': 'vibrant colorful environment, rainbow hues',
    '단조로운': 'monochromatic setting, simple color scheme',
    '밝은': 'bright illumination, well-lit cheerful space',
    '어두운': 'dim lighting, atmospheric shadows',
    '금색': 'golden lighting, luxury atmosphere',
    '은색': 'silver tones, modern metallic environment'
  };

  // 🎯 통합 키워드 검색 시스템
  const allKeywords = {
    ...placeKeywords,
    ...moodKeywords, 
    ...timeKeywords,
    ...weatherKeywords,
    ...activityKeywords,
    ...colorKeywords
  };

  // 🔍 메시지에서 모든 키워드 검색
  const foundKeywords = [];
  const messageAndScene = `${lastMessage} ${character.firstScene || ''} ${currentMood}`.toLowerCase();
  
  for (const [keyword, description] of Object.entries(allKeywords)) {
    if (messageAndScene.includes(keyword.toLowerCase())) {
      foundKeywords.push(description);
    }
  }

  // 🎨 기본 설정 (키워드가 없을 때)
  let baseScene = "modern comfortable room";
  let atmosphereElements = ["warm and welcoming atmosphere", "soft natural lighting"];

  // 🎭 키워드 발견시 조합
  if (foundKeywords.length > 0) {
    baseScene = foundKeywords[0]; // 첫 번째 키워드를 메인 배경으로
    atmosphereElements = foundKeywords.slice(1, 4); // 나머지를 분위기 요소로 (최대 3개)
  }

  // 📝 지능적 프롬프트 구성
  const sceneDescription = [baseScene, ...atmosphereElements].join(', ');
  
  // 🌟 프롬프트 스타일 랜덤화 (다양성 증대)
  const styles = [
    'anime-style background scene',
    'beautiful digital art environment',
    'cinematic background illustration', 
    'atmospheric scene painting',
    'detailed environmental artwork'
  ];
  
  const qualities = [
    'High quality digital art, detailed environment, no characters',
    'Professional artwork, rich details, immersive atmosphere',
    'Masterpiece quality, environmental storytelling, cinematic lighting',
    'Studio-quality illustration, atmospheric depth, visual narrative'
  ];

  const compositions = [
    'Cinematic composition, soft depth of field',
    'Wide angle view, beautiful composition',
    'Perfect framing, artistic perspective',
    'Dynamic composition, visual harmony'
  ];

  // 🎲 랜덤 요소 선택으로 다양성 보장
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];
  const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
  const randomComposition = compositions[Math.floor(Math.random() * compositions.length)];

  // 🎯 최종 프롬프트 생성
  const imagePrompt = `A ${randomStyle}: ${sceneDescription}. ${randomQuality}, focus on atmosphere and mood. ${randomComposition}.`;

  return imagePrompt;
}

export async function POST(req: NextRequest) {
  try {
    const { character, recentMessages, currentMood } = await req.json();

    if (!openai || !process.env.OPENAI_API_KEY) {
      return errorResponse("이미지 생성 서비스가 비활성화되어 있습니다.", 503);
    }

    // 이미지 프롬프트 생성
    const imagePrompt = generateImagePrompt(character, recentMessages || [], currentMood || "neutral");
    
    console.log("🎨 이미지 생성 프롬프트:", imagePrompt);

    try {
      // DALL-E 3로 이미지 생성
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard", // standard or hd
        style: "natural" // natural or vivid
      });

      const imageUrl = response.data?.[0]?.url;
      
      if (!imageUrl) {
        throw new Error("이미지 URL을 받을 수 없습니다.");
      }

      console.log("✅ 이미지 생성 완료:", imageUrl);

      return successResponse({ 
        imageUrl,
        prompt: imagePrompt,
        timestamp: new Date().toISOString()
      });

    } catch (dalleError: any) {
      console.error("DALL-E API 오류:", dalleError);
      
      // 폴백 배경 이미지들
      const fallbackImages = [
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1024&h=1024&fit=crop&crop=center",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1024&h=1024&fit=crop&crop=center",
        "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1024&h=1024&fit=crop&crop=center",
        "https://images.unsplash.com/photo-1441716844725-09cedc13a4e7?w=1024&h=1024&fit=crop&crop=center"
      ];
      
      const fallbackImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
      
      return successResponse({ 
        imageUrl: fallbackImage,
        prompt: imagePrompt,
        fallback: true,
        error: "DALL-E 사용 불가, 폴백 이미지 제공",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("배경 생성 API 오류:", error);
    return errorResponse("배경 이미지 생성 중 오류가 발생했습니다.", 500);
  }
}

export async function OPTIONS() {
  return optionsResponse();
} 