import React from "react";

export default function Header() {
  return (
    <header style={{
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      padding: "18px 20px 10px 20px",
      background: "var(--color-card)",
      fontSize: "1.5rem",
      fontWeight: "bold",
      borderBottom: "1px solid var(--color-border)",
      color: "var(--color-text)",
    }}>
      <span>채팅</span>
    </header>
  );
} 