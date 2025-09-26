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
          <Link to="/quotes">Lihat Penawaran Saya</Link>
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-4xl font-bold mb-2">Selamat Datang di Aplikasi Penawaran Anda</CardTitle>
            <CardDescription className="text-xl text-gray-600">
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