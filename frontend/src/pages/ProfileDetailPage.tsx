import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton";
import { API_BASE_URL } from '../lib/openai';
import CustomAlert from '../components/CustomAlert';

interface Persona {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  gender: string;
  age: string;
  job: string;
  info: string;
  habit: string;
  createdAt: string;
}

export default function ProfileDetailPage() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertTitle, setAlertTitle] = useState('');

  useEffect(() => {
    if (!personaId) return;
    fetch(`${API_BASE_URL}/api/persona/${personaId}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setPersona(data.persona);
        setLoading(false);
      });
  }, [personaId]);

  const handleDelete = async () => {
    if (!persona) return;
    if (window.confirm("정말로 삭제하시겠습니까?")) {
      await fetch(`${API_BASE_URL}/api/persona/${persona.id}`, { method: "DELETE" });
      setAlertTitle('삭제 완료');
      setAlertMsg('삭제되었습니다.');
      setAlertOpen(true);
      navigate(-1);
    }
  };

  if (loading || !persona) return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Skeleton type="circle" width={110} height={110} style={{ marginBottom: 16 }} />
        <Skeleton width={120} height={28} />
        <Skeleton width={80} height={20} />
        <Skeleton width={180} height={20} />
        <Skeleton width={100} height={18} />
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <Skeleton width={80} height={36} />
          <Skeleton width={80} height={36} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ background: "var(--color-card)", borderRadius: 20, margin: 20, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img
          src={persona.avatar || "/imgdefault.jpg"}
          alt={persona.name}
          style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", marginBottom: 16, border: "2px solid #eee" }}
          onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/imgdefault.jpg"; }}
        />
        <div style={{ fontWeight: 700, fontSize: 24, marginBottom: 8 }}>{persona.name}</div>
        <div style={{ color: "#888", fontSize: 16, marginBottom: 8 }}>{persona.gender} · {persona.age} · {persona.job}</div>
        <div style={{ color: "#222", fontSize: 16, marginBottom: 16, textAlign: "center" }}>{persona.info}</div>
        <div style={{ color: "#888", fontSize: 15, marginBottom: 16 }}>습관: {persona.habit}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button onClick={() => navigate(`/profile-edit/${persona.id}`)} style={{ background: "#ff4081", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>수정</button>
          <button onClick={handleDelete} style={{ background: "var(--color-card)", color: "var(--color-point)", border: "1.5px solid var(--color-point)", borderRadius: 12, padding: "10px 24px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>삭제</button>
        </div>
      </div>
      <CustomAlert open={alertOpen} title={alertTitle} message={alertMsg} onConfirm={() => setAlertOpen(false)} />
    </div>
  );
} 