// src/lib/openai.ts

// 환경별 API URL 설정 (동적)
const getApiBaseUrl = () => {
  // 환경 변수에서 API URL 확인
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // 프로덕션 환경 - EC2 백엔드 사용
  if (process.env.NODE_ENV === 'production') {
    // EC2 백엔드 서버 URL
    return 'http://54.79.211.48:3002';
  }
  
  // 개발 환경 - Express 백엔드 포트 3002로 연결
  return 'http://localhost:3002';
};

export const API_BASE_URL = getApiBaseUrl();

// 요청 타임아웃 설정
const REQUEST_TIMEOUT = process.env.NODE_ENV === 'production' ? 30000 : 10000;

// 재시도 설정
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// 재시도 헬퍼 함수
const withRetry = async (fn: () => Promise<Response>, retries = MAX_RETRIES): Promise<Response> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      console.log(`API 요청 재시도... 남은 횟수: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
};

// 재시도 가능한 에러 체크
const shouldRetry = (error: any): boolean => {
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) return true;
  if (error.name === 'AbortError') return false; // 타임아웃은 재시도하지 않음
  return false;
};

// CORS 대응 fetch 래퍼 (성능 최적화)
export const corsRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // 타임아웃 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    ...(options.headers || {})
  };
  
  const requestOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
    mode: 'cors',
    credentials: 'omit',
    signal: controller.signal
  };
  
  try {
    console.log('🌐 API Request:', { url, method: options.method || 'GET' });
    
    const response = await withRetry(async () => {
      return await fetch(url, requestOptions);
    });
    
    clearTimeout(timeoutId);
    
    console.log('✅ API Response:', { 
      status: response.status, 
      ok: response.ok,
      url: response.url 
    });
    
    // CORS 에러 확인
    if (!response.ok && response.status === 0) {
      throw new Error('CORS error: API 서버와 연결할 수 없습니다.');
    }
    
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('❌ API Request failed:', { url, error: error.message });
    
    if (error.name === 'AbortError') {
      throw new Error(`요청 시간 초과: ${REQUEST_TIMEOUT}ms 이내에 응답이 없습니다.`);
    }
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('네트워크 오류: API 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
    
    throw error;
  }
};

// 간편한 GET 요청 헬퍼 (캐싱 지원)
export const apiGet = async (endpoint: string, useCache = false) => {
  // 간단한 메모리 캐싱 (개발용)
  if (useCache && typeof window !== 'undefined') {
    const cacheKey = `api_${endpoint}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // 5분 캐싱
      if (Date.now() - timestamp < 300000) {
        console.log('💾 Cache hit:', endpoint);
        return data;
      }
    }
  }
  
  const response = await corsRequest(endpoint, { method: 'GET' });
  const data = await response.json();
  
  // 캐싱 저장
  if (useCache && typeof window !== 'undefined') {
    const cacheKey = `api_${endpoint}`;
    sessionStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }
  
  return data;
};

// 간편한 POST 요청 헬퍼
export const apiPost = async (endpoint: string, data: any) => {
  const response = await corsRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return await response.json();
};

// 간편한 PUT 요청 헬퍼
export const apiPut = async (endpoint: string, data: any) => {
  const response = await corsRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return await response.json();
};

// 간편한 DELETE 요청 헬퍼
export const apiDelete = async (endpoint: string) => {
  const response = await corsRequest(endpoint, { method: 'DELETE' });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return await response.json();
};

// API URL 확인 함수 (디버깅용)
export const getApiUrl = () => API_BASE_URL;
