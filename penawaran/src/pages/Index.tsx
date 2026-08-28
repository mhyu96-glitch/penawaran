import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/SessionContext";

const Index = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center animate-pulse">
            <span className="h-4 w-4 rounded-full bg-teal-400" />
          </div>
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase animate-pulse">Memuat Aplikasi...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated, go to Dashboard
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not authenticated, redirect straight to the animated Login screen
  return <Navigate to="/login" replace />;
};

export default Index;
