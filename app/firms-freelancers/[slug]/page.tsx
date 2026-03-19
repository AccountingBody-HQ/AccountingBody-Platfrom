import Link from 'next/link'

export default function FirmProfilePage() {
  return (
    <main className="min-h-screen bg-[#faf9f7] py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="text-5xl mb-6">🔎</div>
        <h1 className="text-2xl font-bold text-[#0f2444] mb-4">Profile Not Found</h1>
        <p className="text-gray-500 mb-8">This profile may not yet be listed or the link may have changed.</p>
        <Link href="/firms-freelancers/directory" className="inline-block bg-[#0f2444] text-white font-semibold px-8 py-4 rounded-lg hover:bg-[#1a3a6b] transition-colors">← Back to Directory</Link>
      </div>
    </main>
  )
}
