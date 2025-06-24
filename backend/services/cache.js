const { createClient } = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryDelay = 5000; // 5초
    this.maxRetries = 3;
    
    // 캐시 TTL 설정 (초)
    this.TTL = {
      SHORT: 5 * 60,      // 5분 - 실시간성 중요 데이터
      MEDIUM: 15 * 60,    // 15분 - 자주 변경되는 데이터
      LONG: 60 * 60,      // 1시간 - 안정적인 데이터
      VERY_LONG: 24 * 60 * 60  // 24시간 - 거의 변경되지 않는 데이터
    };
  }

  async connect() {
    if (this.isConnected) {
      return true;
    }

    try {
      // Redis 연결 설정
      const redisConfig = {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.error('❌ Redis 최대 재연결 시도 초과');
              return new Error('Redis 연결 실패');
            }
            console.log(`🔄 Redis 재연결 시도 ${retries}/${this.maxRetries}...`);
            return this.retryDelay;
          }
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: process.env.REDIS_DB || 0
      };

      this.client = createClient(redisConfig);

      // 연결 이벤트 리스너
      this.client.on('connect', () => {
        console.log('🔄 Redis 연결 시도 중...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis 연결 성공');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis 연결 오류:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('⚠️ Redis 연결 종료');
        this.isConnected = false;
      });

      // Redis 서버 연결
      await this.client.connect();
      
      // 연결 테스트
      await this.client.ping();
      console.log('✅ Redis 연결 및 테스트 완료');
      
      return true;
    } catch (error) {
      console.error('❌ Redis 연결 실패:', error.message);
      this.isConnected = false;
      
      // Redis가 없어도 서비스는 계속 동작하도록 함
      console.log('⚠️ Redis 없이 계속 진행 (캐싱 비활성화)');
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      console.log('✅ Redis 연결 종료');
    }
    this.isConnected = false;
  }

  // 캐시 키 생성 헬퍼
  generateKey(prefix, ...parts) {
    return `lovlechat:${prefix}:${parts.join(':')}`;
  }

  // GET - 캐시에서 데이터 조회
  async get(key) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        console.log(`🚀 캐시 히트: ${key}`);
        return JSON.parse(data);
      }
      console.log(`⭕ 캐시 미스: ${key}`);
      return null;
    } catch (error) {
      console.error('❌ 캐시 조회 오류:', error.message);
      return null;
    }
  }

  // SET - 캐시에 데이터 저장
  async set(key, data, ttl = this.TTL.MEDIUM) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.setEx(key, ttl, JSON.stringify(data));
      console.log(`💾 캐시 저장: ${key} (TTL: ${ttl}초)`);
      return true;
    } catch (error) {
      console.error('❌ 캐시 저장 오류:', error.message);
      return false;
    }
  }

  // DELETE - 특정 캐시 삭제
  async del(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.del(key);
      if (result > 0) {
        console.log(`🗑️ 캐시 삭제: ${key}`);
      }
      return result > 0;
    } catch (error) {
      console.error('❌ 캐시 삭제 오류:', error.message);
      return false;
    }
  }

  // 패턴으로 여러 키 삭제
  async delPattern(pattern) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        console.log(`🗑️ 패턴 캐시 삭제: ${pattern} (${result}개 키)`);
        return result;
      }
      return 0;
    } catch (error) {
      console.error('❌ 패턴 캐시 삭제 오류:', error.message);
      return 0;
    }
  }

  // 사용자별 캐시 무효화
  async invalidateUserCache(userId) {
    const patterns = [
      this.generateKey('myinfo', userId, '*'),
      this.generateKey('personas', userId, '*'),
      this.generateKey('hearts', userId, '*'),
      this.generateKey('stats', userId, '*')
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.delPattern(pattern);
    }

    console.log(`🔄 사용자 캐시 무효화: ${userId} (${totalDeleted}개 키)`);
    return totalDeleted;
  }

  // 캐시 통계
  async getStats() {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbSize();
      
      return {
        connected: true,
        dbSize,
        memoryInfo: info
      };
    } catch (error) {
      console.error('❌ 캐시 통계 조회 오류:', error.message);
      return { connected: false, error: error.message };
    }
  }

  // 헬스체크
  async healthCheck() {
    if (!this.isConnected) {
      return { healthy: false, message: 'Redis 연결되지 않음' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        healthy: true,
        latency: `${latency}ms`,
        connected: this.isConnected
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }
}

// 싱글톤 인스턴스
const cacheService = new CacheService();

// 캐시 래퍼 함수들
const cacheWrapper = {
  // MyInfo 캐시
  async getMyInfo(userId) {
    const key = cacheService.generateKey('myinfo', userId);
    return await cacheService.get(key);
  },

  async setMyInfo(userId, data) {
    const key = cacheService.generateKey('myinfo', userId);
    return await cacheService.set(key, data, cacheService.TTL.SHORT);
  },

  // 사용자 통계 캐시
  async getUserStats(userId) {
    const key = cacheService.generateKey('stats', userId);
    return await cacheService.get(key);
  },

  async setUserStats(userId, stats) {
    const key = cacheService.generateKey('stats', userId);
    return await cacheService.set(key, stats, cacheService.TTL.MEDIUM);
  },

  // 캐릭터 캐시
  async getCharacter(characterId) {
    const key = cacheService.generateKey('character', characterId);
    return await cacheService.get(key);
  },

  async setCharacter(characterId, data) {
    const key = cacheService.generateKey('character', characterId);
    return await cacheService.set(key, data, cacheService.TTL.LONG);
  },

  // 하트 잔액 캐시
  async getHearts(userId) {
    const key = cacheService.generateKey('hearts', userId);
    return await cacheService.get(key);
  },

  async setHearts(userId, hearts) {
    const key = cacheService.generateKey('hearts', userId);
    return await cacheService.set(key, hearts, cacheService.TTL.SHORT);
  },

  // 호감도 캐시
  async getFavor(personaId, characterId) {
    const key = cacheService.generateKey('favor', personaId, characterId);
    return await cacheService.get(key);
  },

  async setFavor(personaId, characterId, favorData) {
    const key = cacheService.generateKey('favor', personaId, characterId);
    return await cacheService.set(key, favorData, cacheService.TTL.SHORT);
  }
};

module.exports = {
  cacheService,
  cacheWrapper
}; 