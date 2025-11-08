// Game logic utilities and helpers

/**
 * Check if player has at least one valid pair in hand
 * @param {Array} hand - Player's hand of cards
 * @returns {Array} Array of pair combinations [{index1, index2}, ...]
 */
export function findValidPairs(hand) {
  const pairs = [];

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (isValidPair(hand[i], hand[j])) {
        pairs.push({ index1: i, index2: j });
      }
    }
  }

  return pairs;
}

/**
 * Check if two cards form a valid pair
 * @param {Object} card1 - First card
 * @param {Object} card2 - Second card
 * @returns {Boolean} Valid pair
 */
export function isValidPair(card1, card2) {
  if (!card1 || !card2) return false;

  // Same card ID
  if (card1.id === card2.id && card1.id !== 'human' && card1.id !== 'shark') {
    return true;
  }

  // Special: shark + human
  if ((card1.id === 'shark' && card2.id === 'human') ||
      (card1.id === 'human' && card2.id === 'shark')) {
    return true;
  }

  return false;
}

/**
 * Remove card from array by index
 * @param {Array} array - Array of items
 * @param {number} index - Index to remove
 * @returns {Array} New array without the item
 */
export function removeByIndex(array, index) {
  return array.filter((_, i) => i !== index);
}

/**
 * Get card by index, safely
 * @param {Array} hand - Player's hand
 * @param {number} index - Index of card
 * @returns {Object} Card at index or null
 */
export function getCardByIndex(hand, index) {
  if (index >= 0 && index < hand.length) {
    return hand[index];
  }
  return null;
}

/**
 * Sort hand by card type and value for better display
 * @param {Array} hand - Unsorted hand
 * @returns {Array} Sorted hand
 */
export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    // Sort by: type (pair effect first), then color, then value
    const typeOrder = { pairEffect: 0, collection: 1 };
    const aTypeOrder = typeOrder[a.type] || 2;
    const bTypeOrder = typeOrder[b.type] || 2;

    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder;
    }

    if (a.color !== b.color) {
      return a.color.localeCompare(b.color);
    }

    return a.value - b.value;
  });
}

/**
 * Get color name in Chinese
 * @param {string} color - Color code
 * @returns {string} Chinese color name
 */
export function getColorName(color) {
  const colorNames = {
    blue: '藍色',
    red: '紅色',
    green: '綠色',
    yellow: '黃色',
    pink: '粉紅色',
    purple: '紫色',
    orange: '橙色',
    cyan: '青色',
  };
  return colorNames[color] || color;
}

/**
 * Get card display name in Chinese
 * @param {Object} card - Card object
 * @returns {string} Display name
 */
export function getCardDisplayName(card) {
  if (!card) return '';
  return `${card.name} (${card.value}分)`;
}

/**
 * Format score for display
 * @param {number} score - Score value
 * @returns {string} Formatted score
 */
export function formatScore(score) {
  return `${score} 分`;
}

/**
 * Get effect description in Chinese
 * @param {string} effect - Effect type
 * @returns {string} Description
 */
export function getEffectDescription(effect) {
  const descriptions = {
    draw: '抽 2 張牌，選 1 張留手',
    takeDiscard: '從任一棄牌堆拿任意一張牌',
    extraTurn: '再做一次你的回合',
    steal: '從對手手牌中偷 1 張牌',
  };
  return descriptions[effect] || '未知效果';
}

/**
 * Check if game has a winner
 * @param {Array} players - Array of players
 * @param {number} targetScore - Target score to win
 * @returns {number} Index of winner or -1
 */
export function getGameWinner(players, targetScore) {
  return players.findIndex(p => p.score >= targetScore);
}

/**
 * Validate game state for common issues
 * @param {Object} gameState - Game state to validate
 * @returns {Object} {isValid, errors}
 */
export function validateGameState(gameState) {
  const errors = [];

  // Check players exist and have hands
  if (!gameState.players || gameState.players.length === 0) {
    errors.push('No players in game');
  }

  // Check deck exists
  if (!Array.isArray(gameState.deck)) {
    errors.push('Invalid deck');
  }

  // Check discard piles exist
  if (!gameState.discardPiles || gameState.discardPiles.length !== 2) {
    errors.push('Invalid discard piles');
  }

  // Check current player index is valid
  if (gameState.currentPlayerIndex < 0 || gameState.currentPlayerIndex >= gameState.players.length) {
    errors.push('Invalid current player index');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get summary of current round
 * @param {Object} gameState - Game state
 * @returns {string} Round summary
 */
export function getRoundSummary(gameState) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  return `輪次: ${gameState.roundNumber + 1} | 當前玩家: ${currentPlayer.name} | 階段: ${gameState.gamePhase}`;
}