import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cost Accounting | ATQ Level 1 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Cost Accounting — ATQ Level 1 Foundation Technician. Cost classification, costing methods, job costing, marginal vs absorption costing and CVP analysis.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/cost-accounting',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
