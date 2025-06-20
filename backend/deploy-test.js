// 배포 후 RDS 연결 테스트 스크립트
const testDeployment = async (backendUrl) => {
  console.log('🚀 배포 환경 테스트 시작...');
  
  const tests = [
    {
      name: 'DB 연결 테스트',
      url: `${backendUrl}/api/test-db`,
      method: 'GET'
    },
    {
      name: '하트 시스템 테스트',
      url: `${backendUrl}/api/hearts?userId=test`,
      method: 'GET'
    },
    {
      name: '캐릭터 목록 테스트',
      url: `${backendUrl}/api/character`,
      method: 'GET'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n🔍 ${test.name} 실행 중...`);
      const response = await fetch(test.url, { method: test.method });
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${test.name} 성공`);
        console.log(`   응답: ${JSON.stringify(data).substring(0, 100)}...`);
      } else {
        console.log(`❌ ${test.name} 실패: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} 에러: ${error.message}`);
    }
  }
  
  console.log('\n🎉 배포 테스트 완료!');
};

// 사용법: node deploy-test.js https://your-backend-url.vercel.app
const backendUrl = process.argv[2];
if (backendUrl) {
  testDeployment(backendUrl);
} else {
  console.log('사용법: node deploy-test.js https://your-backend-url.vercel.app');
} 