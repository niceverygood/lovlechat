const express = require('express');
const router = express.Router();
const { executeQuery } = require('../services/db');
const { cacheService } = require('../services/cache');

// 메모리에 저장되는 성능 메트릭 (간단한 예시)
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: new Map(), // API별 호출 통계
      responseTimes: [], // 최근 응답 시간
      errors: [], // 최근 에러
      systemStats: {
        startTime: Date.now(),
        totalRequests: 0,
        totalErrors: 0
      }
    };
    
    // 데이터 정리 (최대 1000개 기록만 유지)
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5분마다
  }

  recordApiCall(endpoint, duration, status, error = null) {
    const now = Date.now();
    
    // API별 통계
    if (!this.metrics.apiCalls.has(endpoint)) {
      this.metrics.apiCalls.set(endpoint, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastCall: now
      });
    }
    
    const apiStat = this.metrics.apiCalls.get(endpoint);
    apiStat.count++;
    apiStat.totalTime += duration;
    apiStat.avgTime = Math.round(apiStat.totalTime / apiStat.count);
    apiStat.minTime = Math.min(apiStat.minTime, duration);
    apiStat.maxTime = Math.max(apiStat.maxTime, duration);
    apiStat.lastCall = now;
    
    if (status >= 400 || error) {
      apiStat.errors++;
      this.metrics.systemStats.totalErrors++;
      
      // 에러 기록
      this.metrics.errors.push({
        timestamp: now,
        endpoint,
        status,
        error: error?.message || 'Unknown error',
        duration
      });
    }
    
    // 응답 시간 기록
    this.metrics.responseTimes.push({
      timestamp: now,
      endpoint,
      duration,
      status
    });
    
    this.metrics.systemStats.totalRequests++;
  }

  cleanup() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // 1시간 이전 데이터 제거
    this.metrics.responseTimes = this.metrics.responseTimes
      .filter(item => item.timestamp > oneHourAgo)
      .slice(-1000); // 최대 1000개
      
    this.metrics.errors = this.metrics.errors
      .filter(item => item.timestamp > oneHourAgo)
      .slice(-100); // 최대 100개
  }

  getStats() {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);

    // 최근 1분, 5분, 1시간 통계
    const recentResponseTimes = this.metrics.responseTimes.filter(item => item.timestamp > oneMinuteAgo);
    const recent5minResponseTimes = this.metrics.responseTimes.filter(item => item.timestamp > fiveMinutesAgo);
    const recent1hourResponseTimes = this.metrics.responseTimes.filter(item => item.timestamp > oneHourAgo);

    const calculateAvg = (arr) => arr.length > 0 ? Math.round(arr.reduce((sum, item) => sum + item.duration, 0) / arr.length) : 0;

    return {
      system: {
        uptime: now - this.metrics.systemStats.startTime,
        totalRequests: this.metrics.systemStats.totalRequests,
        totalErrors: this.metrics.systemStats.totalErrors,
        errorRate: this.metrics.systemStats.totalRequests > 0 
          ? ((this.metrics.systemStats.totalErrors / this.metrics.systemStats.totalRequests) * 100).toFixed(2)
          : 0
      },
      performance: {
        last1min: {
          requests: recentResponseTimes.length,
          avgResponseTime: calculateAvg(recentResponseTimes),
          errors: recentResponseTimes.filter(item => item.status >= 400).length
        },
        last5min: {
          requests: recent5minResponseTimes.length,
          avgResponseTime: calculateAvg(recent5minResponseTimes),
          errors: recent5minResponseTimes.filter(item => item.status >= 400).length
        },
        last1hour: {
          requests: recent1hourResponseTimes.length,
          avgResponseTime: calculateAvg(recent1hourResponseTimes),
          errors: recent1hourResponseTimes.filter(item => item.status >= 400).length
        }
      },
      apis: Array.from(this.metrics.apiCalls.entries()).map(([endpoint, stats]) => ({
        endpoint,
        ...stats,
        errorRate: stats.count > 0 ? ((stats.errors / stats.count) * 100).toFixed(2) : 0
      })),
      recentErrors: this.metrics.errors.slice(-10), // 최근 10개 에러
      responseTimeChart: this.metrics.responseTimes.slice(-50).map(item => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        duration: item.duration,
        endpoint: item.endpoint
      }))
    };
  }
}

const monitor = new PerformanceMonitor();

// 미들웨어: API 호출 모니터링
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endpoint = req.path;
    monitor.recordApiCall(endpoint, duration, res.statusCode);
  });
  
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    const endpoint = req.path;
    monitor.recordApiCall(endpoint, duration, 500, error);
  });
  
  next();
};

// GET /api/monitoring/stats - 실시간 성능 통계
router.get('/stats', async (req, res) => {
  try {
    const stats = monitor.getStats();
    
    // Redis 캐시 통계 추가
    const cacheStats = await cacheService.getStats();
    stats.cache = cacheStats;
    
    // DB 연결 확인
    try {
      await executeQuery('SELECT 1 as test');
      stats.database = { connected: true, healthy: true };
    } catch (dbError) {
      stats.database = { connected: false, healthy: false, error: dbError.message };
    }
    
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    console.error('모니터링 통계 조회 에러:', error);
    res.status(500).json({
      ok: false,
      error: '모니터링 데이터를 불러올 수 없습니다.'
    });
  }
});

// GET /api/monitoring/health - 종합 헬스체크
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  try {
    // DB 헬스체크
    try {
      await executeQuery('SELECT 1 as test');
      health.checks.database = { status: 'healthy', responseTime: Date.now() - startTime };
    } catch (dbError) {
      health.checks.database = { status: 'unhealthy', error: dbError.message };
      health.status = 'unhealthy';
    }

    // Redis 헬스체크
    const cacheHealth = await cacheService.healthCheck();
    health.checks.cache = cacheHealth.healthy 
      ? { status: 'healthy', latency: cacheHealth.latency }
      : { status: 'unhealthy', error: cacheHealth.message };

    // 시스템 메트릭
    const stats = monitor.getStats();
    health.checks.system = {
      status: stats.system.errorRate < 5 ? 'healthy' : 'degraded',
      uptime: stats.system.uptime,
      errorRate: `${stats.system.errorRate}%`,
      totalRequests: stats.system.totalRequests
    };

    res.json(health);
  } catch (error) {
    console.error('헬스체크 에러:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// GET /api/monitoring/metrics - 상세 메트릭 (Prometheus 형식)
router.get('/metrics', (req, res) => {
  try {
    const stats = monitor.getStats();
    
    // Prometheus 형식으로 메트릭 출력
    let metrics = '';
    
    metrics += `# HELP lovlechat_http_requests_total Total number of HTTP requests\n`;
    metrics += `# TYPE lovlechat_http_requests_total counter\n`;
    metrics += `lovlechat_http_requests_total ${stats.system.totalRequests}\n\n`;
    
    metrics += `# HELP lovlechat_http_errors_total Total number of HTTP errors\n`;
    metrics += `# TYPE lovlechat_http_errors_total counter\n`;
    metrics += `lovlechat_http_errors_total ${stats.system.totalErrors}\n\n`;
    
    metrics += `# HELP lovlechat_http_request_duration_ms HTTP request duration in milliseconds\n`;
    metrics += `# TYPE lovlechat_http_request_duration_ms histogram\n`;
    
    stats.apis.forEach(api => {
      metrics += `lovlechat_http_request_duration_ms{endpoint="${api.endpoint}"} ${api.avgTime}\n`;
    });
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    console.error('메트릭 조회 에러:', error);
    res.status(500).send('# Error generating metrics');
  }
});

module.exports = { router, monitoringMiddleware, monitor }; 