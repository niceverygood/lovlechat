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

export default Skeleton; 