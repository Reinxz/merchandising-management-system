"use client"

import { useEffect, useState } from 'react'
import DashboardApp from '@/components/dashboard-app'
import { AuthLogin } from '@/components/auth-login'
import { createClient, getProfile, signOut } from '@/lib/supabase/client'

type Session = Awaited<ReturnType<ReturnType<typeof createClient>['auth']['getSession']>>['data']['session']

export default function Home() {
  const [session, setSession] = useState<Session>(null)
  const [profile, setProfile] = useState<{ full_name: string | null; role: string } | null>(null)
  const [liveCounts, setLiveCounts] = useState({ inventory: 0, suppliers: 0, purchaseOrders: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        const { data: p } = await getProfile(data.session.user.id)
        setProfile(p)
        const [inventory, suppliers, purchaseOrders] = await Promise.all([
          supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }),
          supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
        ])
        setLiveCounts({ inventory: inventory.count || 0, suppliers: suppliers.count || 0, purchaseOrders: purchaseOrders.count || 0 })
      }
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])
  if (loading) return <div className="min-h-screen bg-[#f7f5fb] flex items-center justify-center text-violet-900">Loading TRI-M SCIMS...</div>
  if (!session) return <AuthLogin />
  return <DashboardApp userId={session.user.id} userName={profile?.full_name || session.user.email?.split('@')[0]} userEmail={session.user.email || ''} userRole={profile?.role || 'staff'} liveCounts={liveCounts} onSignOut={signOut} />
}
