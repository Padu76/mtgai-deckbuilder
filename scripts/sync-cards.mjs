const url = process.env.SYNC_URL || 'http://localhost:3000/api/admin/sync-scryfall'
async function main() {
  try {
    const res = await fetch(url, { method: 'GET' })
    const json = await res.json()
    if (!res.ok || json.ok === false) { console.error('Sync failed:', json); process.exit(1) }
    console.log('Sync OK:', json)
  } catch (e) { console.error('Sync error:', e); process.exit(1) }
}
main()
