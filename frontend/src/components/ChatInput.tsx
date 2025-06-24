import React, { memo, useState, useCallback, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  loading: boolean;
  disabled?: boolean;
}

const ChatInput = memo(({ onSendMessage, loading, disabled }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 컴포넌트 마운트 시 입력창에 포커스
  useEffect(() => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // loading 상태가 false로 변경될 때마다 포커스 설정
  useEffect(() => {
    if (!loading && inputRef.current && !disabled) {
      // 약간의 지연을 주어 DOM 업데이트가 완료된 후 포커스 설정
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [loading, disabled]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || disabled || isComposing) return;
    
    onSendMessage(input.trim());
    setInput("");
    
    // 메시지 전송 후 입력창에 포커스 유지 - 여러 번 시도
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    
    // 즉시 포커스
    focusInput();
    
    // 100ms 후에 다시 포커스
    setTimeout(focusInput, 100);
    
    // 300ms 후에 마지막으로 포커스 (AI 응답 처리 고려)
    setTimeout(focusInput, 300);
  }, [input, loading, disabled, isComposing, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit, isComposing]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const handleActionButtonClick = useCallback(() => {
    if (!inputRef.current || loading || disabled) return;
    
    const input = inputRef.current;
    const cursorPosition = input.selectionStart || 0;
    const currentValue = input.value;
    
    // 커서 위치에 **을 삽입
    const newValue = currentValue.slice(0, cursorPosition) + '**' + currentValue.slice(cursorPosition);
    setInput(newValue);
    
    // 포커스를 다시 입력 필드로 이동하고 커서를 ** 사이에 위치시킴
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
      }
    }, 0);
  }, [loading, disabled]);

  return (
    <form 
      onSubmit={handleSubmit} 
      style={{ 
        background: "var(--color-card)", 
        padding: "12px 16px", 
        borderTop: "1px solid var(--color-border)" 
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={handleActionButtonClick}
          disabled={loading || disabled}
          style={{
            background: loading || disabled ? "#f5f5f5" : "#6c5ce7",
            color: loading || disabled ? "#bbb" : "#fff",
            border: "none",
            borderRadius: "50%",
            width: 45,
            height: 45,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            cursor: loading || disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            flexShrink: 0,
            boxShadow: loading || disabled ? "none" : "0 2px 4px rgba(108, 92, 231, 0.2)",
            padding: "3px"
          }}
          onMouseEnter={(e) => {
            if (!loading && !disabled) {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(108, 92, 231, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && !disabled) {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(108, 92, 231, 0.2)";
            }
          }}
          title="행동 묘사 추가 (**)"
          aria-label="행동 묘사 추가"
        >
          <span style={{ fontSize: 16, lineHeight: 1, marginBottom: 1 }}>*</span>
          <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 600 }}>행동</span>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="메시지를 입력하세요..."
          disabled={loading || disabled}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 24,
            border: "1px solid #eee",
            fontSize: 16,
            outline: "none",
            backgroundColor: loading || disabled ? "#f5f5f5" : "white",
            color: loading || disabled ? "#999" : "black"
          }}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || disabled}
          style={{
            background: loading || !input.trim() || disabled ? "#f5f5f5" : "#ff4081",
            color: loading || !input.trim() || disabled ? "#bbb" : "#fff",
            border: "none",
            borderRadius: 24,
            padding: "12px 16px",
            fontWeight: 700,
            fontSize: 16,
            cursor: loading || !input.trim() || disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            minWidth: "60px",
            height: "48px"
          }}
          aria-label="메시지 전송"
        >
          {loading ? "전송중..." : "전송"}
        </button>
      </div>
    </form>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput; 