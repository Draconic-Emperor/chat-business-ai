import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { HandCoins, Search, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatKES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Customer = Doc<"customers">;

export default function Customers() {
  const customers = useQuery(api.customers.list, {});
  const recordPayment = useMutation(api.customers.recordPayment);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers ?? [];
    return (customers ?? []).filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  const totalDebt = (customers ?? []).reduce((s, c) => s + c.balance, 0);

  const pay = async (c: Customer) => {
    const amount = window.prompt(
      `Amount ${c.name} just paid (KES). Balance is ${formatKES(c.balance)}:`,
      String(Math.max(0, Math.round(c.balance))),
    );
    if (amount === null) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusyId(c._id);
    try {
      const paid = await recordPayment({ id: c._id, amount: value });
      toast.success(`Payment of ${formatKES(paid)} recorded`);
    } catch (err) {
      toast.error("Payment failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          {customers === undefined
            ? "Loading…"
            : `${customers.length} customers${
                totalDebt > 0 ? ` · ${formatKES(totalDebt)} owed to you` : ""
              }`}
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers…"
          className="pl-9"
        />
      </div>

      {customers === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/40">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="size-6" />
            </div>
            <p className="text-sm font-medium">
              {query ? "No customers match that name" : "No customers yet"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {query
                ? "Try a different search."
                : "They appear automatically when you record a sale, debt or payment: “John owes me 500”."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card key={c._id} className="border-border/70 bg-card/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Spent {formatKES(c.totalSpent)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        c.balance > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {formatKES(c.balance)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.balance > 0 ? "deni" : "cleared"}
                    </p>
                  </div>
                </div>
                {c.balance > 0 && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      disabled={busyId === c._id}
                      onClick={() => void pay(c)}
                    >
                      <HandCoins className="size-4" /> Record payment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
