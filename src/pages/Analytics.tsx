import { useQuery } from "convex/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Landmark } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatCompactKES, formatKES } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SeriesRow = {
  label: string;
  sales: number;
  expenses: number;
  purchases: number;
  profit: number;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatKES(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const month = useQuery(api.analytics.overview, { range: "month" });
  const daily = useQuery(api.analytics.dailySeries, { days: 14 });
  const monthly = useQuery(api.analytics.monthlySeries, { months: 12 });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="size-6 text-primary" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Every figure is computed live from your own transactions.
        </p>
      </div>

      {/* Headline numbers (this month) */}
      <div className="grid gap-3 sm:grid-cols-3">
        {month === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))
        ) : month === null ? (
          <p className="text-sm text-muted-foreground">No business yet.</p>
        ) : (
          <>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">This month sales</p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {formatKES(month.sales)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">
                  This month expenses + purchases
                </p>
                <p className="mt-1 text-xl font-bold text-red-400">
                  {formatKES(month.expenses + month.purchases)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">This month profit</p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {formatKES(month.profit)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Daily chart */}
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          {daily === undefined ? (
            <Skeleton className="h-64" />
          ) : daily.every((d) => d.sales === 0 && d.expenses === 0 && d.purchases === 0) ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No transactions in the last 14 days — record some in the assistant.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCompactKES(v).replace("KES ", "")}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--primary)", opacity: 0.08 }}
                  />
                  <Bar dataKey="sales" name="Sales" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Profit" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly chart */}
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4 text-primary" /> Monthly trend (12 months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthly === undefined ? (
            <Skeleton className="h-56" />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly as SeriesRow[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCompactKES(v).replace("KES ", "")}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="#0EA5E9"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0EA5E9" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    name="Sales"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    opacity={0.7}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top products */}
      {month !== undefined && month !== null && month.topProducts.length > 0 && (
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Best sellers this month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {month.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 text-xs">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate capitalize">{p.name}</span>
                <span className="font-mono text-emerald-400">{formatKES(p.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
