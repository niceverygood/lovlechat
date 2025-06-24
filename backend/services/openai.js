const OpenAI = require('openai');

let openai = null;

// OpenAI 클라이언트 초기화
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30000, // 30초 타임아웃
      });
      console.log('🤖 OpenAI 클라이언트 초기화 완료');
    } catch (error) {
      console.error('OpenAI 클라이언트 초기화 실패:', error);
      return null;
    }
  }
  return openai;
}

// OpenAI API 사용 가능 여부 확인
function isOpenAIAvailable() {
  return !!process.env.OPENAI_API_KEY && !!getOpenAI();
}

// 채팅 완성 요청
async function createChatCompletion(messages, options = {}) {
  const client = getOpenAI();
  if (!client) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다');
  }

  try {
    const response = await client.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages,
      max_tokens: options.max_tokens || 500,
      temperature: options.temperature || 0.8,
      frequency_penalty: 0.3,
      presence_penalty: 0.3,
      ...options
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI 응답이 비어있습니다');
    }

    return content.trim();
  } catch (error) {
    console.error('OpenAI API 에러:', error);
    
    // 특정 에러에 따른 처리
    if (error.code === 'rate_limit_exceeded') {
      throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    } else if (error.code === 'insufficient_quota') {
      throw new Error('API 할당량이 부족합니다.');
    } else if (error.code === 'invalid_request_error') {
      throw new Error('잘못된 요청입니다.');
    }
    
    throw error;
  }
}

// 이미지 생성 요청
async function createImage(prompt, options = {}) {
  const client = getOpenAI();
  if (!client) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다');
  }

  try {
    const response = await client.images.generate({
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard',
      model: options.model || 'dall-e-3',
      ...options
    });

    return response.data[0]?.url || '';
  } catch (error) {
    console.error('OpenAI 이미지 생성 에러:', error);
    throw error;
  }
}

// 개선된 폴백 응답 생성
function generateFallbackResponse(characterName, situation = '', userMessage = '') {
  const greetings = [
    `안녕! 나는 ${characterName}이야~`,
    `${characterName}이라고 해! 반가워!`,
    `어머, 안녕하세요! ${characterName}입니다`,
    `하이~ ${characterName}야! 잘 부탁해!`
  ];

  const casualResponses = [
    `그렇구나! 더 자세히 얘기해줄래?`,
    `와, 정말? 흥미로운데!`,
    `아하~ 그런 일이 있었구나`,
    `오~ 재미있네! 나도 그런 경험 있어`,
    `그거 완전 공감돼! 나도 비슷한 생각이야`
  ];

  const questions = [
    `너는 어떤 일을 할 때 가장 즐거워?`,
    `오늘 하루 어떻게 보냈어?`,
    `좋아하는 음식이나 취미가 있어?`,
    `가장 기억에 남는 추억이 뭐야?`,
    `요즘 관심사나 고민이 있다면?`
  ];

  // 사용자 메시지가 있으면 그에 대한 응답, 없으면 인사말
  if (userMessage && userMessage.trim()) {
    const responses = Math.random() > 0.5 ? casualResponses : questions;
    return responses[Math.floor(Math.random() * responses.length)];
  } else {
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

// 채팅 컨텍스트 생성
function createChatContext(character, previousMessages = []) {
  const systemPrompt = `당신은 ${character.name}입니다.

캐릭터 정보:
- 이름: ${character.name}
- 나이: ${character.age || '비공개'}
- 직업: ${character.job || '비공개'}
- 성격: ${character.personality || '친근하고 활발한 성격'}
- 습관: ${character.habit || '특별한 습관은 없음'}
- 배경: ${character.background || '평범한 일상을 살고 있음'}

대화 규칙:
1. 이 캐릭터의 성격과 설정에 맞게 자연스럽게 대화하세요
2. 반말을 사용하되, 친근하고 다정한 톤을 유지하세요
3. 너무 길지 않게, 2-3문장 정도로 답변하세요
4. 상대방에게 관심을 보이고 질문도 가끔 던져보세요
5. 캐릭터의 개성이 드러나도록 말투나 표현을 사용하세요

첫 상황: ${character.firstScene || '일상적인 만남에서 대화를 시작합니다'}`;

  return systemPrompt;
}

// 몰입형 프롬프트 생성 (캐릭터+페르소나+대화내역)
function generateImmersivePrompt(character, persona, chatHistory = []) {
  return `
[세계관/설정]
- 당신은 ${character.name}입니다. (아래 캐릭터와 페르소나 정보를 참고해 몰입감 있게 연기하세요.)

[캐릭터 정보]
- 이름: ${character.name}
- 나이: ${character.age || '비공개'}
- 직업: ${character.job || '비공개'}
- 성격: ${character.personality || '비공개'}
- 습관: ${character.habit || '비공개'}
- 배경: ${character.background || '비공개'}
- 첫 상황: ${character.firstScene || '비공개'}

[상대(페르소나) 정보]
- 이름: ${persona?.name || '비공개'}
- 나이: ${persona?.age || '비공개'}
- 성별: ${persona?.gender || '비공개'}
- 직업: ${persona?.job || '비공개'}
- 특징/소개: ${persona?.info || '비공개'}
- 습관: ${persona?.habit || '비공개'}

[대화 규칙]
1. 반드시 ${character.name}의 세계관과 성격에 맞게 답변하세요.
2. 상대(페르소나)의 정보와 이전 대화 맥락을 적극 반영하세요.
3. 반말, 친근한 말투, 개성 있는 표현을 사용하세요.
4. 호감도/점수/게임 시스템 언급은 절대 금지.
5. 답변은 2~3문장 이내로 자연스럽게.
  `.trim();
}

module.exports = {
  getOpenAI,
  isOpenAIAvailable,
  createChatCompletion,
  createImage,
  generateFallbackResponse,
  createChatContext,
  generateImmersivePrompt,
}; 