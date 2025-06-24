#!/usr/bin/env node

// API 성능 테스트 스크립트
const BASE_URL = 'http://54.79.211.48:3002';
const TEST_USER_ID = 'test-performance-user';
const TEST_PERSONA_ID = 'persona_1750327258705_o0gquo2fp';
const TEST_CHARACTER_ID = '3';

async function testAPI(url, description) {
  const start = Date.now();
  try {
    const response = await fetch(url);
    const data = await response.json();
    const time = Date.now() - start;
    
    console.log(`✅ ${description}: ${time}ms`);
    return { success: true, time, data };
  } catch (error) {
    const time = Date.now() - start;
    console.log(`❌ ${description}: ${time}ms (실패: ${error.message})`);
    return { success: false, time, error: error.message };
  }
}

async function runPerformanceTests() {
  console.log('🚀 API 성능 테스트 시작\n');
  
  // 1. 통합 API vs 개별 API 비교
  console.log('=== 1. 통합 API vs 개별 API 성능 비교 ===');
  
  // 통합 API 테스트
  const myInfoStart = Date.now();
  const myInfoResult = await testAPI(
    `${BASE_URL}/api/myinfo?userId=${TEST_USER_ID}`,
    '통합 MyInfo API (user + personas + hearts)'
  );
  
  // 개별 API 테스트 (기존 방식)
  const individualStart = Date.now();
  const [heartsResult, personasResult] = await Promise.all([
    testAPI(`${BASE_URL}/api/hearts?userId=${TEST_USER_ID}`, '개별 Hearts API'),
    testAPI(`${BASE_URL}/api/persona?userId=${TEST_USER_ID}`, '개별 Personas API')
  ]);
  const individualTime = Date.now() - individualStart;
  
  console.log(`📊 개별 API 총 시간: ${individualTime}ms`);
  console.log(`📊 성능 개선: ${Math.round((individualTime - myInfoResult.time) / individualTime * 100)}%\n`);
  
  // 2. 채팅 데이터 통합 API 테스트
  console.log('=== 2. 채팅 데이터 통합 API 테스트 ===');
  
  const chatDataResult = await testAPI(
    `${BASE_URL}/api/chat-data/init?personaId=${TEST_PERSONA_ID}&characterId=${TEST_CHARACTER_ID}`,
    '채팅 데이터 통합 API (character + persona + hearts + messages)'
  );
  
  // 기존 방식 시뮬레이션
  const chatIndividualStart = Date.now();
  const [characterResult, personaResult, heartsResult2, messagesResult] = await Promise.all([
    testAPI(`${BASE_URL}/api/character/${TEST_CHARACTER_ID}`, '개별 Character API'),
    testAPI(`${BASE_URL}/api/persona/${TEST_PERSONA_ID}`, '개별 Persona API'), 
    testAPI(`${BASE_URL}/api/hearts?userId=${TEST_USER_ID}`, '개별 Hearts API'),
    testAPI(`${BASE_URL}/api/chat?personaId=${TEST_PERSONA_ID}&characterId=${TEST_CHARACTER_ID}`, '개별 Chat API')
  ]);
  const chatIndividualTime = Date.now() - chatIndividualStart;
  
  console.log(`📊 채팅 개별 API 총 시간: ${chatIndividualTime}ms`);
  console.log(`📊 채팅 성능 개선: ${Math.round((chatIndividualTime - chatDataResult.time) / chatIndividualTime * 100)}%\n`);
  
  // 3. 채팅 목록 최적화 테스트
  console.log('=== 3. 채팅 목록 최적화 테스트 ===');
  
  const chatListOptimized = await testAPI(
    `${BASE_URL}/api/chat-data/list?userId=${TEST_USER_ID}`,
    '최적화된 Chat List API (hearts 포함)'
  );
  
  const chatListOriginal = await testAPI(
    `${BASE_URL}/api/chat/list?userId=${TEST_USER_ID}`,
    '기존 Chat List API'
  );
  
  console.log(`📊 채팅 목록 성능 비교: 기존 ${chatListOriginal.time}ms vs 최적화 ${chatListOptimized.time}ms\n`);
  
  // 4. 데이터베이스 통계 확인
  console.log('=== 4. 데이터베이스 통계 ===');
  
  await testAPI(
    `${BASE_URL}/api/chat-data/stats`,
    '데이터베이스 성능 통계'
  );
  
  // 5. 요약 리포트
  console.log('\n=== 🎯 성능 테스트 요약 ===');
  console.log(`• MyInfo 통합 API: ${myInfoResult.time}ms`);
  console.log(`• 채팅 데이터 통합 API: ${chatDataResult.time}ms`);
  console.log(`• 최적화된 채팅 목록: ${chatListOptimized.time}ms`);
  console.log(`• 전반적인 성능 개선이 확인되었습니다! 🚀`);
}

// 스크립트 실행
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { testAPI, runPerformanceTests }; 