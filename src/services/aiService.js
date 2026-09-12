// AI Service - Handles AI player decision making
// AI 玩家決策邏輯服務

import { calculateHandScore, isValidPair } from '../data/cards.js';
import { findValidPairs } from '../utils/gameLogic.js';
import { canDeclare } from '../data/gameRules.js';

/**
 * AI difficulty levels
 * Easy: Makes random but valid decisions
 * Medium: Uses basic strategy
 * Hard: Uses advanced strategy with card counting
 */
export const AI_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

/**
 * Make AI decision for drawing cards
 * @param {Object} gameState - Current game state
 * @param {Object} aiPlayer - AI player object
 * @param {string} difficulty - AI difficulty level
 * @returns {Object} Decision object with action and parameters
 */
export function makeDrawDecision(gameState, aiPlayer, difficulty = AI_DIFFICULTY.MEDIUM) {
  const { discardPile1, discardPile2, deck } = gameState;

  // Get top cards from discard piles
  const topDiscard1 = discardPile1[discardPile1.length - 1];
  const topDiscard2 = discardPile2[discardPile2.length - 1];

  // Calculate values of discard pile top cards
  const discard1Value = evaluateCardValue(topDiscard1, aiPlayer.hand, difficulty);
  const discard2Value = evaluateCardValue(topDiscard2, aiPlayer.hand, difficulty);

  // Threshold for taking from discard
  const threshold = difficulty === AI_DIFFICULTY.EASY ? 2 : difficulty === AI_DIFFICULTY.MEDIUM ? 3 : 4;

  // Decide whether to draw from deck or take from discard pile
  if (discard1Value >= threshold && discard1Value >= discard2Value) {
    return {
      action: 'take-discard',
      pileIndex: 1,
      reason: `Taking valuable card from discard pile 1 (value: ${discard1Value})`,
    };
  } else if (discard2Value >= threshold) {
    return {
      action: 'take-discard',
      pileIndex: 2,
      reason: `Taking valuable card from discard pile 2 (value: ${discard2Value})`,
    };
  } else {
    return {
      action: 'draw-from-deck',
      reason: 'Drawing from deck for better options',
    };
  }
}

/**
 * Make AI decision for which card to keep when drawing 2 from deck
 * @param {Array} drawnCards - Two cards drawn from deck
 * @param {Object} aiPlayer - AI player object
 * @param {string} difficulty - AI difficulty level
 * @returns {Object} Decision object with cardIndex and discardPileIndex
 */
export function makeKeepCardDecision(drawnCards, aiPlayer, difficulty = AI_DIFFICULTY.MEDIUM) {
  const [card1, card2] = drawnCards;

  // Evaluate both cards
  const value1 = evaluateCardValue(card1, aiPlayer.hand, difficulty);
  const value2 = evaluateCardValue(card2, aiPlayer.hand, difficulty);

  // Keep the more valuable card
  const keepIndex = value1 >= value2 ? 0 : 1;

  // Decide which discard pile to place the other card
  // For simplicity, randomly choose or prefer empty pile
  const discardPileIndex = Math.random() > 0.5 ? 1 : 2;

  return {
    keepIndex,
    discardPileIndex,
    reason: `Keeping card with higher value (${keepIndex === 0 ? value1 : value2})`,
  };
}

/**
 * Make AI decision for playing pairs
 * @param {Object} aiPlayer - AI player object
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - AI difficulty level
 * @returns {Object} Decision object with pairs to play
 */
export function makePairPlayDecision(aiPlayer, gameState, difficulty = AI_DIFFICULTY.MEDIUM) {
  const validPairs = findValidPairs(aiPlayer.hand);

  if (validPairs.length === 0) {
    return { playPairs: false, reason: 'No valid pairs available' };
  }

  // Evaluate each pair
  const pairEvaluations = validPairs.map(pair => {
    const pairEffect = evaluatePairEffect(pair, gameState, aiPlayer, difficulty);
    return { pair, value: pairEffect };
  });

  // Sort by value
  pairEvaluations.sort((a, b) => b.value - a.value);

  // Decide how many pairs to play based on difficulty
  if (difficulty === AI_DIFFICULTY.EASY) {
    // Play first valid pair
    return {
      playPairs: true,
      pairs: [pairEvaluations[0].pair],
      reason: 'Playing first valid pair',
    };
  } else if (difficulty === AI_DIFFICULTY.MEDIUM) {
    // Play pairs with positive value
    const worthwhilePairs = pairEvaluations.filter(p => p.value > 2);
    if (worthwhilePairs.length > 0) {
      return {
        playPairs: true,
        pairs: [worthwhilePairs[0].pair],
        reason: 'Playing valuable pair',
      };
    }
  } else {
    // HARD: Consider strategic timing
    const handScore = calculateHandScore(aiPlayer.hand);
    if (handScore.total >= 5) {
      // Save pairs for final scoring if close to declaring
      return { playPairs: false, reason: 'Saving pairs for final score' };
    } else {
      // Play highest value pair
      const worthwhilePairs = pairEvaluations.filter(p => p.value > 3);
      if (worthwhilePairs.length > 0) {
        return {
          playPairs: true,
          pairs: [worthwhilePairs[0].pair],
          reason: 'Playing strategically valuable pair',
        };
      }
    }
  }

  return { playPairs: false, reason: 'No worthwhile pairs to play' };
}

/**
 * Make AI decision for declaring end of round
 * @param {Object} aiPlayer - AI player object
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - AI difficulty level
 * @returns {Object} Decision object with declare action
 */
export function makeDeclareDecision(aiPlayer, gameState, difficulty = AI_DIFFICULTY.MEDIUM) {
  if (!canDeclare(aiPlayer)) {
    return { shouldDeclare: false, reason: 'Cannot declare yet (score < 7)' };
  }

  const handScore = calculateHandScore(aiPlayer.hand);
  const totalScore = handScore.total + (aiPlayer.playedPairs?.length || 0);

  // Estimate other players' scores
  const otherPlayers = gameState.players.filter(p => p.id !== aiPlayer.id);
  const highestOpponentHandSize = Math.max(...otherPlayers.map(p => p.hand.length));

  // Decision thresholds based on difficulty
  if (difficulty === AI_DIFFICULTY.EASY) {
    // Easy: Declare at 10+ points
    if (totalScore >= 10) {
      return {
        shouldDeclare: true,
        declarationType: Math.random() > 0.5 ? 'immediate' : 'lastChance',
        reason: `Score is ${totalScore}, declaring randomly`,
      };
    }
  } else if (difficulty === AI_DIFFICULTY.MEDIUM) {
    // Medium: Consider opponent hand sizes
    if (totalScore >= 12 && highestOpponentHandSize <= 4) {
      return {
        shouldDeclare: true,
        declarationType: 'lastChance',
        reason: `Score is ${totalScore}, opponents have few cards`,
      };
    } else if (totalScore >= 15) {
      return {
        shouldDeclare: true,
        declarationType: 'immediate',
        reason: `High score of ${totalScore}, declaring immediately`,
      };
    }
  } else {
    // Hard: Advanced strategy
    const estimatedWinChance = estimateWinningChance(aiPlayer, gameState);

    if (estimatedWinChance > 0.7 && totalScore >= 12) {
      return {
        shouldDeclare: true,
        declarationType: 'lastChance',
        reason: `High win chance (${(estimatedWinChance * 100).toFixed(0)}%) with score ${totalScore}`,
      };
    } else if (totalScore >= 18) {
      return {
        shouldDeclare: true,
        declarationType: 'immediate',
        reason: `Very high score of ${totalScore}, ending round`,
      };
    }
  }

  return { shouldDeclare: false, reason: 'Not ready to declare yet' };
}

/**
 * Evaluate the value of a card for the AI player
 * Higher value = more desirable
 * @param {Object} card - Card to evaluate
 * @param {Array} currentHand - AI player's current hand
 * @param {string} difficulty - AI difficulty level
 * @returns {number} Card value score
 */
function evaluateCardValue(card, currentHand, difficulty) {
  if (!card) return 0;

  let value = card.value || 1;

  // Check if card completes a pair
  const hasPair = currentHand.some(c => isValidPair(c, card));
  if (hasPair) {
    value += difficulty === AI_DIFFICULTY.HARD ? 5 : 3;
  }

  // Special cards bonus
  if (card.id === 'mermaid') {
    value += 3;
  }

  // Multiplier cards bonus
  if (card.type === 'multiplier') {
    // Check how many cards it would multiply
    const relevantCards = currentHand.filter(c => {
      if (card.id === 'lighthouse') return c.id === 'fish';
      if (card.id === 'school_of_fish') return c.id === 'crab';
      if (card.id === 'penguin_colony') return c.id === 'sailboat';
      if (card.id === 'captain') return c.id === 'shell';
      return false;
    });
    value += relevantCards.length * 2;
  }

  // Color synergy bonus (for color bonus scoring)
  if (difficulty === AI_DIFFICULTY.HARD) {
    const colorCounts = {};
    currentHand.forEach(c => {
      if (c.color) {
        colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
      }
    });

    if (card.color && colorCounts[card.color]) {
      value += colorCounts[card.color] * 0.5;
    }
  }

  return value;
}

/**
 * Evaluate the strategic value of playing a pair
 * @param {Object} pair - Pair object with card indices
 * @param {Object} gameState - Current game state
 * @param {Object} aiPlayer - AI player object
 * @param {string} difficulty - AI difficulty level
 * @returns {number} Pair value score
 */
function evaluatePairEffect(pair, gameState, aiPlayer, difficulty) {
  const { cardIndices, effect } = pair;
  let value = 1; // Base value for +1 score

  if (!effect) return value;

  // Evaluate different pair effects
  switch (effect.type) {
    case 'draw':
      // Drawing cards is valuable early game
      value += difficulty === AI_DIFFICULTY.HARD ? 4 : 3;
      break;

    case 'take-any-discard':
      // Taking from discard is very valuable if good cards are there
      value += 5;
      break;

    case 'extra-turn':
      // Extra turn is extremely valuable
      value += 6;
      break;

    case 'steal':
      // Stealing is valuable if opponents have cards
      const opponentsWithCards = gameState.players.filter(
        p => p.id !== aiPlayer.id && p.hand.length > 0
      );
      value += opponentsWithCards.length > 0 ? 5 : 2;
      break;

    default:
      value += 2;
  }

  return value;
}

/**
 * Estimate AI's chance of winning if declaring now
 * @param {Object} aiPlayer - AI player object
 * @param {Object} gameState - Current game state
 * @returns {number} Win chance between 0 and 1
 */
function estimateWinningChance(aiPlayer, gameState) {
  const aiScore = calculateHandScore(aiPlayer.hand).total + (aiPlayer.playedPairs?.length || 0);

  // Estimate opponent scores based on hand sizes
  const otherPlayers = gameState.players.filter(p => p.id !== aiPlayer.id);
  const estimatedOpponentScores = otherPlayers.map(p => {
    // Rough estimate: 2 points per card on average
    return p.hand.length * 2 + (p.playedPairs?.length || 0);
  });

  const maxOpponentScore = Math.max(...estimatedOpponentScores, 0);

  // Calculate win probability
  const scoreDifference = aiScore - maxOpponentScore;

  if (scoreDifference > 5) return 0.9;
  if (scoreDifference > 3) return 0.7;
  if (scoreDifference > 0) return 0.6;
  if (scoreDifference > -3) return 0.4;
  return 0.2;
}

/**
 * Execute AI turn automatically
 * This is the main function to call for AI turn automation
 * @param {Object} gameState - Current game state
 * @param {string} aiPlayerId - AI player ID
 * @param {string} difficulty - AI difficulty level
 * @param {Object} callbacks - Callback functions for game actions
 * @returns {Promise} Resolves when AI turn is complete
 */
export async function executeAITurn(gameState, aiPlayerId, difficulty, callbacks) {
  const {
    onDrawFromDeck,
    onTakeFromDiscard,
    onKeepCard,
    onPlayPair,
    onDeclareEnd,
    onEndTurn,
  } = callbacks;

  console.log(`[AI] Starting turn for AI player: ${aiPlayerId} (${difficulty})`);

  const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
  if (!aiPlayer) {
    console.error('[AI] AI player not found');
    return;
  }

  // Delay for more realistic AI behavior
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const thinkingTime = difficulty === AI_DIFFICULTY.EASY ? 1000 :
                       difficulty === AI_DIFFICULTY.MEDIUM ? 1500 : 2000;

  await delay(thinkingTime);

  // Step 1: Draw cards
  if (!gameState.hasDrawnThisTurn) {
    const drawDecision = makeDrawDecision(gameState, aiPlayer, difficulty);
    console.log('[AI] Draw decision:', drawDecision.reason);

    if (drawDecision.action === 'draw-from-deck') {
      await onDrawFromDeck();
      // AI will need to choose which card to keep
      // This should be handled in the next phase
    } else {
      await onTakeFromDiscard(drawDecision.pileIndex);
    }

    await delay(thinkingTime / 2);
  }

  // Step 2: Play pairs (if any)
  const pairDecision = makePairPlayDecision(aiPlayer, gameState, difficulty);
  if (pairDecision.playPairs && pairDecision.pairs.length > 0) {
    console.log('[AI] Pair decision:', pairDecision.reason);

    for (const pair of pairDecision.pairs) {
      await onPlayPair(pair.cardIndices);
      await delay(thinkingTime / 2);
    }
  } else {
    console.log('[AI] No pairs to play:', pairDecision.reason);
  }

  // Step 3: Consider declaring
  const declareDecision = makeDeclareDecision(aiPlayer, gameState, difficulty);
  if (declareDecision.shouldDeclare) {
    console.log('[AI] Declare decision:', declareDecision.reason);
    await onDeclareEnd(declareDecision.declarationType);
    return; // Turn ends after declaring
  } else {
    console.log('[AI] Not declaring:', declareDecision.reason);
  }

  // Step 4: End turn
  await delay(500);
  await onEndTurn();
  console.log('[AI] Turn complete');
}

/**
 * Check if a player is an AI player
 * @param {Object} player - Player object
 * @returns {boolean} True if player is AI
 */
export function isAIPlayer(player) {
  return player && (player.isAI === true || player.id?.startsWith('ai_'));
}

/**
 * Create an AI player object
 * @param {string} name - AI player name
 * @param {string} difficulty - AI difficulty level
 * @returns {Object} AI player object
 */
export function createAIPlayer(name = 'AI Player', difficulty = AI_DIFFICULTY.MEDIUM) {
  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${name} (${difficulty.toUpperCase()})`,
    isAI: true,
    aiDifficulty: difficulty,
    score: 0,
  };
}

export default {
  AI_DIFFICULTY,
  makeDrawDecision,
  makeKeepCardDecision,
  makePairPlayDecision,
  makeDeclareDecision,
  executeAITurn,
  isAIPlayer,
  createAIPlayer,
};
