import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  ChevronRight,
  PackageX,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { formatKES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${tone}`}>
              {value}
            </p>
            {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 ${tone}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const business = useQuery(api.business.getMyBusinessQuery, {});
  const today = useQuery(api.analytics.overview, { range: "today" });
  const week = useQuery(api.analytics.overview, { range: "week" });
  const inventory = useQuery(api.inventory.list, {});
  const chatPreview = useQuery(api.chatStore.list, { limit: 6 });
  const sendMessage = useAction(api.chat.send);

  const lowStock = useMemo(
    () => (inventory ?? []).filter((i) => i.quantity <= i.lowStockThreshold),
    [inventory],
  );

  const [quickText, setQuickText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleQuick = async () => {
    const text = quickText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await sendMessage({ message: text });
      setResult(res);
      setQuickText("");
    } catch (err) {
      toast.error("Could not record that", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const greeting = user?.name
    ? `, ${user.name.split(" ")[0]}`
    : user?.email
      ? `, ${user.email.split("@")[0]}`
      : "";
  const o = today === undefined ? undefined : today;
  const w = week === undefined ? undefined : week;

  const statsReady = o !== undefined && w !== undefined && business !== undefined;
  const hasBusiness = o !== null && w !== null && business !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Karibu tena{greeting} 👋</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {!statsReady ? (
              <Skeleton className="h-8 w-64" />
            ) : !hasBusiness || o === null ? (
              "Loading your business…"
            ) : (
              <>
                Today&apos;s profit:{" "}
                <span className="text-primary glow-text">{formatKES(o.profit)}</span>
              </>
            )}
          </h1>
        </div>
        <Button type="button" onClick={() => navigate("/chat")} className="gap-2 self-start">
          <Bot className="size-4" />
          Ask the assistant
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!statsReady || o === null || w === null ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[116px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Sales today"
              value={formatKES(o.sales)}
              sub={`${o.salesCount} sale${o.salesCount === 1 ? "" : "s"}`}
              icon={ArrowUpRight}
              tone="text-emerald-400"
            />
            <StatCard
              label="Profit today"
              value={formatKES(o.profit)}
              sub={`Last 7 days: ${formatKES(w.profit)}`}
              icon={TrendingUp}
              tone="text-teal-400"
            />
            <StatCard
              label="Owed to you (deni)"
              value={formatKES(o.outstandingDebt)}
              sub={`${o.totalCustomers} customer${o.totalCustomers === 1 ? "" : "s"}`}
              icon={ArrowDownLeft}
              tone="text-amber-400"
            />
            <StatCard
              label="Stock value"
              value={formatKES(o.stockValue)}
              sub={`${o.productCount} products · ${o.lowStockCount} low`}
              icon={Wallet}
              tone="text-sky-400"
            />
          </>
        )}
      </div>

      {/* Second row */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Quick record */}
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-primary" /> Quick record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={2}
              placeholder="e.g. Nimeuza 2 shirts kwa 800"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleQuick();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={busy || !quickText.trim()}
                onClick={() => void handleQuick()}
                className="flex-1 gap-2"
              >
                {busy ? <Spinner className="size-4" /> : <Bot className="size-4" />}
                Record it
              </Button>
              {result && (
                <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                  Clear
                </Button>
              )}
            </div>
            {result && (
              <p className="max-h-32 overflow-y-auto rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
                {result}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageX className="size-4 text-amber-400" /> Low stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inventory === undefined ? (
              <Skeleton className="h-20" />
            ) : lowStock.length === 0 ? (
              <p className="text-xs text-muted-foreground">All stock levels healthy ✅</p>
            ) : (
              <>
                {lowStock.slice(0, 5).map((i) => (
                  <div key={i._id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{i.productName}</span>
                    <span className="font-mono text-amber-400">{i.quantity} left</span>
                  </div>
                ))}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => navigate("/inventory")}
                >
                  Manage inventory <ChevronRight className="size-3" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Week overview */}
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {w === undefined ? (
              <Skeleton className="h-20" />
            ) : w === null ? (
              <p className="text-muted-foreground">No data yet.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sales</span>
                  <span className="font-mono text-emerald-400">{formatKES(w.sales)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-mono text-red-400">{formatKES(w.expenses)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Purchases</span>
                  <span className="font-mono text-teal-400">{formatKES(w.purchases)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="font-medium">Profit</span>
                  <span className="font-mono font-bold text-primary">{formatKES(w.profit)}</span>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => navigate("/analytics")}
                >
                  Open analytics <ChevronRight className="size-3" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat preview + inventory snapshot */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-primary" /> Recent assistant activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {chatPreview === undefined ? (
              <Skeleton className="h-20" />
            ) : chatPreview.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing yet — say{" "}
                <span className="text-primary">“Nimeuza 2 shirts kwa 800”</span> in the{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2"
                  onClick={() => navigate("/chat")}
                >
                  assistant
                </button>
                .
              </p>
            ) : (
              chatPreview.map((m) => (
                <div key={m._id} className="text-xs leading-relaxed">
                  <span className={m.role === "user" ? "text-muted-foreground" : "text-primary"}>
                    {m.role === "user" ? "You:" : "AI:"}
                  </span>{" "}
                  <span className={m.role === "user" ? "text-foreground/80" : "text-foreground/90"}>
                    {m.content.length > 140 ? m.content.slice(0, 140) + "…" : m.content}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inventory snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {inventory === undefined ? (
              <Skeleton className="h-24" />
            ) : inventory.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  No items yet — the assistant can add them for you.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/inventory")}>
                  Go to inventory
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {inventory.slice(0, 6).map((i) => (
                  <div key={i._id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{i.productName}</span>
                    <span className="font-mono text-muted-foreground">
                      {i.quantity} × {formatKES(i.sellingPrice)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
