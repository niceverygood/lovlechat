import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// 환경별 API URL 설정 (동적)
const getApiBaseUrl = (): string => {
  // 새로운 환경변수 확인
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // 기존 환경변수 확인 (하위 호환성)
  if (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL !== 'https://lovlechat-gkisl9vzq-malshues-projects.vercel.app') {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // 프로덕션 환경 - Vercel 프록시 사용 (상대 경로)
  if (process.env.NODE_ENV === 'production' || window.location.hostname.includes('vercel.app')) {
    // Vercel에서는 /api/* 경로가 EC2로 프록시됨
    return '';
  }
  
  // 개발 환경 - Express 백엔드 포트 3002로 연결
  return 'http://localhost:3002';
};

export const API_BASE_URL = getApiBaseUrl();

// 기존 코드와의 호환성을 위해 임시로 export
// TODO: 모든 파일을 axios로 마이그레이션 후 제거

// Axios 인스턴스 생성
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: process.env.NODE_ENV === 'production' ? 30000 : 10000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
    },
    withCredentials: true, // CORS credentials
  });

  // 요청 인터셉터 (로깅 및 에러 처리)
  instance.interceptors.request.use(
    (config) => {
      console.log('🌐 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
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
      console.log('✅ API Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
      return response;
    },
    (error) => {
      console.error('❌ API Response Error:', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.message,
        data: error.response?.data,
      });

      // 네트워크 에러 처리
      if (error.code === 'ECONNABORTED') {
        error.message = `요청 시간 초과: 서버 응답이 지연되고 있습니다.`;
      } else if (error.message === 'Network Error') {
        error.message = '네트워크 오류: API 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.response?.status === 0) {
        error.message = 'CORS error: API 서버와 연결할 수 없습니다.';
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// 공통 API 인스턴스
export const api = createApiInstance();

// 편의 메서드들
export const apiGet = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await api.get<T>(url, config);
  return response.data;
};

export const apiPost = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const response = await api.post<T>(url, data, config);
  return response.data;
};

export const apiPut = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  const response = await api.put<T>(url, data, config);
  return response.data;
};

export const apiDelete = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await api.delete<T>(url, config);
  return response.data;
};

// 파일 업로드용 메서드
export const apiUpload = async <T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> => {
  const response = await api.post<T>(url, formData, {
    ...config,
    headers: {
      ...config?.headers,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// 재시도 가능한 요청 (네트워크 불안정 시)
export const apiWithRetry = async <T = any>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // 재시도 가능한 에러인지 확인
      const shouldRetry = error.code === 'ECONNABORTED' || 
                         error.message === 'Network Error' ||
                         (error.response?.status >= 500 && error.response?.status < 600);
      
      if (i < maxRetries && shouldRetry) {
        console.log(`🔄 API 요청 재시도... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      } else {
        break;
      }
    }
  }

  throw lastError;
};

// API URL 확인 함수 (디버깅용)
export const getApiUrl = (): string => API_BASE_URL;

// 하위 호환성을 위한 기존 export
export const corsRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    ...(options.headers || {}),
  };
  
  const requestOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
    mode: 'cors',
    credentials: 'include',
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