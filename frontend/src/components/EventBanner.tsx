import React from "react";

export default function EventBanner() {
  return (
    <div style={{
      background: "linear-gradient(90deg, #ffe0ec 0%, #fff 100%)",
      borderRadius: "16px",
      margin: "20px",
      padding: "16px",
      display: "flex",
      alignItems: "center",
      position: "relative"
    }}>
      <span role="img" aria-label="strawberry" style={{ fontSize: "1.5rem", marginRight: "8px" }}>🍓</span>
      <span style={{ flex: 1 }}>
        러비의 딸기농장🍓<br />
        무료로 딸기를 모아서 잼을 얻으세요!
      </span>
      <span role="img" aria-label="close" style={{ fontSize: "1.5rem", marginLeft: "8px", cursor: "pointer" }}>❌</span>
    </div>
  );
} 