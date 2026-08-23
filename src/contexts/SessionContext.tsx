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
    const getSession = async () => {
        console.log('🔐 SessionContext: Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔐 SessionContext result:', { 
          hasSession: !!session, 
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          error 
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (!session) {
          console.warn('⚠️ SessionContext: No active session found after initial load. User might not be logged in or session is invalid.');
        } else {
          console.log('✅ SessionContext: User authenticated successfully');
        }
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 SessionContext: Auth state changed:', event, { 
        hasSession: !!session, 
        userId: session?.user?.id 
      });
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);