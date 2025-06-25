// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { onAuthStateChanged } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupAuth = async () => {
      try {
        unsubscribe = await onAuthStateChanged((u: User | null) => {
          setUser(u);
          setLoading(false);
        });
      } catch (error) {
        console.error('Firebase auth setup error:', error);
        setLoading(false);
      }
    };

    setupAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { user, loading };
}
