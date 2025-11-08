// Card definitions for Sea Salt & Paper game (64 cards total)

export const CARD_TYPES = {
  PAIR_EFFECT: 'pairEffect',      // 配對有效果的牌
  COLLECTION: 'collection',        // 集合分數的牌
};

// All card definitions with their properties
export const ALL_CARDS = [
  // Pair Effect Cards - 配對時發動能力
  // Fish (魚) - Draw 2 cards, keep 1
  { id: 'fish', name: '魚', type: CARD_TYPES.PAIR_EFFECT, value: 1, color: 'blue', pairEffect: 'draw' },
  // Crab (螃蟹) - Take any card from discard pile
  { id: 'crab', name: '螃蟹', type: CARD_TYPES.PAIR_EFFECT, value: 2, color: 'red', pairEffect: 'takeDiscard' },
  // Ship (船) - Extra turn
  { id: 'ship', name: '船', type: CARD_TYPES.PAIR_EFFECT, value: 3, color: 'green', pairEffect: 'extraTurn' },
  // Shark (鯊魚) - Steal one card
  { id: 'shark', name: '鯊魚', type: CARD_TYPES.PAIR_EFFECT, value: 4, color: 'orange', pairEffect: 'steal' },
  // Human/Person (人) - Steal one card (pairs with shark)
  { id: 'human', name: '人', type: CARD_TYPES.PAIR_EFFECT, value: 4, color: 'purple', pairEffect: 'steal' },

  // Collection Cards - 集合分數的牌
  // Shell (貝殼)
  { id: 'shell', name: '貝殼', type: CARD_TYPES.COLLECTION, value: 1, color: 'yellow' },
  // Octopus (章魚)
  { id: 'octopus', name: '章魚', type: CARD_TYPES.COLLECTION, value: 2, color: 'pink' },
  // Penguin (企鵝)
  { id: 'penguin', name: '企鵝', type: CARD_TYPES.COLLECTION, value: 3, color: 'cyan' },
];

// Card counts in deck: 64 cards total
export const CARD_COUNTS = {
  fish: 8,
  crab: 8,
  ship: 8,
  shark: 8,
  human: 8,
  shell: 8,
  octopus: 8,
  penguin: 8,
};

/**
 * Initialize the game deck with all 64 cards
 * @returns {Array} Shuffled deck of cards
 */
export function initializeGameDeck() {
  const deck = [];

  // Add cards according to card counts
  Object.entries(CARD_COUNTS).forEach(([cardId, count]) => {
    const cardTemplate = ALL_CARDS.find(c => c.id === cardId);
    if (cardTemplate) {
      for (let i = 0; i < count; i++) {
        deck.push({
          ...cardTemplate,
          uniqueId: `${cardId}_${i}`,
        });
      }
    }
  });

  // Shuffle the deck
  return shuffleDeck(deck);
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} deck - Cards to shuffle
 * @returns {Array} Shuffled deck
 */
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if two cards form a valid pair
 * Valid pairs: same card ID (fish+fish, crab+crab, etc.)
 * Special: shark + human = valid pair
 * @param {Object} card1 - First card
 * @param {Object} card2 - Second card
 * @returns {Boolean} True if cards form a valid pair
 */
export function isValidPair(card1, card2) {
  if (!card1 || !card2) return false;

  // Same card type
  if (card1.id === card2.id) return true;

  // Special case: shark + human is a valid pair
  if ((card1.id === 'shark' && card2.id === 'human') ||
      (card1.id === 'human' && card2.id === 'shark')) {
    return true;
  }

  return false;
}

/**
 * Get the pair effect details
 * @param {Object} card - Card with pair effect
 * @returns {Object} Effect details {name, description, action}
 */
export function getPairEffectDetails(card) {
  const effectMap = {
    draw: {
      name: '抽牌',
      description: '抽 2 張牌，選 1 張留手',
      action: 'draw',
    },
    takeDiscard: {
      name: '撈牌',
      description: '從任一棄牌堆拿任意一張牌',
      action: 'takeDiscard',
    },
    extraTurn: {
      name: '額外回合',
      description: '再做一次你的回合',
      action: 'extraTurn',
    },
    steal: {
      name: '偷牌',
      description: '從對手手牌中偷 1 張牌',
      action: 'steal',
    },
  };

  return effectMap[card?.pairEffect] || null;
}