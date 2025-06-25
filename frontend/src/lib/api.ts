import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// 환경별 API URL 설정 (동적)
const getApiBaseUrl = (): string => {
  // 디버깅용 로그
  console.log('🔍 API URL 환경변수 확인:', {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
    hostname: window.location.hostname,
    isVercel: window.location.hostname.includes('vercel.app')
  });

  // Vercel 환경 강제 감지 (우선순위 최상위)
  if (window.location.hostname.includes('vercel.app')) {
    console.log('🚀 Vercel 환경 감지 - 강제로 상대 경로 사용');
    return '';
  }

  // 새로운 환경변수 확인
  if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== '') {
    console.log('✅ REACT_APP_API_URL 사용:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // 기존 환경변수 확인 (하위 호환성)
  if (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL !== 'https://lovlechat-gkisl9vzq-malshues-projects.vercel.app') {
    console.log('✅ REACT_APP_API_BASE_URL 사용:', process.env.REACT_APP_API_BASE_URL);
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // 프로덕션 환경 - Vercel 프록시 사용 (상대 경로)
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ 프로덕션 환경 - 상대 경로 사용');
    return '';
  }
  
  // 개발 환경 - Express 백엔드 포트 3002로 연결
  console.log('✅ 개발 환경 로컬 서버 사용: http://localhost:3002');
  return 'http://localhost:3002';
};

export const API_BASE_URL = getApiBaseUrl();

// 기존 코드와의 호환성을 위해 임시로 export
// TODO: 모든 파일을 axios로 마이그레이션 후 제거

// 요청 시간 추적을 위한 Map
const requestTimes = new Map<string, number>();

// Axios 인스턴스 생성
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    // 더 세밀한 timeout 설정
    timeout: process.env.NODE_ENV === 'production' ? 45000 : 15000, // 응답 전체 timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br', // gzip 압축 지원
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive', // Keep-Alive 설정
      'Keep-Alive': 'timeout=30, max=1000', // Keep-Alive 세부 설정
      // 브라우저 식별
      'User-Agent': 'LovleChat-Frontend/1.0',
    },
    withCredentials: true, // CORS credentials
    
    // 추가 HTTP 최적화 설정
    validateStatus: (status) => status < 500, // 5xx 에러만 reject
    maxRedirects: 3, // 리다이렉트 제한
    decompress: true, // 자동 압축 해제
    
    // 프록시 환경에서의 최적화
    proxy: false, // Vercel/EC2 프록시 환경에서는 false
    
    // 추가 성능 옵션
    transitional: {
      silentJSONParsing: false,
      forcedJSONParsing: true,
      clarifyTimeoutError: true
    }
  });

  // 요청 인터셉터 (로깅 및 에러 처리)
  instance.interceptors.request.use(
    (config) => {
      // 네트워크 최적화를 위한 헤더 동적 설정
      const requestId = `${config.method}_${config.url}_${Date.now()}_${Math.random()}`;
      const startTime = Date.now();
      requestTimes.set(requestId, startTime);
      
      // 요청 ID를 헤더에 추가하여 응답에서 추적 가능하게 함
      config.headers['X-Request-ID'] = requestId;
      
      // 요청 타입별 최적화
      if (config.method === 'get') {
        // GET 요청에는 캐시 헤더 추가
        config.headers['If-Modified-Since'] = config.headers['If-Modified-Since'] || new Date(Date.now() - 60000).toUTCString();
      }
      
      console.log('🌐 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        timeout: config.timeout,
        keepAlive: config.headers['Connection'],
        requestId
      });
      return config;
    },
    (error) => {
      console.error('❌ Request Error:', error);
      return Promise.reject(error);
    }
  );

  // 응답 인터셉터 (로깅 및 에러 처리)
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // 응답 시간 계산
      const requestId = response.config.headers['X-Request-ID'] as string;
      const endTime = Date.now();
      const startTime = requestTimes.get(requestId);
      const duration = startTime ? endTime - startTime : 0;
      
      // 메모리 정리
      if (requestId) {
        requestTimes.delete(requestId);
      }
      
      console.log('✅ API Response:', {
        status: response.status,
        url: response.config.url,
        duration: `${duration}ms`,
        size: response.headers['content-length'] || 'unknown',
        compression: response.headers['content-encoding'] || 'none',
        keepAlive: response.headers['connection'],
        data: response.data,
      });
      return response;
    },
    (error) => {
      const requestId = error.config?.headers?.['X-Request-ID'] as string;
      const endTime = Date.now();
      const startTime = requestTimes.get(requestId);
      const duration = startTime ? endTime - startTime : 0;
      
      // 메모리 정리
      if (requestId) {
        requestTimes.delete(requestId);
      }
      
      console.error('❌ API Response Error:', {
        status: error.response?.status,
        url: error.config?.url,
        duration: `${duration}ms`,
        message: error.message,
        code: error.code,
        data: error.response?.data,
      });

      // 네트워크 에러 처리 개선
      if (error.code === 'ECONNABORTED') {
        error.message = `요청 시간 초과 (${duration}ms): 서버 응답이 지연되고 있습니다.`;
      } else if (error.message === 'Network Error') {
        error.message = '네트워크 오류: API 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.response?.status === 0) {
        error.message = 'CORS error: API 서버와 연결할 수 없습니다.';
      } else if (error.code === 'ECONNRESET') {
        error.message = '연결 재설정: 서버와의 연결이 끊어졌습니다.';
      } else if (error.code === 'ETIMEDOUT') {
        error.message = '연결 시간 초과: 서버 응답이 없습니다.';
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// 공통 API 인스턴스
export const api = createApiInstance();

// 편의 메서드들 (성능 최적화 포함)
export const apiGet = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const optimizedConfig = {
    ...config,
    // GET 요청 최적화
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...config?.headers
    }
  };
  
  const response = await api.get<T>(url, optimizedConfig);
  return response.data;
};

export const apiPost = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const optimizedConfig = {
    ...config,
    // POST 요청 최적화
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      ...config?.headers
    }
  };
  
  const response = await api.post<T>(url, data, optimizedConfig);
  return response.data;
};

export const apiPut = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const optimizedConfig = {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      ...config?.headers
    }
  };
  
  const response = await api.put<T>(url, data, optimizedConfig);
  return response.data;
};

export const apiDelete = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const optimizedConfig = {
    ...config,
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      ...config?.headers
    }
  };
  
  const response = await api.delete<T>(url, optimizedConfig);
  return response.data;
};

// 파일 업로드용 메서드 (최적화)
export const apiUpload = async <T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> => {
  const response = await api.post<T>(url, formData, {
    ...config,
    timeout: 60000, // 파일 업로드는 더 긴 timeout
    headers: {
      ...config?.headers,
      'Content-Type': 'multipart/form-data',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });
  return response.data;
};

// 재시도 가능한 요청 (네트워크 불안정 시) - 개선된 버전
export const apiWithRetry = async <T = any>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // 재시도 가능한 에러인지 확인 (더 정교하게)
      const shouldRetry = error.code === 'ECONNABORTED' || 
                         error.code === 'ECONNRESET' ||
                         error.code === 'ETIMEDOUT' ||
                         error.message === 'Network Error' ||
                         (error.response?.status >= 500 && error.response?.status < 600) ||
                         error.response?.status === 429; // Rate limit
      
      if (i < maxRetries && shouldRetry) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        console.log(`🔄 API 요청 재시도... (${i + 1}/${maxRetries}) - ${delay.toFixed(0)}ms 후`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
};

// API URL 확인 함수 (디버깅용)
export const getApiUrl = (): string => API_BASE_URL;

// 하위 호환성을 위한 기존 export (Keep-Alive 최적화 적용)
export const corsRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=30, max=1000',
    ...(options.headers || {}),
  };
  
  const requestOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
    mode: 'cors',
    credentials: 'include',
    // keepalive: true, // HTTP Keep-Alive for fetch
  };
  
  try {
    console.log('🌐 Fetch Request:', { url, method: options.method || 'GET' });
    const response = await fetch(url, requestOptions);
    console.log('✅ Fetch Response:', { status: response.status, url });
    return response;
  } catch (error: any) {
    console.error('❌ Fetch Request failed:', { url, error: error.message });
    throw error;
  }
}; 