import { createClient } from './client'

export type SaleInput = {
  inventoryItemId: string
  quantity: number
  unitPrice: number
  customerName?: string
  notes?: string
}

export async function listSales(ownerId: string) {
  return createClient().from('sales').select('*, inventory_items(name, sku)').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(100)
}

export async function recordSale(input: SaleInput) {
  if (!input.inventoryItemId) throw new Error('Choose an inventory item')
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('Quantity must be a whole number greater than zero')
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new Error('Unit price cannot be negative')
  return createClient().rpc('record_sale', {
    p_inventory_item_id: input.inventoryItemId,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_customer_name: input.customerName?.trim() || null,
    p_notes: input.notes?.trim() || null,
  })
}
