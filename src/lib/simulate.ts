export function curveAverage(main: { name: string; quantity?: number; mana_value?: number }[]) {
  const spells = main.filter(c => !/Land/i.test(c.name))
  const total = spells.reduce((a,c)=>a+(c.quantity||1),0)
  const sum = spells.reduce((a,c)=>a+((c.quantity||1)*(c.mana_value||0)),0)
  return total ? sum/total : 0
}
