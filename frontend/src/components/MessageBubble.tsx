import React from "react";

export interface Msg {
  sender: "user" | "ai" | "system";
  text: string;
  avatar?: string;
  characterName?: string;
  characterProfileImg?: string;
  characterAge?: number;
  characterJob?: string;
}

interface Props {
  message: Msg;
  onProfileClick?: () => void;
}

export default function MessageBubble({ message, onProfileClick }: Props) {
  const isUser = message.sender === "user";
  return (
    <div style={{ 
      display: message.sender === 'system' ? 'block' : 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row', 
      alignItems: 'flex-end', 
      marginBottom: 10, 
      textAlign: message.sender === 'system' ? 'center' : undefined
    }}>
      {message.sender !== 'system' && isUser && message.avatar && (
        <img
          src={message.avatar || "/imgdefault.jpg"}
          alt="me"
          style={{ width: 40, height: 40, borderRadius: '50%', marginLeft: 10, background: '#222', objectFit: 'cover', cursor: onProfileClick ? 'pointer' : 'default', border: '2px solid #fff' }}
          onClick={onProfileClick}
          onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
        />
      )}
      {message.sender !== 'system' && !isUser && message.avatar && (
        <img
          src={message.avatar || "/imgdefault.jpg"}
          alt="ai"
          style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 10, background: '#222', objectFit: 'cover', cursor: onProfileClick ? 'pointer' : 'default', border: '2px solid #fff' }}
          onClick={onProfileClick}
          onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
        />
      )}
      {message.sender === 'system' ? (
        <div style={{
          display: 'inline-block',
          background: message.text.includes('증가') ? '#e3f0ff' : '#ffe3ef',
          color: message.text.includes('증가') ? '#1976d2' : '#ff4081',
          fontWeight: 700,
          fontSize: 15,
          borderRadius: 12,
          padding: '7px 18px',
          margin: '10px auto',
          maxWidth: 220,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>{message.text}</div>
      ) : (
      <div
        style={{
          maxWidth: 320,
          padding: isUser ? '13px 18px' : '13px 18px',
          borderRadius: 18,
            background: isUser ? '#ff4081' : 'rgba(255,255,255,0.08)',
          color: isUser ? '#fff' : '#fff',
          fontSize: 17,
          fontWeight: 400,
          marginLeft: isUser ? 0 : 4,
          marginRight: isUser ? 4 : 0,
          boxShadow: isUser ? '0 2px 8px rgba(255,64,129,0.08)' : '0 2px 8px rgba(0,0,0,0.10)',
          border: isUser ? 'none' : '1.5px solid #fff2',
          wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
      )}
    </div>
  );
}
