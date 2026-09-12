// Card definitions for Sea Salt & Paper game (72 cards total)
// 《海鹽摺紙》卡牌定義(共72張牌)

export const CARD_TYPES = {
  PAIR_EFFECT: 'pairEffect',      // Pair effect cards (配對有效果的牌)
  COLLECTION: 'collection',        // Collection scoring cards (集合分數的牌)
  MERMAID: 'mermaid',              // Mermaid cards (美人魚)
  MULTIPLIER: 'multiplier',        // Multiplier cards (倍增牌)
};

export const COLORS = {
  BLUE: 'blue',          // 藍色
  RED: 'red',            // 紅色
  GREEN: 'green',        // 綠色
  ORANGE: 'orange',      // 橘色
  PURPLE: 'purple',      // 紫色
  YELLOW: 'yellow',      // 黃色
  PINK: 'pink',          // 粉色
  CYAN: 'cyan',          // 青色
  GRAY: 'gray',          // 灰色
  MULTI: 'multi',        // 多色(美人魚)
};

// All card definitions with their properties
export const ALL_CARDS = [
  // === PAIR EFFECT CARDS (配對效果牌) === 
  
  // Fish (魚) - x7 cards - Blind draw 1 card from deck
  { 
    id: 'fish', 
    name: '魚', 
    type: CARD_TYPES.PAIR_EFFECT, 
    value: 1, 
    color: COLORS.BLUE, 
    pairEffect: 'blindDraw',
    description: '打出一對魚:盲抽牌庫頂1張牌'
  },
  
  // Crab (螃蟹) - x6 cards - Choose any card from a discard pile
  { 
    id: 'crab', 
    name: '螃蟹', 
    type: CARD_TYPES.PAIR_EFFECT, 
    value: 1, 
    color: COLORS.RED, 
    pairEffect: 'pickDiscard',
    description: '打出一對螃蟹:從一個棄牌堆選擇任意1張牌'
  },
  
  // Sailboat (帆船) - x6 cards - Take another turn immediately
  { 
    id: 'sailboat', 
    name: '帆船', 
    type: CARD_TYPES.PAIR_EFFECT, 
    value: 1, 
    color: COLORS.GREEN, 
    pairEffect: 'extraTurn',
    description: '打出一對帆船:立即再進行一個回合'
  },
  
  // Shark (鯊魚) - x3 cards - Steal 1 random card from opponent (pairs with swimmer)
  { 
    id: 'shark', 
    name: '鯊魚', 
    type: CARD_TYPES.PAIR_EFFECT, 
    value: 1, 
    color: COLORS.ORANGE, 
    pairEffect: 'steal',
    description: '打出鯊魚+游泳者:隨機偷取對手1張手牌'
  },
  
  // Swimmer/Person (游泳者) - x3 cards - Steal 1 random card from opponent (pairs with shark)
  { 
    id: 'swimmer', 
    name: '游泳者', 
    type: CARD_TYPES.PAIR_EFFECT, 
    value: 1, 
    color: COLORS.PURPLE, 
    pairEffect: 'steal',
    description: '打出鯊魚+游泳者:隨機偷取對手1張手牌'
  },

  // === COLLECTION CARDS (集合牌) ===
  
  // Shell (貝殼) - x7 cards
  { 
    id: 'shell', 
    name: '貝殼', 
    type: CARD_TYPES.COLLECTION, 
    value: 1, 
    color: COLORS.YELLOW,
    description: '基礎分數1分'
  },
  
  // Starfish (海星) - x7 cards
  { 
    id: 'starfish', 
    name: '海星', 
    type: CARD_TYPES.COLLECTION, 
    value: 1, 
    color: COLORS.PINK,
    description: '基礎分數1分'
  },
  
  // Octopus (章魚) - x5 cards
  { 
    id: 'octopus', 
    name: '章魚', 
    type: CARD_TYPES.COLLECTION, 
    value: 2, 
    color: COLORS.CYAN,
    description: '基礎分數2分'
  },
  
  // Ray/Stingray (魟魚) - x5 cards
  { 
    id: 'ray', 
    name: '魟魚', 
    type: CARD_TYPES.COLLECTION, 
    value: 2, 
    color: COLORS.GRAY,
    description: '基礎分數2分'
  },

  // === MULTIPLIER CARDS (倍增牌) ===
  
  // Lighthouse (燈塔) - x2 cards - Each fish = +1 point
  { 
    id: 'lighthouse', 
    name: '燈塔', 
    type: CARD_TYPES.MULTIPLIER, 
    value: 0, 
    color: COLORS.BLUE,
    multiplierFor: 'fish',
    description: '每條魚額外+1分'
  },
  
  // School of Fish (魚群) - x2 cards - Each crab = +1 point
  { 
    id: 'school', 
    name: '魚群', 
    type: CARD_TYPES.MULTIPLIER, 
    value: 0, 
    color: COLORS.RED,
    multiplierFor: 'crab',
    description: '每隻螃蟹額外+1分'
  },
  
  // Penguin Colony (企鵝聚落) - x2 cards - Each sailboat = +1 point
  { 
    id: 'colony', 
    name: '企鵝聚落', 
    type: CARD_TYPES.MULTIPLIER, 
    value: 0, 
    color: COLORS.GREEN,
    multiplierFor: 'sailboat',
    description: '每艘帆船額外+1分'
  },
  
  // Captain (船長) - x2 cards - Each shell = +2 points
  { 
    id: 'captain', 
    name: '船長', 
    type: CARD_TYPES.MULTIPLIER, 
    value: 0, 
    color: COLORS.YELLOW,
    multiplierFor: 'shell',
    multiplierValue: 2,
    description: '每個貝殼額外+2分'
  },

  // === SPECIAL CARDS (特殊牌) ===
  
  // Mermaid (美人魚) - x4 cards - Score = count of most common color
  // Having all 4 mermaids = instant win!
  { 
    id: 'mermaid', 
    name: '美人魚', 
    type: CARD_TYPES.MERMAID, 
    value: 0,  // Variable scoring
    color: COLORS.MULTI,
    description: '分數=最多顏色的張數。集齊4張美人魚=直接獲勝!'
  },
];

// Card counts in deck: 72 cards total
export const CARD_COUNTS = {
  fish: 7,
  crab: 6,
  sailboat: 6,
  shark: 3,
  swimmer: 3,
  shell: 7,
  starfish: 7,
  octopus: 5,
  ray: 5,
  lighthouse: 2,
  school: 2,
  colony: 2,
  captain: 2,
  mermaid: 4,
};

/**
 * Get total card count
 * @returns {number} Total number of cards in deck
 */
export function getTotalCardCount() {
  return Object.values(CARD_COUNTS).reduce((sum, count) => sum + count, 0);
}

/**
 * Initialize the game deck with all 72 cards
 * @param {boolean} shuffle - Whether to shuffle the deck (default: true)
 * @returns {Array} Deck of cards (shuffled or ordered)
 */
export function initializeGameDeck(shuffle = true) {
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

  // Shuffle the deck if requested
  return shuffle ? shuffleDeck(deck) : deck;
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
 * Valid pairs: 
 * - Same card ID (fish+fish, crab+crab, sailboat+sailboat)
 * - Special: shark + swimmer = valid pair
 * @param {Object} card1 - First card
 * @param {Object} card2 - Second card
 * @returns {Boolean} True if cards form a valid pair
 */
export function isValidPair(card1, card2) {
  if (!card1 || !card2) return false;

  // Same card type
  if (card1.id === card2.id) {
    // Only pair effect cards can be paired
    return card1.type === CARD_TYPES.PAIR_EFFECT;
  }

  // Special case: shark + swimmer is a valid pair
  if ((card1.id === 'shark' && card2.id === 'swimmer') ||
      (card1.id === 'swimmer' && card2.id === 'shark')) {
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
    blindDraw: {
      name: '盲抽',
      description: '從牌庫頂盲抽1張牌到手上',
      action: 'blindDraw',
    },
    pickDiscard: {
      name: '選牌',
      description: '從任一棄牌堆中選擇任意1張牌',
      action: 'pickDiscard',
    },
    extraTurn: {
      name: '額外回合',
      description: '立即再進行一次你的回合',
      action: 'extraTurn',
    },
    steal: {
      name: '偷牌',
      description: '從對手手牌中隨機偷取1張牌',
      action: 'steal',
    },
  };

  return effectMap[card?.pairEffect] || null;
}

/**
 * Calculate score for a hand including multipliers and mermaids
 * @param {Array} hand - Array of cards
 * @returns {Object} Score breakdown
 */
export function calculateHandScore(hand) {
  if (!hand || hand.length === 0) {
    return { total: 0, breakdown: {} };
  }

  let baseScore = 0;
  let multiplierBonus = 0;
  let mermaidScore = 0;

  // Count cards by type
  const cardCounts = {};
  const colorCounts = {};
  let mermaidCount = 0;

  hand.forEach(card => {
    // Count by card ID
    cardCounts[card.id] = (cardCounts[card.id] || 0) + 1;
    
    // Count by color (exclude multipliers and mermaids)
    if (card.type !== CARD_TYPES.MULTIPLIER && card.type !== CARD_TYPES.MERMAID) {
      colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
    }

    // Count mermaids
    if (card.type === CARD_TYPES.MERMAID) {
      mermaidCount++;
    } else if (card.type !== CARD_TYPES.MULTIPLIER) {
      // Base score (exclude multipliers)
      baseScore += card.value;
    }
  });

  // Calculate multiplier bonuses
  hand.forEach(card => {
    if (card.type === CARD_TYPES.MULTIPLIER) {
      const targetCount = cardCounts[card.multiplierFor] || 0;
      const multiplierValue = card.multiplierValue || 1;
      multiplierBonus += targetCount * multiplierValue;
    }
  });

  // Calculate mermaid scores
  // Each mermaid scores points equal to Nth most common color count
  if (mermaidCount > 0) {
    const colorCountsArray = Object.values(colorCounts).sort((a, b) => b - a);
    for (let i = 0; i < mermaidCount; i++) {
      mermaidScore += colorCountsArray[i] || 0;
    }
  }

  // Color bonus: most common color adds extra points
  const maxColorCount = Math.max(...Object.values(colorCounts), 0);

  const total = baseScore + multiplierBonus + mermaidScore + maxColorCount;

  return {
    total,
    breakdown: {
      baseScore,
      multiplierBonus,
      mermaidScore,
      colorBonus: maxColorCount,
      cardCounts,
      colorCounts,
      mermaidCount,
    },
  };
}

/**
 * Check if player has all 4 mermaids (instant win condition)
 * @param {Array} hand - Player's hand
 * @returns {Boolean} Has all mermaids
 */
export function hasAllMermaids(hand) {
  const mermaidCount = hand.filter(card => card.type === CARD_TYPES.MERMAID).length;
  return mermaidCount === 4;
}
