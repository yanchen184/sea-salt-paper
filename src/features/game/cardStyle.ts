import type { CardColor, CardKind } from '../../engine'

export const COLOR_CLASSES: Record<CardColor, string> = {
  darkBlue: 'bg-blue-800 text-white',
  lightBlue: 'bg-sky-300 text-sky-950',
  black: 'bg-slate-900 text-white',
  yellow: 'bg-yellow-300 text-yellow-950',
  lightGreen: 'bg-lime-300 text-lime-950',
  white: 'bg-white text-slate-800 ring-1 ring-inset ring-slate-300',
  purple: 'bg-purple-500 text-white',
  lightGray: 'bg-slate-300 text-slate-900',
  lightOrange: 'bg-orange-200 text-orange-950',
  pink: 'bg-pink-300 text-pink-950',
  orange: 'bg-orange-500 text-white',
}

export const CARD_ICONS: Record<CardKind, string> = {
  crab: '🦀',
  boat: '⛵',
  fish: '🐟',
  swimmer: '🏊',
  shark: '🦈',
  shell: '🐚',
  octopus: '🐙',
  penguin: '🐧',
  sailor: '🧑‍✈️',
  lighthouse: '🗼',
  shoal: '🐠',
  penguinColony: '🏔️',
  captain: '⚓',
  mermaid: '🧜',
}
