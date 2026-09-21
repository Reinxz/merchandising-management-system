import { createClient } from './client'
import { recordAuditLog } from './audit'

export type InventoryItemInput = {
  sku: string
  name: string
  category?: string
  quantity?: number
  reorder_level?: number
  unit_cost?: number
  warehouse_location?: string
  status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'on_order'
}

export async function listInventoryItems(ownerId: string) {
  return createClient().from('inventory_items').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false })
}

export async function createInventoryItem(ownerId: string, item: InventoryItemInput) {
  const sku = item.sku.trim()
  const name = item.name.trim()
  if (!sku || !name) throw new Error('SKU and item name are required')
  if ((item.quantity ?? 0) < 0 || (item.reorder_level ?? 0) < 0 || (item.unit_cost ?? 0) < 0) throw new Error('Inventory values cannot be negative')
  const result = await createClient().from('inventory_items').insert({ ...item, sku, name, owner_id: ownerId, status: item.status ?? inventoryStatus(item.quantity ?? 0, item.reorder_level ?? 10) }).select().single()
  if (result.data) void recordAuditLog({ userId: ownerId, action: 'create', module: 'inventory', recordId: result.data.id, description: `Created inventory item ${sku}` })
  return result
}

export async function updateInventoryItem(id: string, ownerId: string, item: Partial<InventoryItemInput>) {
  const result = await createClient().from('inventory_items').update(item).eq('id', id).eq('owner_id', ownerId).select().single()
  if (result.data) void recordAuditLog({ userId: ownerId, action: 'update', module: 'inventory', recordId: id, description: `Updated inventory item ${id}` })
  return result
}

export async function deleteInventoryItem(id: string, ownerId: string) {
  const result = await createClient().from('inventory_items').delete().eq('id', id).eq('owner_id', ownerId)
  if (!result.error) void recordAuditLog({ userId: ownerId, action: 'delete', module: 'inventory', recordId: id, description: `Deleted inventory item ${id}` })
  return result
}

export function inventoryStatus(quantity: number, reorderLevel: number): InventoryItemInput['status'] {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity <= reorderLevel) return 'low_stock'
  return 'in_stock'
}
