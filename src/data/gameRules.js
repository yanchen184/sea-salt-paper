// Game rules and core logic for Sea Salt & Paper
// 《海鹽摺紙》遊戲規則與核心邏輯

import { isValidPair, calculateHandScore, hasAllMermaids, shuffleDeck } from './cards.js';

/**
 * Calculate the target score based on number of players
 * 根據玩家人數計算目標分數
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
 * 初始化新回合
 * @param {Array} players - Array of player objects
 * @param {Array} deck - Shuffled deck of cards
 * @returns {Object} Game state for the round
 */
export function initializeRound(players, deck) {
  // Ensure deck is properly shuffled
  const shuffledDeck = [...deck];

  // Draw initial cards for discard piles
  // 為兩個棄牌堆各抽一張牌
  const discardLeft = shuffledDeck.pop();
  const discardRight = shuffledDeck.pop();

  const gameState = {
    deck: shuffledDeck,  // Remaining deck after drawing 2 cards
    discardPile1: [discardLeft],   // Left discard pile (starts with 1 card)
    discardPile2: [discardRight],  // Right discard pile (starts with 1 card)
    players: players.map((player, index) => ({
      ...player,
      hand: [],  // Start with empty hand (起始手牌=0張)
      playedPairs: [],  // Pairs played this round (打出的配對牌)
      score: player.score || 0,  // Keep existing score or start at 0
      roundScore: 0,
      isActive: true,
      isProtected: false,  // Protected after declaring "last chance"
    })),
    currentPlayerIndex: 0,  // Start with player 0 (可以之後改成隨機)
    roundNumber: 1,
    turnNumber: 1,
    gamePhase: 'playing',  // playing, declaring, roundEnd, gameOver
    hasDrawnThisTurn: false,  // Track if player has drawn this turn
    hasPlayedPairThisTurn: false,  // Track if player has played pair this turn
    declaringPlayer: null,  // Who declared end of round
    declarationType: null,  // 'immediate' or 'lastChance'
  };

  return gameState;
}

/**
 * Check if player can declare end of round
 * 檢查玩家是否可以宣告結束回合
 * Player can declare when hand + played pairs total >= 7 points
 * @param {Object} player - Player object with hand and playedPairs
 * @returns {Boolean} Can declare
 */
export function canDeclare(player) {
  if (!player || !player.hand || player.hand.length === 0) return false;
  
  // Calculate total score from hand
  const handScore = calculateHandScore(player.hand);
  
  // Add score from played pairs (each pair = 1 point)
  const pairScore = player.playedPairs ? player.playedPairs.length : 0;
  
  const totalScore = handScore.total + pairScore;
  
  return totalScore >= 7;
}

/**
 * Draw 2 cards from deck, player chooses 1 to keep and 1 to discard
 * 從牌庫抽2張牌,玩家選1張留手,1張棄置
 * @param {Object} gameState - Current game state
 * @param {number} keepCardIndex - Which card to keep (0 or 1)
 * @param {number} discardPileIndex - Which discard pile to put the other card (0 or 1)
 * @param {Array} preDrawnCards - Optional: array of 2 cards that were already drawn (for preview)
 * @returns {Object} {updatedGameState, drawnCards, keptCard, discardedCard}
 */
export function drawFromDeck(gameState, keepCardIndex, discardPileIndex, preDrawnCards = null) {
  const newState = { ...gameState };

  let drawnCards;
  
  if (preDrawnCards && preDrawnCards.length === 2) {
    // Use pre-drawn cards and remove them from deck
    drawnCards = preDrawnCards;
    
    // Remove these specific cards from the deck
    preDrawnCards.forEach(card => {
      const index = newState.deck.findIndex(c => c.uniqueId === card.uniqueId);
      if (index !== -1) {
        newState.deck.splice(index, 1);
      }
    });
  } else {
    // Check if deck has enough cards
    if (newState.deck.length < 2) {
      throw new Error('牌庫牌數不足,無法抽2張牌');
    }

    // Draw 2 cards randomly from deck
    const randomIndex1 = Math.floor(Math.random() * newState.deck.length);
    const card1 = newState.deck.splice(randomIndex1, 1)[0];
    
    const randomIndex2 = Math.floor(Math.random() * newState.deck.length);
    const card2 = newState.deck.splice(randomIndex2, 1)[0];
    
    drawnCards = [card1, card2];
  }

  // Extract kept and discarded cards from drawn cards
  const keptCard = drawnCards[keepCardIndex];
  const discardedCard = drawnCards[1 - keepCardIndex];

  // Add kept card to current player's hand
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  currentPlayer.hand = [...currentPlayer.hand, keptCard];

  // Add discarded card to selected discard pile
  // If a pile is empty, must discard there
  if (newState.discardPile1.length === 0) {
    newState.discardPile1.push(discardedCard);
  } else if (newState.discardPile2.length === 0) {
    newState.discardPile2.push(discardedCard);
  } else {
    // Both piles have cards, player can choose
    if (discardPileIndex === 0) {
      newState.discardPile1.push(discardedCard);
    } else {
      newState.discardPile2.push(discardedCard);
    }
  }

  // Mark that player has drawn this turn
  newState.hasDrawnThisTurn = true;

  return {
    updatedGameState: newState,
    drawnCards,
    keptCard,
    discardedCard,
  };
}

/**
 * Take top card from a discard pile
 * 從棄牌堆頂抽1張牌
 * @param {Object} gameState - Current game state
 * @param {number} pileIndex - Which pile to take from (0 or 1)
 * @returns {Object} {updatedGameState, takenCard}
 */
export function takeFromDiscardPile(gameState, pileIndex) {
  const newState = { ...gameState };
  
  const pile = pileIndex === 0 ? newState.discardPile1 : newState.discardPile2;

  if (pile.length === 0) {
    throw new Error('棄牌堆是空的,無法抽牌');
  }

  // Take top card (last element)
  const takenCard = pile.pop();
  
  // Add to current player's hand
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  currentPlayer.hand = [...currentPlayer.hand, takenCard];
  
  // Mark that player has drawn this turn
  newState.hasDrawnThisTurn = true;

  return {
    updatedGameState: newState,
    takenCard,
  };
}

/**
 * Play a pair of cards for their effect
 * 打出一對牌並獲得效果
 * @param {Object} gameState - Current game state
 * @param {Array} cardIndices - Indices of 2 cards in hand to play as pair
 * @returns {Object} {updatedGameState, playedPair, effect}
 */
export function playPair(gameState, cardIndices) {
  if (cardIndices.length !== 2) {
    throw new Error('必須選擇2張牌來組成配對');
  }

  const newState = { ...gameState };
  const currentPlayer = newState.players[newState.currentPlayerIndex];

  // Get the cards
  const [index1, index2] = cardIndices.sort((a, b) => b - a); // Sort descending for removal
  const card1 = currentPlayer.hand[index1];
  const card2 = currentPlayer.hand[index2];

  // Validate pair
  if (!isValidPair(card1, card2)) {
    throw new Error('這兩張牌無法組成有效配對');
  }

  // Remove cards from hand
  currentPlayer.hand = currentPlayer.hand.filter((_, index) => 
    index !== index1 && index !== index2
  );

  // Add to played pairs
  if (!currentPlayer.playedPairs) {
    currentPlayer.playedPairs = [];
  }
  currentPlayer.playedPairs.push([card1, card2]);

  // Get the pair effect
  const effect = card1.pairEffect || card2.pairEffect;

  // Mark that player has played pair this turn
  newState.hasPlayedPairThisTurn = true;

  return {
    updatedGameState: newState,
    playedPair: [card1, card2],
    effect,
  };
}

/**
 * Declare end of round
 * 宣告結束回合
 * @param {Object} gameState - Current game state
 * @param {string} declarationType - 'immediate' (到此為止) or 'lastChance' (最後機會)
 * @returns {Object} Updated game state
 */
export function declareEndRound(gameState, declarationType) {
  const newState = { ...gameState };
  
  // Validate that current player can declare
  const currentPlayer = newState.players[newState.currentPlayerIndex];
  if (!canDeclare(currentPlayer)) {
    throw new Error('分數不足7分,無法宣告結束回合');
  }

  newState.declaringPlayer = newState.currentPlayerIndex;
  newState.declarationType = declarationType;

  if (declarationType === 'immediate') {
    // Immediate end - go straight to scoring
    newState.gamePhase = 'roundEnd';
  } else if (declarationType === 'lastChance') {
    // Last chance - protect declarer's hand and let others take one more turn
    currentPlayer.isProtected = true;
    newState.gamePhase = 'lastChance';
    
    // Move to next player
    newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
    newState.hasDrawnThisTurn = false;
    newState.hasPlayedPairThisTurn = false;
  }

  return newState;
}

/**
 * Calculate final scores for round end
 * 計算回合結束時的分數
 * @param {Object} gameState - Current game state
 * @returns {Object} Score results for each player
 */
export function calculateRoundScores(gameState) {
  const { players, declaringPlayer, declarationType } = gameState;
  
  const scores = players.map((player, index) => {
    // Calculate hand score
    const handScore = calculateHandScore(player.hand);
    
    // Add pair score (each pair = 1 point)
    const pairScore = player.playedPairs ? player.playedPairs.length : 0;
    
    const totalScore = handScore.total + pairScore;
    
    return {
      playerIndex: index,
      playerName: player.name,
      handScore: handScore.total,
      pairScore,
      totalScore,
      breakdown: handScore.breakdown,
    };
  });

  // Determine if declarer won
  const declarerScore = scores[declaringPlayer].totalScore;
  const otherScores = scores
    .filter((_, index) => index !== declaringPlayer)
    .map(s => s.totalScore);
  
  const maxOtherScore = Math.max(...otherScores);
  const isDeclarerWinner = declarerScore >= maxOtherScore;

  // Calculate final points for each player
  const finalScores = scores.map((score, index) => {
    let points;
    
    if (index === declaringPlayer) {
      // Declarer
      if (isDeclarerWinner) {
        // Won: get full score + color bonus
        points = score.totalScore;
      } else {
        // Lost: only get color bonus
        points = score.breakdown.colorBonus || 0;
      }
    } else {
      // Other players
      if (isDeclarerWinner) {
        // Declarer won: only get color bonus
        points = score.breakdown.colorBonus || 0;
      } else {
        // Declarer lost: get full score
        points = score.totalScore;
      }
    }

    return {
      ...score,
      finalPoints: points,
      isWinner: isDeclarerWinner && index === declaringPlayer,
    };
  });

  return {
    scores: finalScores,
    declaringPlayer,
    isDeclarerWinner,
  };
}

/**
 * Apply round scores to player totals and check for game winner
 * 將回合分數加到玩家總分並檢查是否有人獲勝
 * @param {Object} gameState - Current game state
 * @param {Object} roundScores - Scores from calculateRoundScores
 * @returns {Object} Updated game state
 */
export function applyRoundScores(gameState, roundScores) {
  const newState = { ...gameState };
  const targetScore = getTargetScore(newState.players.length);

  // Apply scores to each player
  roundScores.scores.forEach(score => {
    const player = newState.players[score.playerIndex];
    player.score += score.finalPoints;
    player.roundScore = score.finalPoints;
  });

  // Check for winner
  const winner = newState.players.find(p => p.score >= targetScore);
  
  if (winner) {
    newState.gamePhase = 'gameOver';
    newState.winner = newState.players.indexOf(winner);
  }

  return newState;
}

/**
 * Check for special win condition (4 mermaids)
 * 檢查特殊勝利條件(4張美人魚)
 * @param {Object} player - Player object
 * @returns {Boolean} Has special win
 */
export function checkSpecialWin(player) {
  return hasAllMermaids(player.hand);
}

/**
 * Move to next player's turn
 * 進入下一位玩家的回合
 * @param {Object} gameState - Current game state
 * @returns {Object} Updated game state
 */
export function nextTurn(gameState) {
  const newState = { ...gameState };
  
  // Check if in last chance phase
  if (newState.gamePhase === 'lastChance') {
    // Check if we've gone around to declarer again
    const nextIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
    
    if (nextIndex === newState.declaringPlayer) {
      // End of last chance, go to scoring
      newState.gamePhase = 'roundEnd';
      return newState;
    }
  }
  
  // Move to next player
  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  newState.turnNumber = (newState.turnNumber || 1) + 1;
  
  // Reset turn flags
  newState.hasDrawnThisTurn = false;
  newState.hasPlayedPairThisTurn = false;

  return newState;
}

/**
 * Get current game status and information
 * 取得目前遊戲狀態與資訊
 * @param {Object} gameState - Current game state
 * @returns {Object} Game status summary
 */
export function getGameStatus(gameState) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const targetScore = getTargetScore(gameState.players.length);

  return {
    currentPlayerIndex: gameState.currentPlayerIndex,
    currentPlayerName: currentPlayer.name,
    gamePhase: gameState.gamePhase,
    targetScore,
    turnNumber: gameState.turnNumber,
    roundNumber: gameState.roundNumber,
    canDeclare: canDeclare(currentPlayer),
    playerScores: gameState.players.map(p => ({
      name: p.name,
      score: p.score,
      handSize: p.hand.length,
      pairsPlayed: p.playedPairs ? p.playedPairs.length : 0,
      isProtected: p.isProtected,
    })),
    deckSize: gameState.deck.length,
    discardPile1: {
      topCard: gameState.discardPile1[gameState.discardPile1.length - 1] || null,
      size: gameState.discardPile1.length,
    },
    discardPile2: {
      topCard: gameState.discardPile2[gameState.discardPile2.length - 1] || null,
      size: gameState.discardPile2.length,
    },
  };
}

/**
 * Execute pair effect after playing a pair
 * 執行配對效果
 * @param {Object} gameState - Current game state
 * @param {string} effect - Effect type (blindDraw, pickDiscard, extraTurn, steal)
 * @param {Object} effectParams - Additional parameters for the effect
 * @returns {Object} Updated game state
 */
export function executePairEffect(gameState, effect, effectParams = {}) {
  const newState = { ...gameState };

  switch (effect) {
    case 'blindDraw':
      // Draw 1 card from deck (blind)
      if (newState.deck.length > 0) {
        const card = newState.deck.pop();
        newState.players[newState.currentPlayerIndex].hand.push(card);
      }
      break;

    case 'pickDiscard':
      // Pick any card from a discard pile
      // effectParams should contain: { pileIndex, cardIndex }
      if (effectParams.pileIndex !== undefined && effectParams.cardIndex !== undefined) {
        const pile = effectParams.pileIndex === 0 ? newState.discardPile1 : newState.discardPile2;
        if (pile.length > effectParams.cardIndex) {
          const card = pile.splice(effectParams.cardIndex, 1)[0];
          newState.players[newState.currentPlayerIndex].hand.push(card);
        }
      }
      break;

    case 'extraTurn':
      // Take another turn immediately
      // Reset turn flags to allow another full turn
      newState.hasDrawnThisTurn = false;
      newState.hasPlayedPairThisTurn = false;
      break;

    case 'steal':
      // Steal random card from opponent
      // effectParams should contain: { targetPlayerIndex }
      if (effectParams.targetPlayerIndex !== undefined) {
        const targetPlayer = newState.players[effectParams.targetPlayerIndex];
        if (targetPlayer && !targetPlayer.isProtected && targetPlayer.hand.length > 0) {
          const randomIndex = Math.floor(Math.random() * targetPlayer.hand.length);
          const stolenCard = targetPlayer.hand.splice(randomIndex, 1)[0];
          newState.players[newState.currentPlayerIndex].hand.push(stolenCard);
        }
      }
      break;

    default:
      break;
  }

  return newState;
}
