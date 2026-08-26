import { useAuth } from '@/contexts/SessionContext';
import { Navigate, Outlet } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

const ProtectedRoute = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center animate-pulse">
            <span className="h-4 w-4 rounded-full bg-teal-400" />
          </div>
          <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase animate-pulse">Memuat Sesi...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;