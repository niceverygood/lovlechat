import React from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  type?: "rect" | "circle" | "text";
  style?: React.CSSProperties;
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 20, borderRadius = 8, type = 'rect', style, className }) => {
  let shapeStyle: React.CSSProperties = { width, height, borderRadius, ...style };
  if (type === "circle") {
    shapeStyle = { ...shapeStyle, borderRadius: "50%" };
  } else if (type === "text") {
    shapeStyle = { ...shapeStyle, height: 16, borderRadius: 6 };
  }
  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(90deg, #222 25%, #333 37%, #222 63%)",
        backgroundSize: "400% 100%",
        animation: "skeleton-shimmer 1.4s ease-in-out infinite",
        marginBottom: 8,
        ...shapeStyle
      }}
    >
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
};

// 채팅 페이지 스켈레톤
export const ChatSkeleton: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-bg)" }}>
    {/* 헤더 스켈레톤 */}
    <div style={{ background: "var(--color-card)", padding: "12px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Skeleton width={24} height={24} style={{ marginRight: 12 }} />
        <Skeleton type="circle" width={40} height={40} style={{ marginRight: 12 }} />
        <div>
          <Skeleton width={80} height={18} style={{ marginBottom: 4 }} />
          <Skeleton width={120} height={14} />
        </div>
      </div>
    </div>
    
    {/* 호감도 바 스켈레톤 */}
    <div style={{ background: "var(--color-card)", padding: "8px 16px", borderBottom: "1.5px solid var(--color-point)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Skeleton width={200} height={16} />
      <Skeleton width={80} height={16} />
    </div>
    
    {/* 메시지 영역 스켈레톤 */}
    <div style={{ flex: 1, padding: "16px" }}>
      {/* 첫 장면/첫대사 스켈레톤 */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Skeleton width={150} height={16} style={{ margin: "0 auto 8px auto" }} />
        <Skeleton width={250} height={14} style={{ margin: "0 auto" }} />
      </div>
      
      {/* 메시지 버블 스켈레톤들 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Skeleton width="70%" height={50} borderRadius={20} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <Skeleton type="circle" width={32} height={32} style={{ marginRight: 8, marginTop: 8 }} />
            <Skeleton width="60%" height={60} borderRadius={20} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Skeleton width="50%" height={40} borderRadius={20} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <Skeleton type="circle" width={32} height={32} style={{ marginRight: 8, marginTop: 8 }} />
            <Skeleton width="75%" height={45} borderRadius={20} />
          </div>
        </div>
      </div>
    </div>
    
    {/* 입력 영역 스켈레톤 */}
    <div style={{ background: "var(--color-card)", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Skeleton width="100%" height={48} borderRadius={24} />
        <Skeleton width={80} height={48} borderRadius={24} />
      </div>
    </div>
  </div>
);

export default Skeleton; 