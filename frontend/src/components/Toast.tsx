import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    
    // Auto close
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success': 
        return { 
          bg: '#4caf50', 
          border: '#66bb6a',
          shadow: 'rgba(76, 175, 80, 0.3)'
        };
      case 'error': 
        return { 
          bg: '#f44336', 
          border: '#ef5350',
          shadow: 'rgba(244, 67, 54, 0.3)'
        };
      case 'warning': 
        return { 
          bg: '#ff9800', 
          border: '#ffb74d',
          shadow: 'rgba(255, 152, 0, 0.3)'
        };
      case 'info':
      default: 
        return { 
          bg: '#2196f3', 
          border: '#42a5f5',
          shadow: 'rgba(33, 150, 243, 0.3)'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: colors.bg,
        color: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        boxShadow: `0 8px 32px ${colors.shadow}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '400px',
        minWidth: '280px',
        fontSize: '14px',
        fontWeight: 500,
        zIndex: 10000,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer'
      }}
      onClick={() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }}
    >
      <span style={{ fontSize: '16px' }}>{getIcon()}</span>
      <span style={{ flex: 1, lineHeight: '1.4' }}>{message}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '6px',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '12px',
          padding: '4px 8px',
          fontWeight: 600
        }}
      >
        ×
      </button>
    </div>
  );
};

// Toast Container Component
interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            top: `${20 + index * 80}px`,
            right: '20px',
            zIndex: 10000 - index
          }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );
};

// Toast Hook
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType = 'info', duration?: number) => {
    const id = Date.now().toString();
    const newToast: ToastMessage = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message: string, duration?: number) => addToast(message, 'success', duration);
  const error = (message: string, duration?: number) => addToast(message, 'error', duration);
  const warning = (message: string, duration?: number) => addToast(message, 'warning', duration);
  const info = (message: string, duration?: number) => addToast(message, 'info', duration);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    ToastContainer: () => <ToastContainer toasts={toasts} removeToast={removeToast} />
  };
};

export default Toast; 