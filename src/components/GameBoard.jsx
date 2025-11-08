import React, { useState, useEffect } from 'react';
import '../styles/GameBoard.css';
import {
  initializeGameDeck,
  initializeRound,
  drawFromDeck,
  takeFromDiscardPile,
  canDeclare,
  calculatePlayerScore,
  determineDeclarationWinner,
  processRoundEnd,
  getTargetScore,
} from '../data/gameRules.js';
import {
  findValidPairs,
  sortHand,
  getCardDisplayName,
} from '../utils/gameLogic.js';
import {
  subscribeToGameState,
  updateGameState,
} from '../services/gameService.js';
import GameBoardHeader from './GameBoardHeader.jsx';
import CardDisplay from './CardDisplay.jsx';
import PlayerHand from './PlayerHand.jsx';
import GameActions from './GameActions.jsx';
import OtherPlayers from './OtherPlayers.jsx';
import DeclarationModal from './DeclarationModal.jsx';

export default function GameBoard({
  roomCode,
  playerId,
  playerName,
  players: initialPlayers,
  onGameOver,
  onBack,
}) {
  // Game state
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedCardIndices, setSelectedCardIndices] = useState([]);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [pendingPairIndices, setPendingPairIndices] = useState(null);

  // Initialize game
  useEffect(() => {
    if (!gameState) {
      initializeGame();
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameState) return;

    const unsubscribe = subscribeToGameState(roomCode, (updatedState) => {
      setGameState(updatedState);
    });

    return () => unsubscribe?.();
  }, [roomCode, gameState]);

  const initializeGame = () => {
    try {
      const deck = initializeGameDeck();
      const roundState = initializeRound(initialPlayers, deck);
      setGameState(roundState);
      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize game:', error);
      setMessage('遊戲初始化失敗');
    }
  };

  if (loading || !gameState) {
    return <div className="game-board loading">載入遊戲中...</div>;
  }

  // Get current player and player index
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const playerIndex = gameState.players.findIndex(p => p.id === playerId || p.name === playerName);
  const isCurrentPlayer = playerIndex === gameState.currentPlayerIndex;
  const currentPlayerHand = sortHand(currentPlayer.hand || []);

  // Get UI data
  const topDiscardPile1 = gameState.discardPiles[0]?.[gameState.discardPiles[0].length - 1];
  const topDiscardPile2 = gameState.discardPiles[1]?.[gameState.discardPiles[1].length - 1];
  const playerScore = calculatePlayerScore(gameState.players[playerIndex].hand, false);
  const validPairs = findValidPairs(currentPlayerHand);
  const canDeclareSelf = canDeclare(gameState.players[playerIndex].hand);
  const targetScore = getTargetScore(gameState.players.length);

  // Handle card selection for pairs
  const handleCardClick = (index) => {
    if (!isCurrentPlayer) return;

    setSelectedCardIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length < 2) {
        return [...prev, index];
      }
      return [index];
    });
  };

  // Handle drawing from deck
  const handleDrawFromDeck = async (discardPileIndex, keepCardIndex) => {
    if (!isCurrentPlayer) {
      setMessage('不是你的回合!');
      return;
    }

    try {
      setLoading(true);
      const result = drawFromDeck(gameState, discardPileIndex, keepCardIndex);
      setGameState(result.updatedGameState);
      setMessage(`抽牌成功！拿到${result.keptCard.name}`);
      setSelectedCardIndices([]);
    } catch (error) {
      setMessage('抽牌失敗');
    } finally {
      setLoading(false);
    }
  };

  // Handle taking from discard pile
  const handleTakeFromDiscard = async (pileIndex) => {
    if (!isCurrentPlayer) {
      setMessage('不是你的回合!');
      return;
    }

    try {
      setLoading(true);
      const result = takeFromDiscardPile(gameState, pileIndex);
      if (!result) {
        setMessage('棄牌堆空了!');
        return;
      }
      setGameState(result.updatedGameState);
      setMessage(`拿到${result.takenCard.name}`);
      setSelectedCardIndices([]);
    } catch (error) {
      setMessage('操作失敗');
    } finally {
      setLoading(false);
    }
  };

  // Handle pair effect
  const handlePlayPair = () => {
    if (selectedCardIndices.length !== 2) {
      setMessage('請選擇 2 張卡牌');
      return;
    }

    // Check if valid pair
    const card1 = currentPlayerHand[selectedCardIndices[0]];
    const card2 = currentPlayerHand[selectedCardIndices[1]];

    const isValid = validPairs.some(
      pair => (pair.index1 === selectedCardIndices[0] && pair.index2 === selectedCardIndices[1]) ||
               (pair.index1 === selectedCardIndices[1] && pair.index2 === selectedCardIndices[0])
    );

    if (!isValid) {
      setMessage('這不是有效的配對!');
      return;
    }

    setPendingPairIndices(selectedCardIndices);
    setMessage(`配對成功! ${card1.name} + ${card2.name}`);
  };

  // Handle end turn
  const handleEndTurn = () => {
    if (!isCurrentPlayer) return;

    const newGameState = { ...gameState };
    newGameState.currentPlayerIndex = (newGameState.currentPlayerIndex + 1) % newGameState.players.length;
    setGameState(newGameState);
    setSelectedCardIndices([]);
    setMessage('');
  };

  // Handle declaration
  const handleDeclare = (type) => {
    // 'immediate' or 'lastChance'
    if (!isCurrentPlayer) return;

    if (!canDeclareSelf) {
      setMessage('你的手牌不足 7 分，不能宣告!');
      return;
    }

    // Calculate scores for all players
    const playerScores = gameState.players.map((p, idx) => {
      const score = calculatePlayerScore(p.hand, false);
      return {
        playerIndex: idx,
        playerName: p.name,
        score: score,
      };
    });

    const { isDeclarerWinner } = determineDeclarationWinner(playerScores, gameState.currentPlayerIndex);

    // Process round end
    const updatedState = processRoundEnd(gameState, gameState.currentPlayerIndex, type);

    // Check for game winner
    if (updatedState.gameWinner !== null) {
      const winner = updatedState.players[updatedState.gameWinner];
      onGameOver({
        winnerName: winner.name,
        winnerId: winner.id,
        winnerScore: winner.score,
        declarer: currentPlayer.name,
        type: type === 'immediate' ? '到此為止' : '最後機會',
        isDeclarerWinner,
        playerScores: gameState.players.map(p => ({
          name: p.name,
          finalScore: p.score,
        })),
      });
    } else {
      // Continue next round
      setGameState(updatedState);
      setMessage(`宣告完成! ${isDeclarerWinner ? '宣告者獲勝!' : '宣告者敗北!'}`);
    }

    setShowDeclarationModal(false);
    setSelectedCardIndices([]);
  };

  return (
    <div className="game-board">
      <GameBoardHeader
        roomCode={roomCode}
        currentPlayerName={currentPlayer.name}
        roundNumber={gameState.roundNumber + 1}
        onBack={onBack}
      />

      {message && (
        <div className="game-message">
          <p>{message}</p>
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="game-main-container">
        {/* Discard Piles */}
        <div className="discard-section">
          <h3>棄牌堆</h3>
          <div className="discard-piles">
            <CardDisplay
              card={topDiscardPile1}
              onClick={isCurrentPlayer ? () => handleTakeFromDiscard(0) : null}
              title="棄牌堆 1"
            />
            <CardDisplay
              card={topDiscardPile2}
              onClick={isCurrentPlayer ? () => handleTakeFromDiscard(1) : null}
              title="棄牌堆 2"
            />
          </div>
        </div>

        {/* Draw Pile & Info */}
        <div className="center-section">
          <div className="draw-pile-section">
            <button
              className="draw-pile-btn"
              onClick={() => setShowDeclarationModal(true)}
              disabled={!isCurrentPlayer || !canDeclareSelf}
            >
              📋 宣告結束
              {canDeclareSelf && <span className="can-declare">✓</span>}
            </button>
            <p className="deck-size">牌堆: {gameState.deck.length} 張</p>
          </div>
          <div className="players-score-info">
            {gameState.players.map((p, idx) => (
              <div key={idx} className={`player-info ${idx === gameState.currentPlayerIndex ? 'current' : ''}`}>
                <span className="name">{p.name}</span>
                <span className="score">{p.score}/{targetScore}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Player Hand */}
      <PlayerHand
        hand={currentPlayerHand}
        selectedIndices={selectedCardIndices}
        onCardClick={handleCardClick}
        isCurrentPlayer={isCurrentPlayer}
        playerScore={playerScore}
        validPairs={validPairs}
      />

      {/* Actions */}
      {isCurrentPlayer && (
        <GameActions
          onPlayPair={handlePlayPair}
          onEndTurn={handleEndTurn}
          canPlayPair={selectedCardIndices.length === 2}
          canDeclare={canDeclareSelf}
          loading={loading}
        />
      )}

      {/* Other Players */}
      <OtherPlayers
        players={gameState.players}
        currentPlayerIndex={gameState.currentPlayerIndex}
        playerId={playerId}
      />

      {/* Declaration Modal */}
      {showDeclarationModal && (
        <DeclarationModal
          canDeclare={canDeclareSelf}
          onImmediate={() => handleDeclare('immediate')}
          onLastChance={() => handleDeclare('lastChance')}
          onCancel={() => setShowDeclarationModal(false)}
          playerName={currentPlayer.name}
          playerScore={playerScore.total}
        />
      )}
    </div>
  );
}