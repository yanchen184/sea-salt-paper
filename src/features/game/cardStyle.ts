import type { CardColor, CardKind } from '../../engine'

export const COLOR_CLASSES: Record<CardColor, string> = {
  darkBlue: 'bg-blue-800 text-white',
  lightBlue: 'bg-sky-300 text-sky-950',
  black: 'bg-slate-900 text-white',
  yellow: 'bg-yellow-300 text-yellow-950',
  lightGreen: 'bg-lime-300 text-lime-950',
  white: 'bg-white text-slate-800',
  purple: 'bg-purple-500 text-white',
  lightGray: 'bg-slate-300 text-slate-900',
  lightOrange: 'bg-orange-200 text-orange-950',
  pink: 'bg-pink-300 text-pink-950',
  orange: 'bg-orange-500 text-white',
}

const CREATURE_FILES = import.meta.glob<string>('../../assets/art/creatures/*.svg', { eager: true, query: '?url', import: 'default' })

function creatureUrl(kind: CardKind): string {
  const url = CREATURE_FILES[`../../assets/art/creatures/${kind}.svg`]
  if (!url) throw new Error(`缺少卡牌圖 ${kind}.svg`)
  return url
}

export const CREATURE_URLS: Record<CardKind, string> = {
  crab: creatureUrl('crab'),
  boat: creatureUrl('boat'),
  fish: creatureUrl('fish'),
  swimmer: creatureUrl('swimmer'),
  shark: creatureUrl('shark'),
  shell: creatureUrl('shell'),
  octopus: creatureUrl('octopus'),
  penguin: creatureUrl('penguin'),
  sailor: creatureUrl('sailor'),
  lighthouse: creatureUrl('lighthouse'),
  shoal: creatureUrl('shoal'),
  penguinColony: creatureUrl('penguinColony'),
  captain: creatureUrl('captain'),
  mermaid: creatureUrl('mermaid'),
}
