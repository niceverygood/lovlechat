import React, { useState, useCallback, memo } from 'react';

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
}

// 이미지 캐시 맵 (메모리 최적화)
const imageCache = new Map<string, boolean>();

const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  className,
  style,
  fallbackSrc = "/imgdefault.jpg",
  onClick,
  onLoad,
  onError
}: OptimizedImageProps) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(!imageCache.has(src));
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
      loading="lazy" // 지연 로딩
      decoding="async" // 비동기 디코딩
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage; 