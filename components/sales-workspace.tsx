"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { DollarSign, Plus, ShoppingCart } from "lucide-react"
import { listInventoryItems } from "@/lib/supabase/inventory"
import { listSales, recordSale } from "@/lib/supabase/sales"
import { formatCurrency } from "@/lib/currency"

type Item = { id: string; sku: string; name: string; quantity: number; unit_cost: number; status: string }
type Sale = { id: string; quantity: number; unit_price: number; total_amount: number; customer_name?: string; created_at: string; inventory_items?: { name: string; sku: string } | null }

export function SalesWorkspace({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [form, setForm] = useState({ inventoryItemId: "", quantity: "1", unitPrice: "", customerName: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function load() {
    const [inventory, transactions] = await Promise.all([listInventoryItems(ownerId), listSales(ownerId)])
    if (inventory.error || transactions.error) setMessage("Unable to load sales data. Confirm that the latest Supabase migrations have been applied.")
    setItems((inventory.data || []) as Item[])
    setSales((transactions.data || []) as Sale[])
  }
  useEffect(() => { void load() }, [ownerId])

  const selected = useMemo(() => items.find(item => item.id === form.inventoryItemId), [items, form.inventoryItemId])
  function selectItem(id: string) {
    const item = items.find(candidate => candidate.id === id)
    setForm(current => ({ ...current, inventoryItemId: id, unitPrice: item ? String(item.unit_cost || "") : current.unitPrice }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("")
    try {
      const result = await recordSale({ inventoryItemId: form.inventoryItemId, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice), customerName: form.customerName, notes: form.notes })
      if (result.error) throw new Error(result.error.message)
      setForm({ inventoryItemId: "", quantity: "1", unitPrice: "", customerName: "", notes: "" })
      setMessage("Sale recorded and inventory updated.")
      await load()
      window.dispatchEvent(new Event("inventory-changed"))
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record sale") }
    finally { setSaving(false) }
  }
  const todayRevenue = sales.filter(sale => new Date(sale.created_at).toDateString() === new Date().toDateString()).reduce((total, sale) => total + Number(sale.total_amount || 0), 0)

  return <section className="space-y-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-slate-900">Sales Management</h2><p className="text-sm text-slate-500">Record sales and automatically update frozen-goods stock.</p></div><div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Today: {formatCurrency(todayRevenue)}</div></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Plus size={17} className="text-violet-700" /><h3 className="font-bold text-slate-900">Record a sale</h3></div>
        <label className="block text-sm font-medium text-slate-700">Product<select required value={form.inventoryItemId} onChange={event => selectItem(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Choose stock item</option>{items.filter(item => item.quantity > 0).map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku}) — {item.quantity} available</option>)}</select></label>
        {selected && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Available: {selected.quantity}. This sale may trigger a low-stock alert.</p>}
        <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">Quantity<input required min="1" step="1" type="number" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Unit price (PHP / ₱)<input required min="0" step="0.01" type="number" value={form.unitPrice} onChange={event => setForm({ ...form, unitPrice: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label></div>
        <label className="block text-sm font-medium text-slate-700">Customer <span className="font-normal text-slate-400">optional</span><input value={form.customerName} onChange={event => setForm({ ...form, customerName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label>
        <label className="block text-sm font-medium text-slate-700">Notes <span className="font-normal text-slate-400">optional</span><textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-2.5" /></label>
        <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><ShoppingCart size={16} />{saving ? "Recording…" : "Record sale"}</button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center gap-2 border-b border-slate-100 p-5"><DollarSign size={17} className="text-violet-700" /><h3 className="font-bold text-slate-900">Recent sales</h3></div>{message && <p role="status" className="m-4 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p>}<div className="overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Product", "Customer", "Quantity", "Unit price (PHP / ₱)", "Total (PHP / ₱)", "Date"].map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sales.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No sales have been recorded.</td></tr> : sales.map(sale => <tr key={sale.id}><td className="px-4 py-3 font-semibold text-slate-900">{sale.inventory_items?.name || "Inventory item"}<span className="block font-mono text-xs font-normal text-slate-500">{sale.inventory_items?.sku}</span></td><td className="px-4 py-3 text-slate-600">{sale.customer_name || "Walk-in"}</td><td className="px-4 py-3">{sale.quantity}</td><td className="px-4 py-3">{formatCurrency(Number(sale.unit_price))}</td><td className="px-4 py-3 font-semibold">{formatCurrency(Number(sale.total_amount))}</td><td className="px-4 py-3 text-slate-600">{new Date(sale.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>
    </div>
  </section>
}
