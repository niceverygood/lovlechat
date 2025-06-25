import React, { useState, useEffect, ComponentType } from 'react';
import { loadFeatherIcon, loadMdIcon, loadFaIcon } from '../utils/iconLoader';

interface OptimizedIconProps {
  type: 'fi' | 'md' | 'fa';
  name: string;
  size?: number;
  color?: string;
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}

const OptimizedIcon: React.FC<OptimizedIconProps> = ({ 
  type, 
  name, 
  size = 24, 
  color, 
  className = '',
  onClick,
  ...props 
}) => {
  const [IconComponent, setIconComponent] = useState<ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadIcon = async () => {
      try {
        setLoading(true);
        setError(false);
        
        let component: ComponentType<any>;
        
        switch (type) {
          case 'fi':
            component = await loadFeatherIcon(name);
            break;
          case 'md':
            component = await loadMdIcon(name);
            break;
          case 'fa':
            component = await loadFaIcon(name);
            break;
          default:
            throw new Error(`Unsupported icon type: ${type}`);
        }
        
        setIconComponent(() => component);
      } catch (err) {
        console.error(`Failed to load icon ${type}:${name}`, err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadIcon();
  }, [type, name]);

  if (loading) {
    return (
      <div 
        className={`inline-block ${className}`}
        style={{ 
          width: size, 
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div 
          style={{
            width: size * 0.6,
            height: size * 0.6,
            border: '2px solid #ccc',
            borderTop: '2px solid #666',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      </div>
    );
  }

  if (error || !IconComponent) {
    return (
      <span 
        className={`inline-block ${className}`}
        style={{ 
          fontSize: size * 0.8, 
          color: color || '#999',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClick}
      >
        •
      </span>
    );
  }

  return (
    <IconComponent
      size={size}
      color={color}
      className={className}
      onClick={onClick}
      {...props}
    />
  );
};

export default OptimizedIcon; 