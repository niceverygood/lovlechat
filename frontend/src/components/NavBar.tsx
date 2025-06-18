import React from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
}

export default function NavBar({ title }: Props) {
  const nav = useNavigate();
  return (
    <div className="flex items-center justify-between p-4 bg-white shadow">
      <button onClick={() => nav(-1)} className="text-xl">←</button>
      <h1 className="text-lg font-semibold">{title}</h1>
      <div style={{ width: 24 }} /> {/* placeholder for symmetry */}
    </div>
  );
}
