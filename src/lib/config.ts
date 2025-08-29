// src/lib/config.ts - Sistema di configurazione environment
export const config = {
  // Supabase (obbligatorio)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-only
  },
  
  // Admin (obbligatorio)
  admin: {
    key: process.env.NEXT_PUBLIC_ADMIN_KEY!
  },
  
  // AI Services (opzionale - fallback se non disponibili)
  ai: {
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || ''
  },
  
  // External APIs
  external: {
    scryfallBulk: process.env.SCRYFALL_BULK_URL || 'https://api.scryfall.com/cards/search?q=game%3Aarena+unique%3Aprints'
  },
  
  // Feature flags
  features: {
    aiComboAnalysis: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    comboDatabaseSync: true,
    advancedFilters: true
  }
}

// Validation helper
export function validateConfig() {
  const missing = []
  
  if (!config.supabase.url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!config.supabase.anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!config.supabase.serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!config.admin.key) missing.push('NEXT_PUBLIC_ADMIN_KEY')
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  return {
    ok: true,
    features: config.features,
    hasAI: config.features.aiComboAnalysis
  }
}

// ENV Setup Instructions per Vercel
export const ENV_SETUP_INSTRUCTIONS = `
## Vercel Environment Variables Setup

### Required (Essential):
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOi...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOi... (Keep this secret!)
NEXT_PUBLIC_ADMIN_KEY=your-long-random-password-here

### Optional (AI Features):
ANTHROPIC_API_KEY=sk-ant-api... (For advanced combo analysis)
OPENAI_API_KEY=sk-... (Alternative to Anthropic)

### Auto-configured:
SCRYFALL_BULK_URL=https://api.scryfall.com/cards/search?q=game%3Aarena+unique%3Aprints

## Setup Steps:
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable above (mark SUPABASE_SERVICE_ROLE_KEY as secret)
3. Redeploy project
4. Test /admin endpoint
5. Run card sync
6. Test combo builder

Without AI keys, the system will use pattern-based combo detection (still functional).
`