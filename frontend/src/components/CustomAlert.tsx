import React from "react";

interface CustomAlertProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "확인",
  cancelText = "취소"
}) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#19181b', borderRadius: 28, minWidth: 320, maxWidth: 380, padding: '40px 32px 32px 32px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.18)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontWeight: 700, fontSize: 24, color: '#fff', marginBottom: 18 }}>{title}</div>
        <div style={{ color: '#eee', fontSize: 16, marginBottom: 36 }}>{message}</div>
        <div style={{ display: 'flex', gap: 18, width: '100%', justifyContent: 'center' }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{ flex: 1, background: '#666', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 600, fontSize: 18, cursor: 'pointer' }}
            >{cancelText}</button>
          )}
          <button
            onClick={onConfirm}
            style={{ flex: 1, background: '#ff4081', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
          >{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlert; 