export type CardLite = { name: string; tags?: string[]; mana_value?: number; colors?: string[]; text?: string }

export function tagFromText(text: string): string[] {
  const tags: string[] = []
  const t = (text||'').toLowerCase()
  if (t.includes('treasure')) tags.push('treasure')
  if (t.includes('gain life') || t.includes('lifelink')) tags.push('lifegain')
  if (t.includes('noncreature spell') || t.includes('prowess')) tags.push('spells-matter')
  if (t.includes('+1/+1 counter')) tags.push('counters')
  if (t.includes('sacrifice')) tags.push('sacrifice')
  if (t.includes('blink') || t.includes('exile') && t.includes('return')) tags.push('blink')
  return tags
}

export function synergyScore(a: CardLite, b: CardLite): number {
  let s = 0
  const inter = (a.tags||[]).filter(t => (b.tags||[]).includes(t))
  s += inter.length * 1.5
  // curve complement
  if ((a.mana_value||0) <= 2 && (b.mana_value||0) >= 4) s += 0.5
  if ((b.mana_value||0) <= 2 && (a.mana_value||0) >= 4) s += 0.5
  return s
}
