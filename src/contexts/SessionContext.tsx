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

    // 1. Single source of auth truth via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession.user);
      setLoading(false);
    });

    // 2. Initial session check with automatic recovery from stale tokens
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Auth session check error:', error.message);
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('sb-') || key.includes('supabase.auth.token')) {
              localStorage.removeItem(key);
            }
          });
        } catch {}
        setSession(null);
        setUser(null);
      } else if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setLoading(false);
    }).catch((err) => {
      console.warn('getSession catch:', err);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
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