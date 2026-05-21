import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { safeSupabase } from "@/integrations/supabase/safe-client";
import { toast } from "sonner";
import { Link, Loader2 } from "lucide-react";

const formatSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

const formatPercent = (n: number) => `${n.toFixed(1)} %`;

const inputField = (
  label: string,
  value: number,
  onChange: (v: number) => void,
  suffix?: string,
  step?: number
) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    <div className="relative">
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step || 1000}
        min={0}
        className="text-lg font-semibold pr-12"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const resultRow = (label: string, value: string, highlight?: boolean) => (
  <div className={`flex justify-between items-center py-2 ${highlight ? "font-bold text-lg" : ""}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={highlight ? "text-primary" : ""}>{value}</span>
  </div>
);

const Index = () => {
  // Annons
  const [listingUrl, setListingUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Budgivning
  const [bidIncrease, setBidIncrease] = useState(0);

  // Bostad
  const [basePrice, setBasePrice] = useState(3000000);
  const [downPayment, setDownPayment] = useState(450000);
  const [fee, setFee] = useState(4500);
  const [interestRate, setInterestRate] = useState(3.5);

  // Bil
  const [carPrice, setCarPrice] = useState(300000);
  const [carDownPayment, setCarDownPayment] = useState(60000);
  const [carInterestRate, setCarInterestRate] = useState(5.0);
  const [carMonthlyCost, setCarMonthlyCost] = useState(1500);

  // Budgivningsjusterat pris
  const price = Math.round(basePrice * (1 + bidIncrease / 100));

  // Bostad beräkningar
  const loan = Math.max(price - downPayment, 0);
  const ltv = price > 0 ? loan / price : 0;
  let amortizationRate = 0;
  if (ltv > 0.7) amortizationRate = 2;
  else if (ltv > 0.5) amortizationRate = 1;
  const monthlyInterest = (loan * (interestRate / 100)) / 12;
  const monthlyAmortization = (loan * (amortizationRate / 100)) / 12;
  const housingMonthlyCost = monthlyInterest + monthlyAmortization + fee;

  // Bil beräkningar
  const carLoan = Math.max(carPrice - carDownPayment, 0);
  const carMonthlyInterest = (carLoan * (carInterestRate / 100)) / 12;
  const carTotalMonthlyCost = carMonthlyInterest + carMonthlyCost;

  // Totalt
  const grandTotal = housingMonthlyCost + carTotalMonthlyCost;

  const handleFetchListing = async () => {
    if (!listingUrl.trim()) {
      toast.error("Klistra in en länk först");
      return;
    }

    if (!safeSupabase) {
      toast.error("Backend ej tillgänglig i denna miljö");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await safeSupabase.functions.invoke("scrape-listing", {
        body: { url: listingUrl.trim() },
      });

      if (error) {
        try {
          const errorData = await error.context?.json?.();
          toast.error(errorData?.error || "Kunde inte hämta annonsdata");
        } catch {
          toast.error("Kunde inte hämta annonsdata");
        }
        console.error("Edge function error:", error);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Kunde inte hämta annonsdata");
        return;
      }

      const listing = data.data;
      let found = false;

      if (listing.price) {
        setBasePrice(listing.price);
        setBidIncrease(0);
        found = true;
      }
      if (listing.fee) {
        setFee(listing.fee);
        found = true;
      }

      if (found) {
        toast.success(
          `Hämtade data från ${listing.source === "hemnet" ? "Hemnet" : "Booli"}` +
            (listing.price ? ` – Pris: ${formatSEK(listing.price)}` : "") +
            (listing.fee ? ` – Avgift: ${formatSEK(listing.fee)}` : "")
        );
      } else {
        toast.warning("Kunde inte hitta pris eller avgift i annonsen");
      }
    } catch (err) {
      console.error("Fetch listing error:", err);
      toast.error("Något gick fel vid hämtning");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Månadskalkylator</h1>
          <p className="text-muted-foreground">Bostad & bil – räkna ut din totala månadskostnad</p>
        </div>

        {/* Import annons */}
        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-muted-foreground">
              🔗 Importera annons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="Klistra in länk från Hemnet eller Booli..."
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleFetchListing()}
                />
              </div>
              <Button onClick={handleFetchListing} disabled={isLoading || !safeSupabase}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hämta"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Priset och månadsavgiften hämtas automatiskt från annonsen.
            </p>
          </CardContent>
        </Card>

        {/* Budgivning */}
        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-muted-foreground">
              📈 Budgivning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">
                Förväntad prisökning vid budgivning
              </Label>
              <span className="text-lg font-semibold text-primary">+{bidIncrease} %</span>
            </div>
            <Slider
              value={[bidIncrease]}
              onValueChange={(v) => setBidIncrease(v[0])}
              min={0}
              max={30}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Utgångspris: {formatSEK(basePrice)}</span>
              <span>Slutpris: {formatSEK(price)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Inputs side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-muted-foreground">🏠 Bostad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputField("Utgångspris", basePrice, setBasePrice, "kr")}
              {inputField("Kontantinsats", downPayment, setDownPayment, "kr")}
              {inputField("Månadsavgift till föreningen", fee, setFee, "kr", 100)}
              {inputField("Ränta", interestRate, setInterestRate, "%", 0.1)}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-muted-foreground">🚗 Bil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputField("Bilens pris", carPrice, setCarPrice, "kr")}
              {inputField("Kontantinsats", carDownPayment, setCarDownPayment, "kr")}
              {inputField("Ränta", carInterestRate, setCarInterestRate, "%", 0.1)}
              {inputField("Övrig månadskostnad (försäkring m.m.)", carMonthlyCost, setCarMonthlyCost, "kr", 100)}
            </CardContent>
          </Card>
        </div>

        {/* Results side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-muted-foreground">🏠 Resultat – Bostad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {bidIncrease > 0 && resultRow("Utgångspris", formatSEK(basePrice))}
              {bidIncrease > 0 && resultRow("Budökning", `+${bidIncrease} %`)}
              {resultRow("Slutpris", formatSEK(price))}
              {resultRow("Lån", formatSEK(loan))}
              {resultRow("Belåningsgrad", formatPercent(ltv * 100))}
              {resultRow("Amorteringstakt", `${amortizationRate} % / år`)}
              <Separator className="my-2" />
              {resultRow("Ränta", formatSEK(monthlyInterest))}
              {resultRow("Amortering", formatSEK(monthlyAmortization))}
              {resultRow("Avgift", formatSEK(fee))}
              <Separator className="my-2" />
              {resultRow("Bostad / månad", formatSEK(housingMonthlyCost), true)}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-muted-foreground">🚗 Resultat – Bil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {resultRow("Billån", formatSEK(carLoan))}
              <Separator className="my-2" />
              {resultRow("Ränta", formatSEK(carMonthlyInterest))}
              {resultRow("Övrig kostnad", formatSEK(carMonthlyCost))}
              <Separator className="my-2" />
              {resultRow("Bil / månad", formatSEK(carTotalMonthlyCost), true)}
            </CardContent>
          </Card>
        </div>

        {/* Totalt */}
        <Card className="shadow-lg border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            {resultRow("Bostad", formatSEK(housingMonthlyCost))}
            {resultRow("Bil", formatSEK(carTotalMonthlyCost))}
            <Separator className="my-2" />
            {resultRow("Total månadskostnad", formatSEK(grandTotal), true)}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Amortering på bostad enligt svenska amorteringskrav.
        </p>
      </div>
    </div>
  );
};

export default Index;
