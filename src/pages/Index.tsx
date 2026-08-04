import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/SessionContext";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { session, loading } = useAuth();

  const renderContent = () => {
    if (loading) {
      return <Skeleton className="h-10 w-48" />;
    }
    if (session) {
      return (
        <Button asChild size="lg">
          <Link to="/dashboard">Buka Dashboard</Link>
        </Button>
      );
    }
    return (
      <Button asChild size="lg">
        <Link to="/login">Masuk untuk Memulai</Link>
      </Button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-2xl">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-3xl md:text-4xl font-bold mb-2">Selamat Datang di Aplikasi Penawaran Anda</CardTitle>
            <CardDescription className="text-lg md:text-xl">
              Hasilkan penawaran proyek secara instan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6">
              {session ? "Kelola semua penawaran Anda atau buat yang baru." : "Masuk atau daftar untuk mulai membuat penawaran."}
            </p>
            {renderContent()}
          </CardContent>
        </Card>
      </div>
      <div className="absolute bottom-0 w-full">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;
