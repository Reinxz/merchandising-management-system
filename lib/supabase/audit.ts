import { createClient } from './client'

export type AuditAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'approve' | 'cancel'

export type AuditLogInput = {
  userId: string
  action: AuditAction
  module: 'auth' | 'inventory' | 'suppliers' | 'purchase_orders'
  recordId?: string | null
  description: string
}

export async function recordAuditLog(input: AuditLogInput) {
  if (!input.userId || !input.description.trim()) return { data: null, error: new Error('Audit log requires a user and description') }
  return createClient().from('audit_logs').insert({
    user_id: input.userId,
    action: input.action,
    module: input.module,
    record_id: input.recordId ?? null,
    description: input.description.trim(),
  })
}

export async function listAuditLogs(userId: string) {
  return createClient().from('audit_logs').select('id, user_id, action, module, record_id, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
}
