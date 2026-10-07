import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Store } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";

const BUSINESS_TYPES = [
  "General shop",
  "Kiosk",
  "Grocery / duka",
  "Hardware",
  "Salon / barber",
  "Online seller",
  "Market trader",
  "Wholesaler",
  "Electronics / cyber",
  "Repair shop",
  "Food business",
  "Other",
];

const TYPES_WITH_OTHER = BUSINESS_TYPES;

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(BUSINESS_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const createBusiness = useMutation(api.business.createBusiness);

  const destination = (() => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
    return "/dashboard";
  })();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const businessName = name.trim();
    if (businessName.length < 2) {
      setError("Give your business a name (at least 2 characters).");
      return;
    }
    setIsSaving(true);
    try {
      await createBusiness({ businessName, businessType: type });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create your business.",
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md glass">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Store className="size-6" />
          </div>
          <CardTitle className="text-xl">
            Karibu{user?.name ? `, ${user.name}` : ""}! Let's set up your shop
          </CardTitle>
          <CardDescription>
            One quick step — then you can run everything through chat.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business name</Label>
              <Input
                id="business-name"
                name="business-name"
                placeholder="e.g. Mama Njeri Staples"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-type">Business type</Label>
              <Select name="business-type" value={type} onValueChange={setType}>
                <SelectTrigger id="business-type" className="w-full">
                  <SelectValue placeholder="Choose your business type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_WITH_OTHER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </CardContent>
          <CardFooter className="mt-2 flex-col gap-2">
            <Button type="submit" className="w-full gap-2" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Create my business <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You can change the name and type later in Settings.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
