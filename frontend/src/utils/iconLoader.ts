// React Icons 동적 로딩 유틸리티
import React, { ComponentType } from 'react';

// 아이콘 캐시
const iconCache = new Map<string, ComponentType<any>>();

// Feather Icons 동적 로딩
export const loadFeatherIcon = async (iconName: string): Promise<ComponentType<any>> => {
  const cacheKey = `fi-${iconName}`;
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  try {
    const iconModule = await import('react-icons/fi');
    const IconComponent = (iconModule as any)[iconName];
    
    if (!IconComponent) {
      throw new Error(`Icon ${iconName} not found in Feather Icons`);
    }
    
    iconCache.set(cacheKey, IconComponent);
    return IconComponent;
  } catch (error) {
    console.error(`Failed to load Feather icon: ${iconName}`, error);
    // 폴백 아이콘 반환
    const FallbackIcon = () => React.createElement('span', {}, '•');
    return FallbackIcon;
  }
};

// Material Design Icons 동적 로딩
export const loadMdIcon = async (iconName: string): Promise<ComponentType<any>> => {
  const cacheKey = `md-${iconName}`;
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  try {
    const iconModule = await import('react-icons/md');
    const IconComponent = (iconModule as any)[iconName];
    
    if (!IconComponent) {
      throw new Error(`Icon ${iconName} not found in Material Design Icons`);
    }
    
    iconCache.set(cacheKey, IconComponent);
    return IconComponent;
  } catch (error) {
    console.error(`Failed to load Material Design icon: ${iconName}`, error);
    const FallbackIcon = () => React.createElement('span', {}, '•');
    return FallbackIcon;
  }
};

// Font Awesome Icons 동적 로딩
export const loadFaIcon = async (iconName: string): Promise<ComponentType<any>> => {
  const cacheKey = `fa-${iconName}`;
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  try {
    const iconModule = await import('react-icons/fa');
    const IconComponent = (iconModule as any)[iconName];
    
    if (!IconComponent) {
      throw new Error(`Icon ${iconName} not found in Font Awesome Icons`);
    }
    
    iconCache.set(cacheKey, IconComponent);
    return IconComponent;
  } catch (error) {
    console.error(`Failed to load Font Awesome icon: ${iconName}`, error);
    const FallbackIcon = () => React.createElement('span', {}, '•');
    return FallbackIcon;
  }
};

// 아이콘 프리로더 (자주 사용되는 아이콘들)
export const preloadCommonIcons = async () => {
  const commonIcons = [
    { type: 'fi', name: 'FiSettings' },
    { type: 'fi', name: 'FiHeart' },
    { type: 'fi', name: 'FiUser' },
    { type: 'fi', name: 'FiHome' },
    { type: 'fi', name: 'FiMessageCircle' },
    { type: 'fi', name: 'FiPlus' },
    { type: 'fi', name: 'FiX' },
    { type: 'fi', name: 'FiEdit' },
    { type: 'fi', name: 'FiTrash' }
  ];

  await Promise.all(
    commonIcons.map(async ({ type, name }) => {
      try {
        if (type === 'fi') await loadFeatherIcon(name);
        else if (type === 'md') await loadMdIcon(name);
        else if (type === 'fa') await loadFaIcon(name);
      } catch (error) {
        console.warn(`Failed to preload icon ${name}:`, error);
      }
    })
  );

  console.log('🎨 Common icons preloaded');
};

// 아이콘 캐시 정리
export const clearIconCache = () => {
  iconCache.clear();
  console.log('🧹 Icon cache cleared');
};

// 캐시 상태 확인
export const getIconCacheInfo = () => ({
  size: iconCache.size,
  keys: Array.from(iconCache.keys()),
  timestamp: new Date().toISOString()
}); 