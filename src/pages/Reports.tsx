import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { FileText, Printer } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatDateTime, formatKES } from "@/lib/format";
import { downloadReport, type ReportData } from "@/lib/report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Reports() {
  const business = useQuery(api.business.getMyBusinessQuery, {});
  const month = useQuery(api.analytics.overview, { range: "month" });
  const inventory = useQuery(api.inventory.list, {});
  const customers = useQuery(api.customers.list, {});
  const daily = useQuery(api.analytics.dailySeries, { days: 30 });
  const recent = useQuery(api.transactions.recent, { limit: 30 });
  const [busy, setBusy] = useState(false);

  const debtors = (customers ?? []).filter((c) => c.balance > 0);

  const download = () => {
    if (!business || !month || !inventory || !customers || !daily) return;
    setBusy(true);
    try {
      const data: ReportData = {
        businessName: business.businessName,
        businessType: business.businessType,
        rangeLabel: "this month",
        generatedAt: Date.now(),
        overview: {
          sales: month.sales,
          salesCount: month.salesCount,
          expenses: month.expenses,
          purchases: month.purchases,
          payments: month.payments,
          profit: month.profit,
          stockValue: month.stockValue,
          lowStockCount: month.lowStockCount,
          productCount: month.productCount,
          totalCustomers: month.totalCustomers,
          outstandingDebt: month.outstandingDebt,
          topProducts: month.topProducts,
        },
        inventory: inventory.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          costPrice: i.costPrice,
          sellingPrice: i.sellingPrice,
          lowStockThreshold: i.lowStockThreshold,
        })),
        customers: customers.slice(0, 30).map((c) => ({
          name: c.name,
          totalSpent: c.totalSpent,
          balance: c.balance,
          phone: c.phone,
        })),
        dailySeries: daily.map((d) => ({
          label: d.label,
          sales: d.sales,
          expenses: d.expenses,
          purchases: d.purchases,
          profit: d.profit,
        })),
      };
      downloadReport(data);
      toast.success("Report downloaded 📄");
    } catch (err) {
      toast.error("Could not build the report", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="size-6 text-primary" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            {business ? `Statement of accounts for ${business.businessName}` : "Loading…"}
          </p>
        </div>
        <Button
          onClick={download}
          disabled={busy || !business || !month || !inventory || !customers || !daily}
          className="gap-2 self-start"
        >
          {busy ? <Spinner className="size-4" /> : <Printer className="size-4" />}
          Download PDF
        </Button>
      </div>

      {/* Summary cards */}
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
                <p className="mt-1 text-lg font-bold text-emerald-400">
                  {formatKES(month.sales)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {month.salesCount} transactions
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">This month profit</p>
                <p className="mt-1 text-lg font-bold text-primary">
                  {formatKES(month.profit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  after {formatKES(month.expenses + month.purchases)} costs
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/60">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Owed to you</p>
                <p className="mt-1 text-lg font-bold text-amber-400">
                  {formatKES(month.outstandingDebt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {debtors.length} customer{debtors.length === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Transactions */}
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {recent === undefined ? (
            <div className="px-6">
              <Skeleton className="h-48" />
            </div>
          ) : recent.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No transactions yet — record them through the assistant.
            </p>
          ) : (
            <Table className="table-fintech">
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="pr-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((t) => (
                  <TableRow key={t._id} className="border-border/40">
                    <TableCell className="pl-6 text-xs text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs font-medium capitalize">
                      {t.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.productName ?? t.customerName ?? "—"}
                      {t.quantity !== undefined ? ` × ${t.quantity}` : ""}
                    </TableCell>
                    <TableCell className="pr-6 text-right text-xs font-mono">
                      {formatKES(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        The PDF includes this month&apos;s profit &amp; loss, top products, inventory,
        customers and daily performance.
      </p>
    </div>
  );
}
