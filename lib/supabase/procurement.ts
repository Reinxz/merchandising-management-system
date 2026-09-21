import { createClient } from './client'
import { recordAuditLog } from './audit'

export async function listSuppliers(ownerId: string) {
  return createClient().from('suppliers').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false })
}

export async function createSupplier(ownerId: string, supplier: { name: string; contact_name?: string; email?: string; phone?: string; rating?: number }) {
  const name = supplier.name.trim()
  if (!name) throw new Error('Supplier name is required')
  if (supplier.rating != null && (!Number.isFinite(supplier.rating) || supplier.rating < 0 || supplier.rating > 5)) throw new Error('Supplier rating must be between 0 and 5')
  const result = await createClient().from('suppliers').insert({ ...supplier, name, owner_id: ownerId }).select().single()
  if (result.data) void recordAuditLog({ userId: ownerId, action: 'create', module: 'suppliers', recordId: result.data.id, description: `Created supplier ${supplier.name.trim()}` })
  return result
}

export async function listPurchaseOrders(ownerId: string) {
  return createClient().from('purchase_orders').select('*, suppliers(name)').eq('owner_id', ownerId).order('created_at', { ascending: false })
}

type PurchaseOrderInput = {
  po_number: string
  supplier_id?: string
  item_name?: string
  quantity?: number
  unit_cost?: number
  total_amount?: number
  expected_date?: string
  status?: string
}

function validatePurchaseOrder(order: Partial<PurchaseOrderInput>) {
  if (order.quantity != null && (!Number.isInteger(order.quantity) || order.quantity <= 0)) throw new Error('Purchase order quantity must be a positive integer')
  if (order.unit_cost != null && (!Number.isFinite(order.unit_cost) || order.unit_cost < 0)) throw new Error('Unit cost cannot be negative')
  if (order.total_amount != null && (!Number.isFinite(order.total_amount) || order.total_amount < 0)) throw new Error('Total amount must be valid and non-negative')
  if (order.expected_date && Number.isNaN(Date.parse(order.expected_date))) throw new Error('Expected delivery must be a valid date')
}

export async function createPurchaseOrder(ownerId: string, order: PurchaseOrderInput) {
  const poNumber = order.po_number.trim()
  if (!poNumber) throw new Error('Purchase order number is required')
  validatePurchaseOrder(order)
  const result = await createClient().from('purchase_orders').insert({ ...order, po_number: poNumber, owner_id: ownerId }).select().single()
  if (result.data) void recordAuditLog({ userId: ownerId, action: 'create', module: 'purchase_orders', recordId: result.data.id, description: `Created purchase order ${poNumber}` })
  return result
}

export async function updateSupplier(id: string, ownerId: string, supplier: Partial<{ name: string; contact_name: string; email: string; phone: string; rating: number; status: 'active' | 'inactive' | 'pending' }>) {
  const result = await createClient().from('suppliers').update(supplier).eq('id', id).eq('owner_id', ownerId).select().single()
  if (result.data) void recordAuditLog({ userId: ownerId, action: 'update', module: 'suppliers', recordId: id, description: `Updated supplier ${id}` })
  return result
}

export async function deleteSupplier(id: string, ownerId: string) {
  const result = await createClient().from('suppliers').delete().eq('id', id).eq('owner_id', ownerId)
  if (!result.error) void recordAuditLog({ userId: ownerId, action: 'delete', module: 'suppliers', recordId: id, description: `Deleted supplier ${id}` })
  return result
}

export async function updatePurchaseOrder(id: string, ownerId: string, order: Partial<PurchaseOrderInput>) {
  validatePurchaseOrder(order)
  const result = await createClient().from('purchase_orders').update(order).eq('id', id).eq('owner_id', ownerId).select().single()
  if (result.data) void recordAuditLog({ userId: ownerId, action: order.status === 'approved' ? 'approve' : order.status === 'cancelled' ? 'cancel' : 'update', module: 'purchase_orders', recordId: id, description: `Updated purchase order ${id}` })
  return result
}

export async function deletePurchaseOrder(id: string, ownerId: string) {
  const result = await createClient().from('purchase_orders').delete().eq('id', id).eq('owner_id', ownerId)
  if (!result.error) void recordAuditLog({ userId: ownerId, action: 'delete', module: 'purchase_orders', recordId: id, description: `Deleted purchase order ${id}` })
  return result
}
