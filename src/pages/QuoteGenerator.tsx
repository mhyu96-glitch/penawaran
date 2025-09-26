import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const servicePrices = {
  "web-design": 1000,
  "web-development": 2000,
  "seo": 500,
};

const featurePrices = {
  "e-commerce": 1500,
  "cms": 800,
  "blog": 500,
};

const QuoteGenerator = () => {
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [service, setService] = useState("");
  const [features, setFeatures] = useState({
    "e-commerce": false,
    "cms": false,
    "blog": false,
  });
  const [totalQuote, setTotalQuote] = useState<number | null>(null);

  const handleFeatureChange = (feature: keyof typeof featurePrices) => {
    setFeatures((prevFeatures) => ({
      ...prevFeatures,
      [feature]: !prevFeatures[feature],
    }));
  };

  const calculateQuote = () => {
    let total = 0;
    if (service && servicePrices[service as keyof typeof servicePrices]) {
      total += servicePrices[service as keyof typeof servicePrices];
    }

    for (const feature in features) {
      if (features[feature as keyof typeof features]) {
        total += featurePrices[feature as keyof typeof featurePrices];
      }
    }

    setTotalQuote(total);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Generator Penawaran Otomatis</CardTitle>
          <CardDescription>Isi detail di bawah ini untuk mendapatkan penawaran instan untuk proyek Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Nama Klien</Label>
              <Input id="clientName" placeholder="contoh: John Doe" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectName">Nama Proyek</Label>
              <Input id="projectName" placeholder="contoh: Website Keren Saya" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service">Layanan Utama</Label>
            <Select onValueChange={setService} value={service}>
              <SelectTrigger id="service">
                <SelectValue placeholder="Pilih layanan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web-design">Desain Web ($1000)</SelectItem>
                <SelectItem value="web-development">Pengembangan Web ($2000)</SelectItem>
                <SelectItem value="seo">Layanan SEO ($500)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fitur Tambahan</Label>
            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="e-commerce" checked={features["e-commerce"]} onCheckedChange={() => handleFeatureChange("e-commerce")} />
                <Label htmlFor="e-commerce" className="font-normal">Fungsionalitas E-commerce (+$1500)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cms" checked={features["cms"]} onCheckedChange={() => handleFeatureChange("cms")} />
                <Label htmlFor="cms" className="font-normal">Content Management System (CMS) (+$800)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="blog" checked={features["blog"]} onCheckedChange={() => handleFeatureChange("blog")} />
                <Label htmlFor="blog" className="font-normal">Integrasi Blog (+$500)</Label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start space-y-4">
          <Button onClick={calculateQuote} className="w-full md:w-auto">Hitung Penawaran</Button>
          {totalQuote !== null && (
            <Card className="w-full bg-secondary">
              <CardHeader>
                <CardTitle>Estimasi Penawaran Anda</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${totalQuote.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ini adalah estimasi. Harga dapat bervariasi tergantung pada kompleksitas proyek.
                </p>
              </CardContent>
            </Card>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default QuoteGenerator;