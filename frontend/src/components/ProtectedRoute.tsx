// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, loading, authReady, isGuest } = useAuth();

  if (!authReady || loading) {
    return <div>로딩 중...</div>;
  }
  if (user || isGuest) {
    return <>{children}</>;
  }
  return <Navigate to="/intro" replace />;
}
