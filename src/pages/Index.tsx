import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const Index = () => {
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
              Klik tombol di bawah ini untuk mulai membuat penawaran baru untuk klien Anda.
            </p>
            <Button asChild size="lg">
              <Link to="/quote">Buat Penawaran Baru</Link>
            </Button>
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