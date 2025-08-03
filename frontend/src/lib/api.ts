import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

// 환경별 API URL 설정 (동적)
const getApiBaseUrl = (): string => {
  // 디버깅용 로그
  console.log("🔍 API URL 환경변수 확인:", {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
    hostname: window.location.hostname,
    isVercel: window.location.hostname.includes("vercel.app"),
  });

  // Vercel 환경 강제 감지 (우선순위 최상위)
  if (window.location.hostname.includes("vercel.app")) {
    console.log("🚀 Vercel 환경 감지 - 강제로 상대 경로 사용");
    return "";
  }

  // 새로운 환경변수 확인
  if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "") {
    console.log("✅ REACT_APP_API_URL 사용:", process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }

  // 기존 환경변수 확인 (하위 호환성)
  if (
    process.env.REACT_APP_API_BASE_URL &&
    process.env.REACT_APP_API_BASE_URL !==
      "https://lovlechat-gkisl9vzq-malshues-projects.vercel.app"
  ) {
    console.log(
      "✅ REACT_APP_API_BASE_URL 사용:",
      process.env.REACT_APP_API_BASE_URL
    );
    return process.env.REACT_APP_API_BASE_URL;
  }

  // EC2 환경 감지 (IP 주소로 접근하는 경우)
  if (window.location.hostname.includes("54.79.211.48")) {
    console.log("🚀 EC2 환경 감지 - 백엔드 포트 3002로 연결");
    return "http://54.79.211.48:3002";
  }

  // 프로덕션 환경 - Vercel 프록시 사용 (상대 경로)
  if (process.env.NODE_ENV === "production") {
    console.log("✅ 프로덕션 환경 - 상대 경로 사용");
    return "";
  }

  // 개발 환경 - Express 백엔드 포트 5000으로 연결
  console.log("✅ 개발 환경 로컬 서버 사용: http://localhost:5000");
  return "http://localhost:5000";
};

export const API_BASE_URL = getApiBaseUrl();

// API 응답시간 측정을 위한 인터페이스
interface ApiRequestMetrics {
  requestId: string;
  method: string;
  url: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  size?: string;
  compression?: string;
  error?: any;
}

// 요청 시간 추적을 위한 Map
const requestTimes = new Map<string, ApiRequestMetrics>();

// 성능 통계 수집
const performanceStats = {
  totalRequests: 0,
  totalDuration: 0,
  avgDuration: 0,
  slowestRequest: { url: "", duration: 0 },
  fastestRequest: { url: "", duration: Infinity },
  errorCount: 0,
  successCount: 0,
};

// 응답시간 임계값 (ms)
const RESPONSE_TIME_THRESHOLDS = {
  FAST: 200, // 빠름
  NORMAL: 1000, // 보통
  SLOW: 3000, // 느림
  VERY_SLOW: 5000, // 매우 느림
};

// 응답시간에 따른 이모지 선택
const getSpeedEmoji = (duration: number): string => {
  if (duration <= RESPONSE_TIME_THRESHOLDS.FAST) return "🚀";
  if (duration <= RESPONSE_TIME_THRESHOLDS.NORMAL) return "✅";
  if (duration <= RESPONSE_TIME_THRESHOLDS.SLOW) return "⚠️";
  if (duration <= RESPONSE_TIME_THRESHOLDS.VERY_SLOW) return "🐌";
  return "🚨";
};

// 응답시간 분류
const getSpeedCategory = (duration: number): string => {
  if (duration <= RESPONSE_TIME_THRESHOLDS.FAST) return "FAST";
  if (duration <= RESPONSE_TIME_THRESHOLDS.NORMAL) return "NORMAL";
  if (duration <= RESPONSE_TIME_THRESHOLDS.SLOW) return "SLOW";
  if (duration <= RESPONSE_TIME_THRESHOLDS.VERY_SLOW) return "VERY_SLOW";
  return "TIMEOUT";
};

// useEffect용 API 응답시간 측정 헬퍼
export const createApiTimer = (apiName: string) => {
  let startTime: number;

  return {
    start: () => {
      startTime = performance.now();
      console.log(
        `⏱️  [${apiName}] API 요청 시작 - ${new Date().toISOString()}`
      );
    },

    end: (response?: any, error?: any) => {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      const emoji = getSpeedEmoji(duration);
      const category = getSpeedCategory(duration);

      if (error) {
        console.log(`❌ [${apiName}] API 에러 - ${duration}ms (${category})`, {
          duration,
          category,
          error: error.message || error,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(
          `${emoji} [${apiName}] API 응답완료 - ${duration}ms (${category})`,
          {
            duration,
            category,
            response: response ? "Success" : "No data",
            timestamp: new Date().toISOString(),
          }
        );
      }

      return duration;
    },

    measure: async <T>(apiCall: () => Promise<T>): Promise<T> => {
      const startTime = performance.now();
      console.log(
        `⏱️  [${apiName}] API 요청 시작 - ${new Date().toISOString()}`
      );

      try {
        const result = await apiCall();
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        const emoji = getSpeedEmoji(duration);
        const category = getSpeedCategory(duration);

        console.log(
          `${emoji} [${apiName}] API 응답완료 - ${duration}ms (${category})`,
          {
            duration,
            category,
            timestamp: new Date().toISOString(),
          }
        );

        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        const category = getSpeedCategory(duration);

        console.log(`❌ [${apiName}] API 에러 - ${duration}ms (${category})`, {
          duration,
          category,
          error: error instanceof Error ? error.message : error,
          timestamp: new Date().toISOString(),
        });

        throw error;
      }
    },
  };
};

// 성능 통계 업데이트
const updatePerformanceStats = (metrics: ApiRequestMetrics) => {
  if (metrics.duration === undefined) return;

  performanceStats.totalRequests++;
  performanceStats.totalDuration += metrics.duration;
  performanceStats.avgDuration = Math.round(
    performanceStats.totalDuration / performanceStats.totalRequests
  );

  if (metrics.error) {
    performanceStats.errorCount++;
  } else {
    performanceStats.successCount++;
  }

  // 가장 빠른/느린 요청 업데이트
  if (metrics.duration > performanceStats.slowestRequest.duration) {
    performanceStats.slowestRequest = {
      url: metrics.url,
      duration: metrics.duration,
    };
  }

  if (metrics.duration < performanceStats.fastestRequest.duration) {
    performanceStats.fastestRequest = {
      url: metrics.url,
      duration: metrics.duration,
    };
  }
};

// 성능 통계 조회
export const getPerformanceStats = () => ({ ...performanceStats });

// 성능 통계 리셋
export const resetPerformanceStats = () => {
  performanceStats.totalRequests = 0;
  performanceStats.totalDuration = 0;
  performanceStats.avgDuration = 0;
  performanceStats.slowestRequest = { url: "", duration: 0 };
  performanceStats.fastestRequest = { url: "", duration: Infinity };
  performanceStats.errorCount = 0;
  performanceStats.successCount = 0;
  console.log("📊 API 성능 통계가 리셋되었습니다.");
};

// Axios 인스턴스 생성
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: "http://localhost:5000",
    // 더 세밀한 timeout 설정
    timeout: process.env.NODE_ENV === "production" ? 60000 : 60000, // 응답 전체 timeout
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      // "Accept-Encoding": "gzip, deflate, br", // gzip 압축 지원
      "Cache-Control": "no-cache",
      // Connection: "keep-alive", // Keep-Alive 설정
      // "Keep-Alive": "timeout=30, max=1000", // Keep-Alive 세부 설정
      // // 브라우저 식별
      // "User-Agent": "LovleChat-Frontend/1.0",
    },
    // withCredentials: true, // CORS credentials

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
      clarifyTimeoutError: true,
    },
  });

  // 요청 인터셉터 (응답시간 측정 시작)
  instance.interceptors.request.use(
    (config) => {
      // 요청 ID 생성 및 시작 시간 기록
      const requestId = `${config.method}_${
        config.url
      }_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const startTime = performance.now();

      const metrics: ApiRequestMetrics = {
        requestId,
        method: config.method?.toUpperCase() || "UNKNOWN",
        url: config.url || "",
        startTime,
      };

      requestTimes.set(requestId, metrics);

      // 요청 ID를 헤더에 추가하여 응답에서 추적 가능하게 함
      config.headers["X-Request-ID"] = requestId;

      // 요청 타입별 최적화
      if (config.method === "get") {
        // GET 요청에는 캐시 헤더 추가
        config.headers["If-Modified-Since"] =
          config.headers["If-Modified-Since"] ||
          new Date(Date.now() - 60000).toUTCString();
      }

      console.log("🌐 API Request:", {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        timeout: config.timeout,
        keepAlive: config.headers["Connection"],
        withCredentials: config.withCredentials,
        origin: window.location.origin,
        requestId,
        startTime: new Date().toISOString(),
      });
      return config;
    },
    (error) => {
      console.error("❌ Request Error:", error);
      return Promise.reject(error);
    }
  );

  // 응답 인터셉터 (응답시간 측정 완료)
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // 응답 시간 계산
      const requestId = response.config.headers["X-Request-ID"] as string;
      const endTime = performance.now();
      const metrics = requestTimes.get(requestId);

      if (metrics) {
        metrics.endTime = endTime;
        metrics.duration = Math.round(endTime - metrics.startTime);
        metrics.status = response.status;
        metrics.size = response.headers["content-length"] || "unknown";
        metrics.compression = response.headers["content-encoding"] || "none";

        // 성능 통계 업데이트
        updatePerformanceStats(metrics);

        // 메모리 정리
        requestTimes.delete(requestId);

        // 응답시간에 따른 로그 출력
        const emoji = getSpeedEmoji(metrics.duration);
        const category = getSpeedCategory(metrics.duration);

        console.log(
          `${emoji} API Response [${metrics.method} ${metrics.url}]`,
          {
            "⏱️ 응답시간": `${metrics.duration}ms`,
            "📊 성능등급": category,
            "📋 상태코드": response.status,
            "📦 크기": metrics.size,
            "🗜️ 압축": metrics.compression,
            "🔗 Keep-Alive": response.headers["connection"],
            "🌍 CORS": {
              allowOrigin: response.headers["access-control-allow-origin"],
              allowCredentials:
                response.headers["access-control-allow-credentials"],
              corsTime: response.headers["x-cors-processing-time"],
            },
            "📈 통계": {
              총요청수: performanceStats.totalRequests,
              평균응답시간: `${performanceStats.avgDuration}ms`,
              성공률: `${Math.round(
                (performanceStats.successCount /
                  performanceStats.totalRequests) *
                  100
              )}%`,
            },
            "⏰ 완료시간": new Date().toISOString(),
          }
        );
      }

      return response;
    },
    (error) => {
      const requestId = error.config?.headers?.["X-Request-ID"] as string;
      const endTime = performance.now();
      const metrics = requestTimes.get(requestId);

      if (metrics) {
        metrics.endTime = endTime;
        metrics.duration = Math.round(endTime - metrics.startTime);
        metrics.status = error.response?.status;
        metrics.error = error;

        // 성능 통계 업데이트
        updatePerformanceStats(metrics);

        // 메모리 정리
        requestTimes.delete(requestId);

        const category = getSpeedCategory(metrics.duration);

        console.error(`❌ API Error [${metrics.method} ${metrics.url}]`, {
          "⏱️ 응답시간": `${metrics.duration}ms`,
          "📊 성능등급": category,
          "❌ 상태코드": error.response?.status || "Network Error",
          "💬 에러메시지": error.message,
          "🔧 에러코드": error.code,
          "📦 응답데이터": error.response?.data,
          "📈 통계": {
            총요청수: performanceStats.totalRequests,
            에러율: `${Math.round(
              (performanceStats.errorCount / performanceStats.totalRequests) *
                100
            )}%`,
            평균응답시간: `${performanceStats.avgDuration}ms`,
          },
          "⏰ 에러시간": new Date().toISOString(),
        });
      }

      // CORS 및 네트워크 에러 처리 개선
      if (
        error.code === "ERR_NETWORK" ||
        (error.message === "Network Error" &&
          error.response?.status === undefined)
      ) {
        console.error("🚫 CORS Error detected:", {
          origin: window.location.origin,
          targetUrl: error.config?.url,
          baseURL: error.config?.baseURL,
          withCredentials: error.config?.withCredentials,
        });
        error.message = `CORS Error: 도메인 ${window.location.origin}에서 API 서버 접근이 차단되었습니다.`;
      } else if (error.code === "ECONNABORTED") {
        error.message = `요청 시간 초과 (${
          metrics?.duration || "unknown"
        }ms): 서버 응답이 지연되고 있습니다.`;
      } else if (error.message === "Network Error") {
        error.message =
          "네트워크 오류: API 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.";
      } else if (error.response?.status === 0) {
        error.message = "CORS error: API 서버와 연결할 수 없습니다.";
      } else if (
        error.response?.status === 403 &&
        error.response?.data?.error === "CORS Error"
      ) {
        console.error("🚫 CORS Policy Violation:", error.response.data);
        error.message = `CORS 정책 위반: ${error.response.data.message} (Origin: ${error.response.data.origin})`;
      } else if (error.code === "ECONNRESET") {
        error.message = "연결 재설정: 서버와의 연결이 끊어졌습니다.";
      } else if (error.code === "ETIMEDOUT") {
        error.message = "연결 시간 초과: 서버 응답이 없습니다.";
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// 공통 API 인스턴스
export const api = createApiInstance();

// 편의 메서드들 (성능 최적화 포함)
export const apiGet = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const optimizedConfig = {
    ...config,
    // GET 요청 최적화
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      ...config?.headers,
    },
  };

  const response = await api.get<T>(url, optimizedConfig);
  return response.data;
};

export const apiPost = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  const optimizedConfig = {
    ...config,
    // POST 요청 최적화
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate, br",
      ...config?.headers,
    },
  };

  const response = await api.post<T>(url, data, optimizedConfig);
  return response.data;
};

export const apiPut = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  const optimizedConfig = {
    ...config,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate, br",
      ...config?.headers,
    },
  };

  const response = await api.put<T>(url, data, optimizedConfig);
  return response.data;
};

export const apiDelete = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const optimizedConfig = {
    ...config,
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate, br",
      ...config?.headers,
    },
  };

  const response = await api.delete<T>(url, optimizedConfig);
  return response.data;
};

const multipartApi = axios.create({
  baseURL: "http://localhost:5000", // ✅ 반드시 명시
  timeout: 60000,
  withCredentials: false,
});

// s3 업로드 로직 - 추가한 코드
export const uploadImageS3 = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await multipartApi.post("/api/upload/s3", formData, {
    headers: {
      // ✅ 절대 Content-Type 직접 쓰지 마라 (multipart면 자동으로 붙음)
    },
  });

  return res.data.url;
};

// 파일 업로드용 메서드 (최적화)
export const apiUpload = async <T = any>(
  url: string,
  formData: FormData,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await api.post<T>(url, formData, {
    ...config,
    timeout: 60000, // 파일 업로드는 더 긴 timeout
    headers: {
      ...config?.headers,
      "Content-Type": "multipart/form-data",
      "Accept-Encoding": "gzip, deflate, br",
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
      const shouldRetry =
        error.code === "ECONNABORTED" ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.message === "Network Error" ||
        (error.response?.status >= 500 && error.response?.status < 600) ||
        error.response?.status === 429; // Rate limit

      if (i < maxRetries && shouldRetry) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        console.log(
          `🔄 API 요청 재시도... (${i + 1}/${maxRetries}) - ${delay.toFixed(
            0
          )}ms 후`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
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
export const corsRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Keep-Alive": "timeout=30, max=1000",
    ...(options.headers || {}),
  };

  const requestOptions: RequestInit = {
    ...options,
    headers: defaultHeaders,
    mode: "cors",
    credentials: "include",
    // keepalive: true, // HTTP Keep-Alive for fetch
  };

  try {
    console.log("🌐 Fetch Request:", { url, method: options.method || "GET" });
    const response = await fetch(url, requestOptions);
    console.log("✅ Fetch Response:", { status: response.status, url });
    return response;
  } catch (error: any) {
    console.error("❌ Fetch Request failed:", { url, error: error.message });
    throw error;
  }
};
