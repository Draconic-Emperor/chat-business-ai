import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Building2, LogOut, Save, Settings2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const BUSINESS_TYPES = [
  "Shop (duka)",
  "Kiosk (vibanda)",
  "Butchery",
  "Hardware",
  "Salon / barber shop",
  "Boutique / clothes",
  "Food stall / hotel",
  "Online seller",
  "General retail",
  "Services",
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const business = useQuery(api.business.getMyBusinessQuery, {});
  const update = useMutation(api.business.updateBusiness);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (business && !hydrated) {
      setName(business.businessName ?? "");
      setType(business.businessType ?? BUSINESS_TYPES[0]);
      setHydrated(true);
    }
  }, [business, hydrated]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setBusy(true);
    try {
      await update({
        businessName: name.trim(),
        businessType: type.trim() || "General shop",
      });
      toast.success("Saved ✅");
    } catch (err) {
      toast.error("Could not save", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    business !== undefined &&
    business !== null &&
    (name !== business.businessName || type !== business.businessType);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings2 className="size-6 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Your business profile — used in chat replies and PDF reports.
        </p>
      </div>

      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" /> Business profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {business === undefined ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-5 text-primary" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="biz-name">Business name</Label>
                <Input
                  id="biz-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Usha Grocery"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Business type</Label>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        type === t
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void save()}
                  disabled={busy || !dirty}
                  className="gap-2"
                >
                  {busy ? <Spinner className="size-4" /> : <Save className="size-4" />}
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {user?.email ?? user?.name ?? "—"}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => void signOut()}
            className="w-full gap-2"
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
