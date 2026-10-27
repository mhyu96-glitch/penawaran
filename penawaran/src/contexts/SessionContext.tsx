import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ session: null, user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: ensure loading state never hangs indefinitely if auth refresh is delayed or rate-limited
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2000);

    // Use ONLY onAuthStateChange as the single source of truth.
    // Stabilize object references so token refreshes do not cause components with useEffect([user]) to re-fetch in a loop.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      clearTimeout(safetyTimer);

      setSession((prevSession) => {
        if (!prevSession && !currentSession) return null;
        if (prevSession && currentSession && prevSession.access_token === currentSession.access_token) {
          return prevSession;
        }
        return currentSession;
      });

      setUser((prevUser) => {
        const nextUser = currentSession?.user ?? null;
        if (!prevUser && !nextUser) return null;
        if (prevUser && nextUser && prevUser.id === nextUser.id && prevUser.email === nextUser.email) {
          return prevUser;
        }
        return nextUser;
      });

      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
