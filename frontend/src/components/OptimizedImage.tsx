import React, { useState, useCallback, memo } from 'react';
import { DEFAULT_PROFILE_IMAGE } from '../utils/constants';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  fallbackSrc?: string;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  sizes?: string; // 반응형 이미지 크기
  priority?: boolean; // 우선순위 로딩
  quality?: number; // 이미지 품질 (1-100)
}

// 이미지 캐시 맵 (메모리 최적화)
const imageCache = new Map<string, boolean>();

// WebP 지원 확인
const supportsWebP = (() => {
  if (typeof window === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
})();

// 이미지 URL 최적화 함수
const optimizeImageUrl = (src: string, quality = 85): string => {
  // 외부 이미지 서비스 최적화 (예: Vercel Image Optimization)
  if (src.startsWith('http') && !src.includes('lovlechat')) {
    // 이미 최적화된 URL이거나 CDN URL인 경우 그대로 반환
    return src;
  }
  
  // 로컬 이미지의 경우 확장자 확인 후 WebP 변환 제안
  if (supportsWebP && (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png'))) {
    // 실제 서비스에서는 이미지 최적화 서비스 사용
    return src; // 현재는 원본 반환
  }
  
  return src;
};

const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  className,
  style,
  fallbackSrc = DEFAULT_PROFILE_IMAGE,
  onClick,
  onLoad,
  onError,
  sizes,
  priority = false,
  quality = 85
}: OptimizedImageProps) => {
  const optimizedSrc = optimizeImageUrl(src, quality);
  const [currentSrc, setCurrentSrc] = useState(optimizedSrc);
  const [isLoading, setIsLoading] = useState(!imageCache.has(optimizedSrc) && !priority);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    imageCache.set(currentSrc, true);
    onLoad?.();
  }, [currentSrc, onLoad]);

  const handleError = useCallback(() => {
    if (currentSrc !== fallbackSrc && !hasError) {
      setCurrentSrc(fallbackSrc);
      setHasError(true);
      setIsLoading(false);
      onError?.();
    } else {
      setIsLoading(false);
    }
  }, [currentSrc, fallbackSrc, hasError, onError]);

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          ...style,
          width: width || style?.width || '100%',
          height: height || style?.height || '100%',
          backgroundColor: '#333',
          borderRadius: style?.borderRadius || '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}
      >
        <span style={{ color: '#666', fontSize: '12px' }}>로딩중...</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      style={{
        ...style,
        objectFit: 'cover',
        transition: 'opacity 0.3s ease',
        opacity: isLoading ? 0 : 1
      }}
      onLoad={handleLoad}
      onError={handleError}
      onClick={onClick}
      loading={priority ? "eager" : "lazy"} // 우선순위에 따른 로딩
      decoding="async" // 비동기 디코딩
      fetchPriority={priority ? "high" : "auto"} // 페치 우선순위
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage; 