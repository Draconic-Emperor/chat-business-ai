import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatKES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Item = Doc<"inventory">;

const EMPTY = { name: "", qty: "10", price: "", cost: "", threshold: "5" };

export default function Inventory() {
  const items = useQuery(api.inventory.list, {});
  const addItem = useMutation(api.inventory.add);
  const updateItem = useMutation(api.inventory.update);
  const removeItem = useMutation(api.inventory.remove);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter((i) => i.productName.toLowerCase().includes(q));
  }, [items, query]);

  const lowCount = (items ?? []).filter((i) => i.quantity <= i.lowStockThreshold).length;

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({
      name: item.productName,
      qty: String(item.quantity),
      price: String(item.sellingPrice),
      cost: String(item.costPrice),
      threshold: String(item.lowStockThreshold),
    });
    setOpen(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Enter an item name");
      return;
    }
    const qty = Math.max(0, Math.floor(Number(form.qty) || 0));
    const price = Math.max(0, Number(form.price) || 0);
    const cost = Math.max(0, Number(form.cost) || 0);
    const threshold = Math.max(0, Math.floor(Number(form.threshold) || 5));
    if (price <= 0) {
      toast.error("Selling price must be greater than zero");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateItem({
          id: editing._id,
          productName: name,
          quantity: qty,
          costPrice: cost || price,
          sellingPrice: price,
          lowStockThreshold: threshold,
        });
        toast.success("Item updated");
      } else {
        await addItem({
          productName: name,
          quantity: qty,
          costPrice: cost || price,
          sellingPrice: price,
          lowStockThreshold: threshold,
        });
        toast.success("Item added");
      }
      setOpen(false);
    } catch (err) {
      toast.error("Could not save", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item? Its transaction history stays intact.")) return;
    try {
      await removeItem({ id: id as Item["_id"] });
      toast.success("Item deleted");
    } catch (err) {
      toast.error("Could not delete", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {items === undefined
              ? "Loading…"
              : `${items.length} items · ${lowCount} low stock`}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 self-start">
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {lowCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {lowCount} item{lowCount === 1 ? " is" : "s are"} running low — buy stock
            before selling.
          </span>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items by name…"
          className="pl-9"
        />
      </div>

      {items === undefined ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/40">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">
              {query ? "No items match that name" : "No inventory yet"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {query
                ? "Try a different search."
                : "Add your stock manually, or just tell the assistant: “I have 20 shirts at KES 350 each”."}
            </p>
            {!query && (
              <Button variant="outline" size="sm" onClick={openNew} className="mt-2 gap-2">
                <Plus className="size-4" /> Add first item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/50">
          <table className="table-fintech w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-slate-300">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Sell price</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item._id}
                  className="border-b border-border/40 text-slate-200 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.productName}</span>
                      {item.quantity <= item.lowStockThreshold && (
                        <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          low
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">{item.quantity}</td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">
                    {formatKES(item.sellingPrice)}
                  </td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">
                    {formatKES(item.costPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => void handleDelete(item._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "Add item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Item name</Label>
              <Input
                id="inv-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Shirt"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-qty">Quantity</Label>
                <Input
                  id="inv-qty"
                  type="number"
                  min={0}
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-threshold">Low-stock alert at</Label>
                <Input
                  id="inv-threshold"
                  type="number"
                  min={0}
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-price">Sell price</Label>
                <Input
                  id="inv-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="350"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-cost">Cost per unit</Label>
                <Input
                  id="inv-cost"
                  type="number"
                  min={0}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="250"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void save()} className="gap-2">
                {busy && <Spinner className="size-4" />}
                {editing ? "Save changes" : "Add item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
