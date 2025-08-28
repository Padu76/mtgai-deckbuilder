# MTG Arena AI Deck Builder (MVP)

PWA Next.js + TypeScript per creare deck competitivi su **MTG Arena** (Standard & Historic Brawl).
- Admin dashboard `/admin` con sync Scryfall → Supabase e status (log inclusi).
- Export in formato **MTG Arena (testo)**.

## Avvio
```bash
npm i
cp .env.local.example .env.local
npm run dev
```

## Env richieste
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- NEXT_PUBLIC_ADMIN_KEY
- SCRYFALL_BULK_URL (già valorizzata)
