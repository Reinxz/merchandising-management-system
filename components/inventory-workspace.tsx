"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { createInventoryItem, deleteInventoryItem, inventoryStatus, listInventoryItems, updateInventoryItem, type InventoryItemInput } from "@/lib/supabase/inventory"
import { formatCurrency } from "@/lib/currency"

type Item = InventoryItemInput & { id: string; owner_id: string; created_at: string }

const categoryOptions = ["Dry Products", "Frozen Products", "Cosmetic Products"]
const empty: InventoryItemInput = { sku: "", name: "", category: "Frozen Products", quantity: 0, reorder_level: 10, unit_cost: 0, warehouse_location: "Warehouse A" }

export function InventoryWorkspace({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [form, setForm] = useState<InventoryItemInput>(empty)
  const [editing, setEditing] = useState<Item | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    const result = await listInventoryItems(ownerId)
    if (result.error) setMessage("Failed to load inventory")
    else setItems((result.data || []) as Item[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [ownerId])

  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.sku} ${item.name} ${item.category || ""} ${item.warehouse_location || ""}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (statusFilter === "all" || item.status === statusFilter)
  }), [items, query, statusFilter])
  const totalValue = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_cost || 0), 0)

  function startEdit(item: Item) { setEditing(item); setForm({ ...item }); setOpen(true); setMessage("") }
  function startAdd() { setEditing(null); setForm(empty); setOpen(true); setMessage("") }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("")
    try {
      const next = { ...form, quantity: Number(form.quantity), reorder_level: Number(form.reorder_level), unit_cost: Number(form.unit_cost), status: inventoryStatus(Number(form.quantity), Number(form.reorder_level)) }
      const result = editing ? await updateInventoryItem(editing.id, ownerId, next) : await createInventoryItem(ownerId, next)
      if (result.error) throw new Error(result.error.code === "23505" ? "SKU already exists" : result.error.message)
      setOpen(false); await load(); setMessage(editing ? "Inventory item updated" : "Inventory item added")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to save inventory item") }
    finally { setSaving(false) }
  }
  async function remove(item: Item) {
    if (!window.confirm(`Delete ${item.name}?`)) return
    const result = await deleteInventoryItem(item.id, ownerId)
    if (result.error) setMessage("Failed to delete inventory item")
    else { await load(); setMessage("Inventory item deleted") }
  }

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-bold text-slate-900">Product Inventory</h2><p className="text-sm text-slate-500">Track stock levels, warehouse locations, and product value across all categories.</p></div>
      <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"><Plus size={16} /> Add Item</button>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[['Products', items.length], ['In Stock', items.filter(i => i.status === 'in_stock').length], ['Low / Out', items.filter(i => i.status === 'low_stock' || i.status === 'out_of_stock').length], ['Value', formatCurrency(totalValue)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}
    </div>
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search SKU, product, category, warehouse..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-violet-500" /></label><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="on_order">On order</option></select></div>
    {message && <p role="status" className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['SKU','Product','Category','Stock','Reorder','Unit Cost (PHP / ₱)','Total Value (PHP / ₱)','Warehouse','Status',''].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Loading inventory...</td></tr> : filtered.length === 0 ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No product inventory yet. <button onClick={startAdd} className="font-semibold text-violet-700">Add Item</button></td></tr> : filtered.map(item => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sku}</td><td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td><td className="px-4 py-3 text-slate-600">{item.category || "—"}</td><td className="px-4 py-3 font-semibold">{item.quantity}</td><td className="px-4 py-3 text-slate-600">{item.reorder_level}</td><td className="px-4 py-3">{formatCurrency(Number(item.unit_cost || 0))}</td><td className="px-4 py-3">{formatCurrency((item.quantity || 0) * (item.unit_cost || 0))}</td><td className="px-4 py-3 text-slate-600">{item.warehouse_location || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === 'in_stock' ? 'bg-emerald-50 text-emerald-700' : item.status === 'out_of_stock' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.status?.replaceAll('_', ' ')}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button aria-label={`Edit ${item.name}`} onClick={() => startEdit(item)} className="text-slate-500 hover:text-violet-700"><Pencil size={15} /></button><button aria-label={`Delete ${item.name}`} onClick={() => void remove(item)} className="text-slate-500 hover:text-red-600"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></div>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-bold text-slate-900">{editing ? 'Edit inventory item' : 'Add product item'}</h3><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button></div><div className="grid gap-3 sm:grid-cols-2">{[['sku','SKU'],['name','Product name'],['category','Category'],['warehouse_location','Warehouse location'],['quantity','Quantity'],['reorder_level','Reorder level'],['unit_cost','Unit cost']].map(([key,label]) => <label key={key} className="space-y-1 text-sm font-medium text-slate-700">{label}{key === 'category' ? <select value={String(form.category ?? '')} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-violet-500">{!categoryOptions.includes(String(form.category)) && form.category && <option value={String(form.category)}>{String(form.category)} (existing)</option>}{categoryOptions.map(option => <option key={option}>{option}</option>)}</select> : <input required={key === 'sku' || key === 'name'} type={['quantity','reorder_level','unit_cost'].includes(key) ? 'number' : 'text'} min={['quantity','reorder_level','unit_cost'].includes(key) ? 0 : undefined} step={key === 'unit_cost' ? '0.01' : '1'} value={String(form[key as keyof InventoryItemInput] ?? '')} onChange={e => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-violet-500" />}</label>)}</div><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save item'}</button></div></form></div>}
  </section>
}
