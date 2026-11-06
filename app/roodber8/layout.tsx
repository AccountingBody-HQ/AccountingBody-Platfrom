import type { ReactNode } from 'react'
import AdminSignedOutNotice from '@/components/AdminSignedOutNotice'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminPath } from '@/lib/middleware-logic'
import AdminShell from './AdminShell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()
  return (
    <>
      <AdminSignedOutNotice loginHref={'/' + getAdminPath() + '-login'} />
      <AdminShell>{children}</AdminShell>
    </>
  )
}
