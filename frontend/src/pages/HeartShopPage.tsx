import React from "react";
import { useNavigate } from "react-router-dom";

const HEART_PRODUCTS = [
  { count: 300, price: 3300, bonus: 43 },
  { count: 508, price: 5500, bonus: 45 },
  { count: 612, price: 6600, bonus: 46 },
  { count: 927, price: 9900, bonus: 47 },
  { count: 1220, price: 12900, bonus: 49 },
];

export default function HeartShopPage() {
  const navigate = useNavigate();
  return (
    <div style={{ background: "#18171c", minHeight: "100vh", color: "#fff", paddingBottom: 40 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '22px 0 18px 0', justifyContent: 'center', borderBottom: '1.5px solid #222', background: '#18171c', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 26, position: 'absolute', left: 18, top: 22, cursor: 'pointer' }}>&larr;</button>
        <span style={{ fontWeight: 700, fontSize: 22 }}>하트샵</span>
      </div>
      {/* 구매 리스트 */}
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '28px 16px 0 16px' }}>
        {HEART_PRODUCTS.map((item, idx) => (
          <div key={item.count} style={{
            background: '#23222a',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 20px',
            marginBottom: 18,
            boxShadow: '0 2px 12px rgba(0,0,0,0.10)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontSize: 34, marginRight: 8 }}>❤️</span>
              <span style={{ fontWeight: 700, fontSize: 24, letterSpacing: 1 }}>{item.count.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: 'linear-gradient(90deg,#ffb347,#ff4081)', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 10, padding: '7px 16px', boxShadow: '0 2px 8px #ff408133', height: 38, display: 'flex', alignItems: 'center' }}>{`+${item.bonus}% BONUS`}</span>
              <button style={{ background: '#ff4081', color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', borderRadius: 16, padding: '7px 28px', cursor: 'pointer', boxShadow: '0 2px 8px #ff408133', transition: 'background 0.2s', height: 38, display: 'flex', alignItems: 'center' }}>
                {`₩${item.price.toLocaleString()}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 