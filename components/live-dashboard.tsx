"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle, ClipboardList, DollarSign, PackageX, RefreshCw, Truck } from "lucide-react";
import { listInventoryItems } from "@/lib/supabase/inventory";
import { listPurchaseOrders, listSuppliers } from "@/lib/supabase/procurement";
import { formatCurrency } from "@/lib/currency";

type Props = { ownerId: string; userName?: string };
type RecordData = { inventory: any[]; suppliers: any[]; orders: any[] };

export function LiveDashboard({ ownerId, userName }: Props) {
  const [data, setData] = useState<RecordData>({ inventory: [], suppliers: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const [inventory, suppliers, orders] = await Promise.all([listInventoryItems(ownerId), listSuppliers(ownerId), listPurchaseOrders(ownerId)]);
    const firstError = inventory.error || suppliers.error || orders.error;
    if (firstError) setError(firstError.message);
    setData({ inventory: inventory.data ?? [], suppliers: suppliers.data ?? [], orders: orders.data ?? [] });
    setLoading(false);
  }
  useEffect(() => { void load(); }, [ownerId]);

  const stats = useMemo(() => {
    const inventoryValue = data.inventory.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unit_cost ?? 0), 0);
    const low = data.inventory.filter(item => item.status === "low_stock" || (item.quantity > 0 && item.quantity <= item.reorder_level)).length;
    const out = data.inventory.filter(item => item.status === "out_of_stock" || Number(item.quantity ?? 0) <= 0).length;
    const activeSuppliers = data.suppliers.filter(item => (item.status ?? "active") === "active").length;
    const orderStatuses = data.orders.reduce<Record<string, number>>((acc, item) => { const key = String(item.status ?? "pending").toLowerCase(); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
    return { inventoryValue, low, out, activeSuppliers, orderStatuses };
  }, [data]);

  const categories = useMemo(() => Object.entries(data.inventory.reduce<Record<string, number>>((acc, item) => { const key = item.category || "Uncategorized"; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]), [data.inventory]);

  const statCards: Array<{ label: string; value: string | number; Icon: typeof Boxes }> = [["Total Products", data.inventory.length, Boxes], ["Inventory Value", formatCurrency(stats.inventoryValue), DollarSign], ["Active Suppliers", stats.activeSuppliers, Truck], ["Low Stock", stats.low, AlertTriangle], ["Out of Stock", stats.out, PackageX]].map(([label, value, Icon]) => ({ label: String(label), value: value as string | number, Icon: Icon as typeof Boxes }));

  return <div className="space-y-6">
    <div className="rounded-2xl bg-violet-700 px-6 py-6 text-white"><p className="text-sm text-violet-200">Welcome back{userName ? `, ${userName}` : ""}</p><h1 className="mt-1 text-xl font-bold">Merchandising Management System</h1><h2 className="mt-1 text-sm font-semibold text-violet-100">Supply Chain &amp; Inventory Management</h2><p className="mt-1 text-sm text-violet-200">Monitor inventory, suppliers, purchase orders, sales, and stock levels across all product categories.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Unable to load live records: {error}</div>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {statCards.map(({ label, value, Icon }) => <div key={label} className="rounded-2xl border bg-white p-5"><Icon size={18} className="text-violet-700" /><div className="mt-4 text-2xl font-bold text-slate-900">{loading ? "—" : value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Inventory Alerts</h2><p className="text-xs text-slate-500">Only records needing attention</p></div><AlertTriangle size={18} className="text-amber-500" /></div>{!loading && data.inventory.filter(item => item.status !== "in_stock").length === 0 ? <p className="mt-8 text-sm text-slate-500">No inventory alerts.</p> : <div className="mt-4 space-y-3">{data.inventory.filter(item => item.status !== "in_stock").slice(0, 5).map(item => <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><div className="text-sm font-semibold text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{item.sku} · {item.category || "Uncategorized"}</div></div><span className="text-xs font-semibold text-red-600">{item.quantity ?? 0} units</span></div>)}</div>}</section>
      <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Product Categories</h2><p className="text-xs text-slate-500">Current product distribution</p></div><Boxes size={18} className="text-violet-700" /></div>{categories.length === 0 ? <p className="mt-8 text-sm text-slate-500">No category data yet.</p> : <div className="mt-4 space-y-3">{categories.map(([category, count]) => <div key={category} className="flex items-center justify-between"><span className="text-sm text-slate-700">{category}</span><span className="text-sm font-bold text-slate-900">{count}</span></div>)}</div>}</section>
    </div>
    <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Purchase Order Summary</h2><p className="text-xs text-slate-500">Current database status counts</p></div><ClipboardList size={18} className="text-violet-700" /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{["pending", "ordered", "in_transit", "received", "cancelled"].map(status => <div key={status} className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-bold text-slate-900">{stats.orderStatuses[status] ?? 0}</div><div className="text-xs capitalize text-slate-500">{status.replace("_", " ")}</div></div>)}</div></section>
    <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={14} /> Refresh live data</button>
  </div>;
}

export default LiveDashboard;
