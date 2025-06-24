const { executeQuery, executeMutation } = require('./services/db');
const { filterFavorKeywords } = require('./services/favorCalculator');

/**
 * 기존 채팅 데이터에서 호감도 관련 키워드를 정리하는 스크립트
 */
async function cleanFavorKeywords() {
  try {
    console.log('🧹 호감도 관련 키워드 정리 시작...');
    
    // 모든 채팅 메시지 조회
    const messages = await executeQuery(
      'SELECT id, message FROM chats WHERE message LIKE "%호감도%" OR message LIKE "%점수%" OR message LIKE "%관계%" OR message LIKE "%친밀도%"'
    );
    
    console.log(`📊 정리할 메시지 수: ${messages.length}`);
    
    let cleanedCount = 0;
    
    for (const msg of messages) {
      const originalMessage = msg.message;
      const cleanedMessage = filterFavorKeywords(originalMessage);
      
      // 메시지가 변경된 경우에만 업데이트
      if (originalMessage !== cleanedMessage) {
        await executeMutation(
          'UPDATE chats SET message = ? WHERE id = ?',
          [cleanedMessage, msg.id]
        );
        cleanedCount++;
        console.log(`✅ 메시지 ${msg.id} 정리 완료`);
        console.log(`   Before: ${originalMessage.substring(0, 50)}...`);
        console.log(`   After:  ${cleanedMessage.substring(0, 50)}...`);
      }
    }
    
    console.log(`🎉 호감도 키워드 정리 완료! 총 ${cleanedCount}개 메시지 정리됨`);
    
  } catch (error) {
    console.error('❌ 호감도 키워드 정리 중 에러:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  cleanFavorKeywords()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { cleanFavorKeywords }; 