import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Cost Accounting Mock Exam | EthioTax ETICPA',
  description: 'Take a free 50-question mock exam for the ETICPA ATQ Level 1 Cost Accounting module. Questions are randomly selected and balanced across all topics.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/cost-accounting/mock-exam',
  },
}
export default function MockExamLayout({ children }: { children: React.ReactNode }) {
  return children
}
