export type Format = 'standard'|'brawl'

export function validateStandard(deck: {main: any[], side?: any[]}) {
  const mainCount = deck.main.reduce((a,c)=>a+(c.quantity||1),0)
  const okMain = mainCount >= 60
  const okCopies = deck.main.every(c => (c.quantity||1) <= 4 || /Basic Land/i.test(c.name))
  const sideCount = (deck.side||[]).reduce((a,c)=>a+(c.quantity||1),0)
  return { ok: okMain && okCopies, mainCount, sideCount }
}

export function validateBrawl(deck: {main: any[], commander?: any}) {
  const isSingleton = deck.main.every(c => (c.quantity||1) === 1 || /Basic Land/i.test(c.name))
  const count = deck.main.length
  const commanderOk = !!deck.commander
  return { ok: isSingleton && count===100 && commanderOk, count, commanderOk }
}
