export default function Home() {
  return (
    <main className="space-y-4">
      <h2 className="text-lg">Scegli un formato</h2>
      <div className="flex gap-4">
        <a className="rounded-xl bg-slate-800 p-4 hover:bg-slate-700" href="/build/standard">
          Standard
        </a>
        <a className="rounded-xl bg-slate-800 p-4 hover:bg-slate-700" href="/build/brawl">
          Historic Brawl
        </a>
      </div>
    </main>
  )
}
