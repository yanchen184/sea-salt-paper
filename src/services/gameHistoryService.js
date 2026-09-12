// Game History Service - Handles saving and retrieving game history
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebaseDb.js';

/**
 * Save a completed game to history
 * @param {Object} gameData - Game completion data
 * @returns {Promise<string>} Document ID of saved game
 */
export async function saveGameHistory(gameData) {
  console.log('[gameHistoryService] Saving game to history...');

  try {
    const historyRef = collection(db, 'gameHistory');

    const historyEntry = {
      roomCode: gameData.roomCode,
      players: gameData.players.map(p => ({
        id: p.id,
        name: p.name,
        finalScore: p.score || 0,
        isWinner: p.id === gameData.winnerId,
      })),
      winner: {
        id: gameData.winnerId,
        name: gameData.winnerName,
        score: gameData.winnerScore || 0,
      },
      gameMode: gameData.gameMode || 'standard', // standard, custom, etc.
      playerCount: gameData.players.length,
      totalRounds: gameData.totalRounds || 1,
      winCondition: gameData.winCondition || 'score', // 'score' or 'mermaids'
      gameDuration: gameData.gameDuration || 0, // in seconds
      completedAt: Timestamp.now(),
      createdAt: gameData.startedAt ? Timestamp.fromDate(new Date(gameData.startedAt)) : Timestamp.now(),
    };

    const docRef = await addDoc(historyRef, historyEntry);
    console.log('[gameHistoryService] ✓ Game saved to history with ID:', docRef.id);

    return docRef.id;
  } catch (error) {
    console.error('[gameHistoryService] ✗ Error saving game history:', error);
    throw error;
  }
}

/**
 * Get recent game history
 * @param {number} limitCount - Number of games to retrieve
 * @returns {Promise<Array>} Array of game history entries
 */
export async function getRecentGames(limitCount = 10) {
  console.log('[gameHistoryService] Fetching recent games...');

  try {
    const historyRef = collection(db, 'gameHistory');
    const q = query(
      historyRef,
      orderBy('completedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const games = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      completedAt: doc.data().completedAt?.toDate?.() || new Date(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    }));

    console.log('[gameHistoryService] ✓ Retrieved', games.length, 'games');
    return games;
  } catch (error) {
    console.error('[gameHistoryService] ✗ Error fetching recent games:', error);
    throw error;
  }
}

/**
 * Get game history for a specific player
 * @param {string} playerId - Player ID
 * @param {number} limitCount - Number of games to retrieve
 * @returns {Promise<Array>} Array of game history entries
 */
export async function getPlayerHistory(playerId, limitCount = 20) {
  console.log('[gameHistoryService] Fetching player history for:', playerId);

  try {
    const historyRef = collection(db, 'gameHistory');
    const q = query(
      historyRef,
      where('players', 'array-contains-any', [
        { id: playerId }
      ]),
      orderBy('completedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const games = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      completedAt: doc.data().completedAt?.toDate?.() || new Date(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    })).filter(game =>
      game.players.some(p => p.id === playerId)
    );

    console.log('[gameHistoryService] ✓ Retrieved', games.length, 'games for player');
    return games;
  } catch (error) {
    console.error('[gameHistoryService] ✗ Error fetching player history:', error);
    throw error;
  }
}

/**
 * Get player statistics
 * @param {string} playerId - Player ID
 * @returns {Promise<Object>} Player statistics
 */
export async function getPlayerStats(playerId) {
  console.log('[gameHistoryService] Calculating stats for player:', playerId);

  try {
    const games = await getPlayerHistory(playerId, 100);

    const stats = {
      totalGames: games.length,
      wins: 0,
      losses: 0,
      winRate: 0,
      averageScore: 0,
      highestScore: 0,
      totalScore: 0,
      mermaidWins: 0,
      scoreWins: 0,
    };

    games.forEach(game => {
      const playerData = game.players.find(p => p.id === playerId);
      if (playerData) {
        if (playerData.isWinner) {
          stats.wins++;
          if (game.winCondition === 'mermaids') {
            stats.mermaidWins++;
          } else {
            stats.scoreWins++;
          }
        } else {
          stats.losses++;
        }

        stats.totalScore += playerData.finalScore || 0;
        if (playerData.finalScore > stats.highestScore) {
          stats.highestScore = playerData.finalScore;
        }
      }
    });

    if (stats.totalGames > 0) {
      stats.winRate = ((stats.wins / stats.totalGames) * 100).toFixed(1);
      stats.averageScore = (stats.totalScore / stats.totalGames).toFixed(1);
    }

    console.log('[gameHistoryService] ✓ Stats calculated:', stats);
    return stats;
  } catch (error) {
    console.error('[gameHistoryService] ✗ Error calculating player stats:', error);
    throw error;
  }
}

/**
 * Get leaderboard (top players by win rate)
 * @param {number} limitCount - Number of top players to retrieve
 * @returns {Promise<Array>} Array of top players
 */
export async function getLeaderboard(limitCount = 10) {
  console.log('[gameHistoryService] Fetching leaderboard...');

  try {
    const historyRef = collection(db, 'gameHistory');
    const q = query(
      historyRef,
      orderBy('completedAt', 'desc'),
      limit(200) // Get recent games to calculate leaderboard
    );

    const snapshot = await getDocs(q);
    const playerMap = new Map();

    // Aggregate player data
    snapshot.docs.forEach(doc => {
      const game = doc.data();
      game.players.forEach(player => {
        if (!playerMap.has(player.id)) {
          playerMap.set(player.id, {
            id: player.id,
            name: player.name,
            gamesPlayed: 0,
            wins: 0,
            totalScore: 0,
          });
        }

        const stats = playerMap.get(player.id);
        stats.gamesPlayed++;
        stats.totalScore += player.finalScore || 0;
        if (player.isWinner) {
          stats.wins++;
        }
      });
    });

    // Calculate win rates and sort
    const leaderboard = Array.from(playerMap.values())
      .filter(p => p.gamesPlayed >= 3) // Minimum 3 games to qualify
      .map(p => ({
        ...p,
        winRate: ((p.wins / p.gamesPlayed) * 100).toFixed(1),
        averageScore: (p.totalScore / p.gamesPlayed).toFixed(1),
      }))
      .sort((a, b) => {
        // Sort by win rate, then by games played
        const winRateDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
        if (Math.abs(winRateDiff) > 0.1) {
          return winRateDiff;
        }
        return b.gamesPlayed - a.gamesPlayed;
      })
      .slice(0, limitCount);

    console.log('[gameHistoryService] ✓ Leaderboard calculated:', leaderboard.length, 'players');
    return leaderboard;
  } catch (error) {
    console.error('[gameHistoryService] ✗ Error fetching leaderboard:', error);
    throw error;
  }
}
