import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/admin-auth'
import AdminShell from './AdminShell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return <AdminShell>{children}</AdminShell>
}
