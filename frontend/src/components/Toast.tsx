import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 40,
        transform: "translateX(-50%)",
        background: type === "success" ? "#ff4081" : "#333",
        color: "#fff",
        padding: "16px 32px",
        borderRadius: 24,
        fontWeight: 700,
        fontSize: 17,
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        zIndex: 9999,
        minWidth: 220,
        textAlign: "center",
        opacity: 0.97
      }}
    >
      {message}
    </div>
  );
};

export default Toast; 