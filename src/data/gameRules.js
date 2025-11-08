// Game rules and core logic for Sea Salt & Paper

import { isValidPair } from './cards.js';

/**
 * Calculate the target score based on number of players
 * 2 players: 40 points
 * 3 players: 35 points
 * 4 players: 30 points
 * @param {number} playerCount - Number of players
 * @returns {number} Target score
 */
export function getTargetScore(playerCount) {
  if (playerCount === 2) return 40;
  if (playerCount === 3) return 35;
  if (playerCount === 4) return 30;
  return 40; // Default
}

/**
 * Initialize a new game round
 * @param {Array} players - Array of player objects
 * @param {Array} deck - Shuffled deck of cards
 * @returns {Object} Game state for the round
 */
export function initializeRound(players, deck) {
  const gameState = {
    deck: [...deck],
    discardPiles: [[], []],  // Two discard piles
    players: players.map(player => ({
      ...player,
      hand: [],
      score: 0,
      roundScore: 0,
      isActive: true,
    })),
    currentPlayerIndex: 0,
    roundNumber: 0,
    gamePhase: 'drawing', // drawing, declaring, scoring
  };

  // Deal 5 cards to each player
  players.forEach(() => {
    for (let i = 0; i < 5; i++) {
      const card = gameState.deck.pop();
      gameState.players[gameState.players.length - 1 - Math.floor(i / 5)].hand.push(card);
    }
  });

  // Actually, properly distribute
  gameState.deck = [...deck];
  gameState.players.forEach(player => {
    player.hand = [];
  });

  for (let i = 0; i < 5; i++) {
    for (let p = 0; p < gameState.players.length; p++) {
      const card = gameState.deck.pop();
      gameState.players[p].hand.push(card);
    }
  }

  return gameState;
}

/**
 * Calculate player score for current hand
 * @param {Array} hand - Array of cards in hand
 * @param {Boolean} isWinner - Whether player won the declaration
 * @returns {Object} Detailed score breakdown {baseScore, colorBonus, total}
 */
export function calculatePlayerScore(hand, isWinner) {
  // Base score: sum of all card values
  const baseScore = hand.reduce((sum, card) => sum + card.value, 0);

  // Color bonus: for each color, count cards and add (count - 1) bonus
  const colorCounts = {};
  hand.forEach(card => {
    colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
  });

  let colorBonus = 0;
  Object.values(colorCounts).forEach(count => {
    if (count >= 1) {
      // The most common color gets (count) points
      colorBonus = Math.max(colorBonus, count);
    }
  });

  // If winner: base score + max color bonus
  // If loser: only max color bonus
  const total = isWinner ? baseScore + colorBonus : colorBonus;

  return {
    baseScore,
    colorBonus,
    total,
    breakdown: {
      baseScore,
      colorBonus,
      maxColorCount: colorBonus,
    },
  };
}

/**
 * Check if player can declare
 * Player can declare when hand total >= 7 points
 * @param {Array} hand - Cards in player's hand
 * @returns {Boolean} Can declare
 */
export function canDeclare(hand) {
  if (!hand || hand.length === 0) return false;
  const totalScore = hand.reduce((sum, card) => sum + card.value, 0);
  return totalScore >= 7;
}

/**
 * Determine winner of a declaration round
 * @param {Array} playerScores - Array of {playerIndex, score}
 * @param {number} declaringPlayerIndex - Index of player who declared
 * @returns {Object} {winner: playerIndex, isDeclarerWinner: boolean}
 */
export function determineDeclarationWinner(playerScores, declaringPlayerIndex) {
  const declarerScore = playerScores[declaringPlayerIndex];

  // Check if declarer's score is higher than ALL other players
  const isDeclarerWinner = playerScores.every((score, index) => {
    return index === declaringPlayerIndex || score.total < declarerScore.total;
  });

  return {
    isDeclarerWinner,
    declarerScore: declarerScore.total,
    maxOtherScore: Math.max(
      ...playerScores
        .map((s, i) => i !== declaringPlayerIndex ? s.total : -Infinity)
    ),
  };
}

/**
 * Process end of round and add points to player scores
 * @param {Object} gameState - Current game state
 * @param {number} declaringPlayerIndex - Who declared
 * @param {string} declarationType - 'immediate' or 'lastChance'
 * @returns {Object} Updated game state with new scores
 */
export function processRoundEnd(gameState, declaringPlayerIndex, declarationType) {
  const newGameState = { ...gameState };

  // Calculate all player scores
  const playerScores = newGameState.players.map((player, index) => ({
    playerIndex: index,
    hand: player.hand,
    score: calculatePlayerScore(player.hand, false),
    total: 0,
  }));

  // Determine if declarer won
  const { isDeclarerWinner } = determineDeclarationWinner(playerScores, declaringPlayerIndex);

  // Apply scoring rules
  playerScores.forEach((playerScore, index) => {
    let points;
    if (index === declaringPlayerIndex) {
      // Declaring player
      if (isDeclarerWinner) {
        // Won: get base score + color bonus
        points = playerScore.score.baseScore + playerScore.score.colorBonus;
      } else {
        // Lost: only get max color count
        points = playerScore.score.colorBonus;
      }
    } else {
      // Other players
      if (isDeclarerWinner) {
        // Declarer won, others only get color bonus
        points = playerScore.score.colorBonus;
      } else {
        // Declarer lost, others get full score
        points = playerScore.score.baseScore + playerScore.score.colorBonus;
      }
    }

    newGameState.players[index].score += points;
    newGameState.players[index].roundScore = points;
  });

  // Check for game winner
  const targetScore = getTargetScore(newGameState.players.length);
  const gameWinner = newGameState.players.findIndex(p => p.score >= targetScore);

  return {
    ...newGameState,
    gameWinner: gameWinner !== -1 ? gameWinner : null,
  };
}

/**
 * Draw cards for a player turn
 * Player draws 2 cards from deck, chooses 1 to keep
 * Other goes to a discard pile
 * @param {Object} gameState - Current game state
 * @param {number} discardPileIndex - Which pile (0 or 1)
 * @param {number} keepCardIndex - Which of 2 drawn cards to keep (0 or 1)
 * @returns {Object} {updatedGameState, discardedCard}
 */
export function drawFromDeck(gameState, discardPileIndex, keepCardIndex) {
  const newState = { ...gameState };

  // Draw 2 cards
  if (newState.deck.length < 2) {
    // Reshuffle discard pile if deck too small
    const allDiscarded = [...newState.discardPiles[0], ...newState.discardPiles[1]];
    if (allDiscarded.length > 0) {
      newState.deck = [...allDiscarded];
      newState.discardPiles = [[], []];
    }
  }

  const card1 = newState.deck.pop();
  const card2 = newState.deck.pop();

  const drawnCards = [card1, card2];
  const keptCard = drawnCards[keepCardIndex];
  const discardedCard = drawnCards[1 - keepCardIndex];

  // Add kept card to player hand
  newState.players[newState.currentPlayerIndex].hand.push(keptCard);

  // Add discarded card to pile
  newState.discardPiles[discardPileIndex].push(discardedCard);

  return {
    updatedGameState: newState,
    drawnCards,
    keptCard,
    discardedCard,
  };
}

/**
 * Take card from discard pile
 * @param {Object} gameState - Current game state
 * @param {number} pileIndex - Which pile (0 or 1)
 * @returns {Object} {updatedGameState, takenCard}
 */
export function takeFromDiscardPile(gameState, pileIndex) {
  const newState = { ...gameState };

  if (newState.discardPiles[pileIndex].length === 0) {
    return null;
  }

  const takenCard = newState.discardPiles[pileIndex].pop();
  newState.players[newState.currentPlayerIndex].hand.push(takenCard);

  return {
    updatedGameState: newState,
    takenCard,
  };
}

/**
 * Execute a pair effect action
 * @param {Object} gameState - Current game state
 * @param {Array} cardIndices - [index1, index2] of cards forming the pair
 * @param {string} effectAction - Type of effect (draw, takeDiscard, extraTurn, steal)
 * @returns {Object} Updated game state
 */
export function executePairEffect(gameState, cardIndices, effectAction) {
  // This will be handled by game flow, here we just validate
  const [card1, card2] = [
    gameState.players[gameState.currentPlayerIndex].hand[cardIndices[0]],
    gameState.players[gameState.currentPlayerIndex].hand[cardIndices[1]],
  ];

  return isValidPair(card1, card2);
}

/**
 * Move to next player's turn
 * @param {Object} gameState - Current game state
 * @returns {Object} Updated game state
 */
export function nextTurn(gameState) {
  const newState = { ...gameState };
  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  newState.gamePhase = 'drawing';
  return newState;
}

/**
 * Get game status information
 * @param {Object} gameState - Current game state
 * @returns {Object} Game status
 */
export function getGameStatus(gameState) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const targetScore = getTargetScore(gameState.players.length);

  return {
    currentPlayerIndex: gameState.currentPlayerIndex,
    currentPlayerName: currentPlayer.name,
    gamePhase: gameState.gamePhase,
    targetScore,
    playerScores: gameState.players.map(p => ({
      name: p.name,
      score: p.score,
      handSize: p.hand.length,
    })),
    deckSize: gameState.deck.length,
    discardPiles: gameState.discardPiles.map(pile => ({
      topCard: pile[pile.length - 1] || null,
      size: pile.length,
    })),
  };
}