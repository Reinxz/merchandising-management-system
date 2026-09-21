"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2, X } from "lucide-react"
import {
  createPurchaseOrder,
  createSupplier,
  deletePurchaseOrder,
  deleteSupplier,
  listPurchaseOrders,
  listSuppliers,
  updatePurchaseOrder,
  updateSupplier,
} from "@/lib/supabase/procurement"
import { formatCurrency } from "@/lib/currency"

type Supplier = {
  id: string
  owner_id: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  rating?: number | null
  status?: string | null
}
type Order = {
  id: string
  owner_id: string
  po_number: string
  supplier_id?: string | null
  item_name?: string | null
  quantity?: number | null
  unit_cost?: number | null
  total_amount?: number | null
  expected_date?: string | null
  status?: string | null
  suppliers?: { name: string } | null
}

type FormValues = Record<string, string>

function formatExpectedDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ProcurementWorkspace({ ownerId, mode }: { ownerId: string; mode: "suppliers" | "orders" }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<FormValues>({})
  const [editing, setEditing] = useState<Supplier | Order | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    const [supplierResult, orderResult] = await Promise.all([
      listSuppliers(ownerId),
      listPurchaseOrders(ownerId),
    ])
    if (supplierResult.error || orderResult.error) {
      setMessage("Failed to load procurement data")
    } else {
      setSuppliers((supplierResult.data || []) as Supplier[])
      setOrders((orderResult.data || []) as Order[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [ownerId])

  const records = mode === "suppliers" ? suppliers : orders
  const filtered = useMemo(
    () => records.filter((record) => JSON.stringify(record).toLowerCase().includes(query.toLowerCase())),
    [records, query],
  )

  function startAdd() {
    setEditing(null)
    setForm(
      mode === "suppliers"
        ? { name: "", contact_name: "", email: "", phone: "", rating: "", status: "active" }
        : { po_number: "", supplier_id: "", item_name: "", quantity: "1", unit_cost: "0", total_amount: "0", expected_date: "", status: "pending" },
    )
    setOpen(true)
    setMessage("")
  }

  function startEdit(record: Supplier | Order) {
    setEditing(record)
    setForm(
      mode === "suppliers"
        ? {
            name: (record as Supplier).name,
            contact_name: (record as Supplier).contact_name || "",
            email: (record as Supplier).email || "",
            phone: (record as Supplier).phone || "",
            rating: String((record as Supplier).rating ?? ""),
            status: (record as Supplier).status || "active",
          }
        : {
            po_number: (record as Order).po_number,
            supplier_id: (record as Order).supplier_id || "",
            item_name: (record as Order).item_name || "",
            quantity: String((record as Order).quantity ?? 1),
            unit_cost: String((record as Order).unit_cost ?? 0),
            total_amount: String((record as Order).total_amount ?? 0),
            expected_date: (record as Order).expected_date || "",
            status: (record as Order).status || "pending",
          },
    )
    setOpen(true)
    setMessage("")
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      if (mode === "suppliers") {
        if (!form.name.trim()) throw new Error("Supplier name is required")
        const rating = form.rating.trim() ? Number(form.rating) : undefined
        if (rating !== undefined && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
          throw new Error("Rating must be between 0 and 5")
        }
        const payload: {
          name: string
          contact_name?: string
          email?: string
          phone?: string
          rating?: number
          status: "active" | "inactive" | "pending"
        } = {
          name: form.name,
          contact_name: form.contact_name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          rating,
          status: form.status === "inactive" || form.status === "pending" ? form.status : "active",
        }
        const result = editing
          ? await updateSupplier(editing.id, ownerId, payload)
          : await createSupplier(ownerId, payload)
        if (result.error) throw new Error(result.error.message)
      } else {
        if (!form.po_number.trim()) throw new Error("PO number is required")
        const quantity = Number(form.quantity)
        const unitCost = Number(form.unit_cost)
        if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive whole number")
        if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Unit cost cannot be negative")
        if (!form.expected_date || Number.isNaN(Date.parse(form.expected_date))) throw new Error("Expected delivery is required and must be a valid date")
        if (!editing && form.expected_date < todayIso()) throw new Error("Expected delivery cannot be earlier than today")
        const payload = {
          po_number: form.po_number,
          supplier_id: form.supplier_id || undefined,
          item_name: form.item_name || undefined,
          quantity,
          unit_cost: unitCost,
          total_amount: quantity * unitCost,
          expected_date: form.expected_date || undefined,
          status: form.status || "pending",
        }
        const result = editing
          ? await updatePurchaseOrder(editing.id, ownerId, payload)
          : await createPurchaseOrder(ownerId, payload)
        if (result.error) throw new Error(result.error.message)
      }
      setOpen(false)
      await load()
      setMessage(editing ? "Record updated" : mode === "suppliers" ? "Supplier added successfully" : "Purchase order created successfully")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function remove(record: Supplier | Order) {
    const label = mode === "suppliers" ? (record as Supplier).name : (record as Order).po_number
    if (!window.confirm(`Delete ${label}?`)) return
    const result = mode === "suppliers"
      ? await deleteSupplier(record.id, ownerId)
      : await deletePurchaseOrder(record.id, ownerId)
    if (result.error) setMessage("Delete failed")
    else {
      await load()
      setMessage("Record deleted")
    }
  }

  const orderTotal = Math.max(0, Number(form.quantity || 0)) * Math.max(0, Number(form.unit_cost || 0))
  const fields = mode === "suppliers"
    ? [["name", "Supplier name"], ["contact_name", "Contact person"], ["email", "Email"], ["phone", "Phone"], ["rating", "Rating (0-5)"], ["status", "Status"]]
    : [["po_number", "PO number"], ["supplier_id", "Supplier"], ["item_name", "Item/Product"], ["quantity", "Quantity"], ["unit_cost", "Unit Cost (PHP / ₱)"], ["total_amount", "Total Amount (PHP / ₱)"], ["expected_date", "Expected Delivery"], ["status", "Status"]]

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{mode === "suppliers" ? "Suppliers" : "Purchase Orders"}</h2>
          <p className="text-sm text-slate-500">Live procurement records from Supabase.</p>
        </div>
        <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
          <Plus size={16} /> {mode === "suppliers" ? "Add Supplier" : "Create PO"}
        </button>
      </div>

      <div className="flex rounded-2xl border border-slate-200 bg-white p-3">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${mode === "suppliers" ? "suppliers" : "purchase orders"}...`} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-500" />
        </label>
      </div>

      {message && <p role="status" className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[700px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{(mode === "suppliers" ? ["Name", "Contact", "Email", "Phone", "Rating", "Status", ""] : ["PO Number", "Supplier", "Item/Product", "Quantity", "Unit Cost", "Total Amount", "Expected Delivery", "Status", ""]).map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={mode === "suppliers" ? 7 : 9} className="px-4 py-12 text-center text-slate-500">Loading {mode === "suppliers" ? "suppliers" : "purchase orders"}...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={mode === "suppliers" ? 7 : 9} className="px-4 py-12 text-center text-slate-500">No {mode === "suppliers" ? "suppliers" : "purchase orders"} yet.</td></tr>
              : filtered.map((record) => mode === "suppliers"
                ? <tr key={record.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold text-slate-900">{(record as Supplier).name}</td><td className="px-4 py-3 text-slate-700">{(record as Supplier).contact_name || "—"}</td><td className="px-4 py-3 text-slate-700">{(record as Supplier).email || "—"}</td><td className="px-4 py-3 text-slate-700">{(record as Supplier).phone || "—"}</td><td className="px-4 py-3 text-slate-700">{(record as Supplier).rating ?? "—"}</td><td className="px-4 py-3 text-slate-700">{(record as Supplier).status}</td><td className="px-4 py-3"><Actions onEdit={() => startEdit(record)} onDelete={() => void remove(record)} /></td></tr>
                : <tr key={record.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-mono text-slate-900">{(record as Order).po_number}</td><td className="px-4 py-3 text-slate-700">{(record as Order).suppliers?.name || "Unassigned"}</td><td className="px-4 py-3 text-slate-700">{(record as Order).item_name || "—"}</td><td className="px-4 py-3 text-slate-700">{(record as Order).quantity ?? "—"}</td><td className="px-4 py-3 text-slate-700">{formatCurrency(Number((record as Order).unit_cost || 0))}</td><td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(Number((record as Order).total_amount || 0))}</td><td className="px-4 py-3 text-slate-700">{formatExpectedDate((record as Order).expected_date)}</td><td className="px-4 py-3 text-slate-700">{(record as Order).status}</td><td className="px-4 py-3"><Actions onEdit={() => startEdit(record)} onDelete={() => void remove(record)} /></td></tr>)}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false) }}>
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="procurement-dialog-title">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="procurement-dialog-title" className="text-lg font-bold text-slate-900">{editing ? "Edit" : "Add"} {mode === "suppliers" ? "Supplier" : "Purchase Order"}</h3>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([key, label]) => key === "supplier_id"
                ? <label key={key} className="space-y-1 text-sm font-medium text-slate-700">{label}<select value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 outline-none focus:border-violet-500"><option value="">Unassigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                : key === "total_amount"
                ? <label key={key} className="space-y-1 text-sm font-medium text-slate-700">Total Amount (PHP / ₱)<input readOnly value={formatCurrency(orderTotal)} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 font-semibold text-slate-900" /></label>
                : <label key={key} className="space-y-1 text-sm font-medium text-slate-700">{label}<input required={key === "name" || key === "po_number" || (mode === "orders" && (key === "quantity" || key === "unit_cost" || key === "expected_date"))} type={key === "rating" || key === "quantity" || key === "unit_cost" ? "number" : key === "email" ? "email" : key === "expected_date" ? "date" : "text"} min={key === "expected_date" && !editing ? todayIso() : key === "rating" ? 0 : key === "quantity" ? 1 : key === "unit_cost" ? 0 : undefined} max={key === "rating" ? 5 : undefined} step={key === "rating" ? 0.1 : key === "quantity" ? 1 : key === "unit_cost" ? 0.01 : undefined} value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label>)}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editing ? "Save changes" : mode === "suppliers" ? "Add Supplier" : "Create PO"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex gap-2"><button aria-label="Edit record" onClick={onEdit} className="text-slate-500 hover:text-violet-700"><Pencil size={15} /></button><button aria-label="Delete record" onClick={onDelete} className="text-slate-500 hover:text-red-600"><Trash2 size={15} /></button></div>
}
