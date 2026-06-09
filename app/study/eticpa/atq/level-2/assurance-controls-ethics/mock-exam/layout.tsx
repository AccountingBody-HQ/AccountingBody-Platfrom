import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Assurance, Controls & Ethics Mock Exam | EthioTax ETICPA',
  description: 'Practice the Assurance, Controls & Ethics mock exam for ETICPA ATQ Level 2. 50 questions drawn from a pool of 390+ practice questions.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/assurance-controls-ethics/mock-exam',
  },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
