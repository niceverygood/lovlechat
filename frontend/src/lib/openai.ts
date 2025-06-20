// src/lib/openai.ts

// 환경별 API URL 설정
const getApiBaseUrl = () => {
  // 환경 변수에서 API URL 확인
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // 프로덕션 환경 - 실제 배포된 백엔드 사용
  if (process.env.NODE_ENV === 'production') {
    return 'https://lovlechat-dq4i.vercel.app';
  }
  
  // 개발 환경 - proxy 설정이 있으므로 상대 경로 사용
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// Mock API 데이터 (백엔드 미배포시 사용)
const createMockResponse = (data: any) => {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

const getMockPersonas = (userId: string) => ([
  {
    id: "1",
    userId: userId,
    name: "기본 프로필",
    avatar: "/imgdefault.jpg",
    gender: "",
    age: "",
    job: "",
    info: "",
    habit: "",
    createdAt: new Date().toISOString()
  }
]);

// CORS 대응 fetch 래퍼
export const corsRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log('API Request:', { url, method: options.method });
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    ...(options.headers || {})
  };
  
  const requestOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
    mode: 'cors', // CORS 요청 명시적 설정
    credentials: 'omit' // 인증 쿠키 제외 (단순 요청)
  };
  
  try {
    console.log('Making API request with options:', requestOptions);
    const response = await fetch(url, requestOptions);
    console.log('API Response:', { status: response.status, ok: response.ok });
    
    // CORS 에러 확인
    if (!response.ok && response.status === 0) {
      throw new Error('CORS error: API 서버와 연결할 수 없습니다.');
    }
    
    return response;
  } catch (error) {
    console.error('API Request failed:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('네트워크 오류: API 서버에 연결할 수 없습니다. CORS 설정을 확인해주세요.');
    }
    throw error;
  }
};

// 간편한 GET 요청 헬퍼
export const apiGet = async (endpoint: string) => {
  const response = await corsRequest(endpoint, { method: 'GET' });
  const data = await response.json();
  console.log('API GET Response:', { endpoint, data });
  return data;
};

// 간편한 POST 요청 헬퍼
export const apiPost = async (endpoint: string, data: any) => {
  const response = await corsRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  const responseData = await response.json();
  console.log('API POST Response:', { endpoint, requestData: data, responseData });
  return responseData;
};

// 간편한 PUT 요청 헬퍼
export const apiPut = async (endpoint: string, data: any) => {
  const response = await corsRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  const responseData = await response.json();
  console.log('API PUT Response:', { endpoint, requestData: data, responseData });
  return responseData;
};

// 간편한 DELETE 요청 헬퍼
export const apiDelete = async (endpoint: string) => {
  const response = await corsRequest(endpoint, { method: 'DELETE' });
  const data = await response.json();
  console.log('API DELETE Response:', { endpoint, data });
  return data;
};
