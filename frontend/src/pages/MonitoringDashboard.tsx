import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import BottomNav from '../components/BottomNav';

interface SystemStats {
  uptime: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: string;
}

interface PerformanceStats {
  last1min: {
    requests: number;
    avgResponseTime: number;
    errors: number;
  };
  last5min: {
    requests: number;
    avgResponseTime: number;
    errors: number;
  };
  last1hour: {
    requests: number;
    avgResponseTime: number;
    errors: number;
  };
}

interface ApiStats {
  endpoint: string;
  count: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  errors: number;
  errorRate: string;
  lastCall: number;
}

interface CacheStats {
  connected: boolean;
  dbSize?: number;
  memoryInfo?: string;
}

interface DatabaseStats {
  connected: boolean;
  healthy: boolean;
  error?: string;
}

interface MonitoringData {
  system: SystemStats;
  performance: PerformanceStats;
  apis: ApiStats[];
  cache: CacheStats;
  database: DatabaseStats;
  responseTimeChart: Array<{
    time: string;
    duration: number;
    endpoint: string;
  }>;
  recentErrors: Array<{
    timestamp: number;
    endpoint: string;
    status: number;
    error: string;
    duration: number;
  }>;
}

const MonitoringDashboard: React.FC = () => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await apiGet<{ stats: MonitoringData }>('/api/monitoring/stats');
      setData(response.stats);
      setError(null);
    } catch (err: any) {
      console.error('모니터링 데이터 로딩 에러:', err);
      setError(err.message || '모니터링 데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 자동 새로고침
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 10000); // 10초마다

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (healthy: boolean): string => {
    return healthy ? '#4CAF50' : '#f44336';
  };

  const getPerformanceColor = (avgTime: number): string => {
    if (avgTime < 100) return '#4CAF50'; // 좋음
    if (avgTime < 500) return '#FF9800'; // 보통
    return '#f44336'; // 느림
  };

  if (loading) {
    return (
      <div style={{ 
        background: 'var(--color-bg)', 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#fff',
        fontSize: 18,
        fontWeight: 600
      }}>
        모니터링 데이터 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        background: 'var(--color-bg)', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#f44336',
        fontSize: 18,
        fontWeight: 600,
        gap: 20
      }}>
        <div>모니터링 데이터 로딩 실패</div>
        <div style={{ fontSize: 14, color: '#999' }}>{error}</div>
        <button 
          onClick={fetchData}
          style={{
            background: '#ff4081',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ 
      background: 'var(--color-bg)', 
      minHeight: '100vh', 
      paddingBottom: 80,
      color: '#fff'
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          📊 실시간 모니터링
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            자동 새로고침
          </label>
          <button
            onClick={fetchData}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* 시스템 상태 카드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          {/* 시스템 개요 */}
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
              🖥️ 시스템 상태
            </h3>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <div><strong>업타임:</strong> {formatUptime(data.system.uptime)}</div>
              <div><strong>총 요청:</strong> {data.system.totalRequests.toLocaleString()}</div>
              <div><strong>총 에러:</strong> {data.system.totalErrors.toLocaleString()}</div>
              <div style={{ color: parseFloat(data.system.errorRate) > 5 ? '#f44336' : '#4CAF50' }}>
                <strong>에러율:</strong> {data.system.errorRate}%
              </div>
            </div>
          </div>

          {/* 데이터베이스 상태 */}
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
              🗄️ 데이터베이스
            </h3>
            <div style={{ 
              fontSize: 14, 
              color: getStatusColor(data.database.healthy),
              fontWeight: 600
            }}>
              {data.database.healthy ? '✅ 정상' : '❌ 오류'}
            </div>
            {data.database.error && (
              <div style={{ fontSize: 12, color: '#f44336', marginTop: 8 }}>
                {data.database.error}
              </div>
            )}
          </div>

          {/* 캐시 상태 */}
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
              🚀 Redis 캐시
            </h3>
            <div style={{ 
              fontSize: 14, 
              color: getStatusColor(data.cache.connected),
              fontWeight: 600
            }}>
              {data.cache.connected ? '✅ 연결됨' : '❌ 연결 안됨'}
            </div>
            {data.cache.connected && data.cache.dbSize !== undefined && (
              <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                캐시 키: {data.cache.dbSize}개
              </div>
            )}
          </div>
        </div>

        {/* 성능 메트릭 */}
        <div style={{
          background: 'var(--color-card)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #333',
          marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600 }}>
            ⚡ 성능 메트릭
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 20
          }}>
            {/* 최근 1분 */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#4CAF50' }}>최근 1분</h4>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <div>요청: {data.performance.last1min.requests}개</div>
                <div style={{ color: getPerformanceColor(data.performance.last1min.avgResponseTime) }}>
                  평균 응답: {data.performance.last1min.avgResponseTime}ms
                </div>
                <div style={{ color: data.performance.last1min.errors > 0 ? '#f44336' : '#4CAF50' }}>
                  에러: {data.performance.last1min.errors}개
                </div>
              </div>
            </div>

            {/* 최근 5분 */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#FF9800' }}>최근 5분</h4>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <div>요청: {data.performance.last5min.requests}개</div>
                <div style={{ color: getPerformanceColor(data.performance.last5min.avgResponseTime) }}>
                  평균 응답: {data.performance.last5min.avgResponseTime}ms
                </div>
                <div style={{ color: data.performance.last5min.errors > 0 ? '#f44336' : '#4CAF50' }}>
                  에러: {data.performance.last5min.errors}개
                </div>
              </div>
            </div>

            {/* 최근 1시간 */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#2196F3' }}>최근 1시간</h4>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <div>요청: {data.performance.last1hour.requests}개</div>
                <div style={{ color: getPerformanceColor(data.performance.last1hour.avgResponseTime) }}>
                  평균 응답: {data.performance.last1hour.avgResponseTime}ms
                </div>
                <div style={{ color: data.performance.last1hour.errors > 0 ? '#f44336' : '#4CAF50' }}>
                  에러: {data.performance.last1hour.errors}개
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API 엔드포인트 통계 */}
        <div style={{
          background: 'var(--color-card)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #333',
          marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600 }}>
            📊 API 엔드포인트 통계
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>엔드포인트</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>호출수</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>평균</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>최소</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>최대</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>에러율</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>마지막 호출</th>
                </tr>
              </thead>
              <tbody>
                {data.apis.slice(0, 10).map((api, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{api.endpoint}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{api.count.toLocaleString()}</td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'right',
                      color: getPerformanceColor(api.avgTime)
                    }}>
                      {api.avgTime}ms
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{api.minTime}ms</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{api.maxTime}ms</td>
                    <td style={{ 
                      padding: '12px 8px', 
                      textAlign: 'right',
                      color: parseFloat(api.errorRate) > 5 ? '#f44336' : '#4CAF50'
                    }}>
                      {api.errorRate}%
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: 12 }}>
                      {formatTime(api.lastCall)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 최근 에러 로그 */}
        {data.recentErrors.length > 0 && (
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600 }}>
              ⚠️ 최근 에러 로그
            </h3>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              {data.recentErrors.map((error, index) => (
                <div key={index} style={{
                  background: '#2a1f1f',
                  border: '1px solid #f44336',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                  fontFamily: 'monospace'
                }}>
                  <div style={{ color: '#f44336', fontWeight: 600 }}>
                    [{formatTime(error.timestamp)}] {error.status} {error.endpoint}
                  </div>
                  <div style={{ color: '#999', marginTop: 4 }}>
                    {error.error} ({error.duration}ms)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default MonitoringDashboard; 