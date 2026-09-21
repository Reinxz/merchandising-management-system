# TRI-M SCIMS

TRI-M Merchandising Management System is a cloud-based capstone for managing dry, frozen, and cosmetic products, suppliers, and purchase orders. It includes account sign-in, role-aware navigation, audit logging, live dashboard metrics, and user-isolated records.

## Run locally

1. Install Node.js 20 or newer and pnpm (`corepack enable`).
2. Run `pnpm install` and then `pnpm dev`.
3. Create a Supabase project and add these values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

4. In the Supabase SQL Editor, apply the migrations in `supabase/migrations/` in filename order.
5. In Supabase Authentication settings, add `http://localhost:3000/auth/callback` to the Redirect URLs list and enable email/password sign-in.

## Capstone demonstration flow

1. Create an account and sign in.
2. Add an inventory item with a reorder level, then record a sale that lowers stock to that level.
3. Open the alert bell to show the new low-stock notification; the inventory status changes automatically.
4. Add suppliers, then create and update a purchase order.
5. Return to the dashboard and refresh it to demonstrate live metrics and alerts.
6. Show the `sales` and `audit_logs` tables in Supabase to demonstrate traceability.

## Production-readiness notes

- Row-level security limits data access to the signed-in record owner.
- SKU and purchase-order numbers are unique per owner.
- Inventory quantities, reorder levels, unit costs, purchase-order totals, and supplier ratings are validated in both the interface and database.
- Before deployment, set production Supabase redirect URLs and use the production environment variables in the hosting provider.
