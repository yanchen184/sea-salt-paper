import type { Card, CardColor, CardKind } from './types'

const DECK_SPEC: readonly (readonly [CardKind, readonly CardColor[]])[] = [
  ['crab', ['darkBlue', 'darkBlue', 'lightBlue', 'lightBlue', 'yellow', 'yellow', 'black', 'lightGreen', 'lightGray']],
  ['boat', ['darkBlue', 'darkBlue', 'lightBlue', 'lightBlue', 'black', 'black', 'yellow', 'yellow']],
  ['fish', ['darkBlue', 'darkBlue', 'black', 'black', 'lightBlue', 'yellow', 'lightGreen']],
  ['swimmer', ['darkBlue', 'lightBlue', 'black', 'yellow', 'lightOrange']],
  ['shark', ['darkBlue', 'lightBlue', 'black', 'lightGreen', 'purple']],
  ['shell', ['darkBlue', 'lightBlue', 'black', 'yellow', 'lightGreen', 'lightGray']],
  ['octopus', ['lightBlue', 'yellow', 'lightGreen', 'lightGray', 'purple']],
  ['penguin', ['purple', 'lightOrange', 'pink']],
  ['sailor', ['pink', 'orange']],
  ['lighthouse', ['purple']],
  ['shoal', ['lightGray']],
  ['penguinColony', ['lightGreen']],
  ['captain', ['lightOrange']],
  ['mermaid', ['white', 'white', 'white', 'white']],
]

export const CARD_NAMES: Record<CardKind, string> = {
  crab: '螃蟹',
  boat: '帆船',
  fish: '魚',
  swimmer: '游泳者',
  shark: '鯊魚',
  shell: '貝殼',
  octopus: '章魚',
  penguin: '企鵝',
  sailor: '水手',
  lighthouse: '燈塔',
  shoal: '魚群',
  penguinColony: '企鵝群',
  captain: '船長',
  mermaid: '美人魚',
}

export const COLOR_NAMES: Record<CardColor, string> = {
  darkBlue: '深藍',
  lightBlue: '淺藍',
  black: '黑',
  yellow: '黃',
  lightGreen: '淺綠',
  white: '白',
  purple: '紫',
  lightGray: '淺灰',
  lightOrange: '淺橘',
  pink: '粉紅',
  orange: '橘',
}

export function buildDeck(): Card[] {
  return DECK_SPEC.flatMap(([kind, colors]) =>
    colors.map((color, i) => ({ id: `${kind}-${i + 1}`, kind, color })),
  )
}

export function describeCard(card: Card): string {
  return `${COLOR_NAMES[card.color]}${CARD_NAMES[card.kind]}`
}
