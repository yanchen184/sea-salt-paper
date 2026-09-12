import React, { useState, useEffect } from 'react';
import '../styles/GameBoard.css';
import { calculateHandScore, isValidPair } from '../data/cards.js';
import {
  drawFromDeck,
  takeFromDiscardPile,
  canDeclare,
  calculateRoundScores,
  applyRoundScores,
  declareEndRound,
  nextTurn,
  getTargetScore,
  playPair,
} from '../data/gameRules.js';
import {
  findValidPairs,
  sortHand,
} from '../utils/gameLogic.js';
import { subscribeToGameState, syncCompleteGameState } from '../services/gameService.js';
import DeclarationModal from './DeclarationModal.jsx';
import DeckViewer from './DeckViewer';
import AllPlayersDisplay from './AllPlayersDisplay.jsx';
import GameActionLog from './GameActionLog.jsx';

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
  const [drawnCards, setDrawnCards] = useState(null);
  const [showDeckViewer, setShowDeckViewer] = useState(false);
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const [draggedCardIndex, setDraggedCardIndex] = useState(null);
  const [dragOverPile, setDragOverPile] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoverTimer, setHoverTimer] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  // Hand card drag state
  const [draggedHandCardIndex, setDraggedHandCardIndex] = useState(null);
  const [dragOverHandIndex, setDragOverHandIndex] = useState(null);

  // Hand panel resize state
  const [handPanelSize, setHandPanelSize] = useState({ width: 1000, height: 200 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });

  // Initialize game - DO NOT initialize here, wait for Firebase sync
  // The game is already initialized by the host in App.jsx and synced to Firebase
  // We just need to wait for the subscription to receive the data
  useEffect(() => {
    console.log('[GameBoard] 組件已掛載，等待 Firebase 同步遊戲狀態...');

    // Add initial game start log if not present
    const initializeActionLog = async () => {
      try {
        if (gameState && (!gameState.actionLog || gameState.actionLog.length === 0)) {
          await addActionLog({
            player: '',
            action: '🎮 遊戲開始！',
            icon: '🎮'
          });
        }
      } catch (error) {
        console.log('[GameBoard] Failed to add initial action log:', error);
      }
    };

    if (gameState) {
      initializeActionLog();
    }
  }, [gameState?.roundNumber]); // Only run when game initializes

  // Subscribe to real-time updates
  useEffect(() => {
    if (!roomCode) return;

    console.log('[GameBoard] 設置 Firebase 訂閱...');
    const unsubscribe = subscribeToGameState(roomCode, (updatedState) => {
      console.log('[GameBoard] 📨 收到 Firebase 更新');
      console.log('[GameBoard] hasDrawnThisTurn:', updatedState?.hasDrawnThisTurn);
      console.log('[GameBoard] currentPlayerIndex:', updatedState?.currentPlayerIndex);
      console.log('[GameBoard] gamePhase:', updatedState?.gamePhase);
      // Only update if we have valid data
      if (updatedState && updatedState.players && updatedState.players.length > 0) {
        console.log('[GameBoard] ✓ 更新遊戲狀態');
        setGameState(updatedState);
        setLoading(false);
      } else {
        console.log('[GameBoard] ⚠️ 收到空數據，等待初始化...');
      }
    });

    return () => {
      console.log('[GameBoard] 清理 Firebase 訂閱');
      unsubscribe?.();
    };
  }, [roomCode]);

  // Add resize listeners
  useEffect(() => {
    const handleResizeMove = (e) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.x;
        const deltaY = e.clientY - resizeStartPos.y;

        setHandPanelSize({
          width: Math.max(400, Math.min(1400, resizeStartSize.width + deltaX)),
          height: Math.max(150, Math.min(400, resizeStartSize.height + deltaY))
        });
      }
    };

    const handleResizeEnd = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, resizeStartPos, resizeStartSize]);

  // Note: Game initialization is handled by the host in App.jsx
  // This component only needs to subscribe to Firebase for updates

  if (loading || !gameState) {
    return <div className="game-board loading">載入遊戲中...</div>;
  }

  // Safety check: validate game state
  if (!gameState.players || gameState.players.length === 0) {
    return (
      <div className="game-board loading" style={{ color: 'white', padding: '50px' }}>
        <h2>錯誤：遊戲狀態無效</h2>
        <p>沒有玩家資料</p>
        <button onClick={onBack}>返回</button>
      </div>
    );
  }

  if (gameState.currentPlayerIndex < 0 || gameState.currentPlayerIndex >= gameState.players.length) {
    return (
      <div className="game-board loading" style={{ color: 'white', padding: '50px' }}>
        <h2>錯誤：當前玩家索引無效</h2>
        <p>currentPlayerIndex: {gameState.currentPlayerIndex}</p>
        <p>玩家數量: {gameState.players.length}</p>
        <button onClick={onBack}>返回</button>
      </div>
    );
  }

  // Get current player and player index
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const playerIndex = gameState.players.findIndex(p => p.id === playerId || p.name === playerName);
  
  // Safety check: if player not found, show error
  if (playerIndex === -1) {
    return (
      <div className="game-board loading" style={{ color: 'white', padding: '50px' }}>
        <h2>錯誤：找不到玩家</h2>
        <p>playerId: {playerId}</p>
        <p>playerName: {playerName}</p>
        <p>玩家列表: {JSON.stringify(gameState.players.map(p => ({ id: p.id, name: p.name })))}</p>
        <button onClick={onBack}>返回</button>
      </div>
    );
  }
  
  const isCurrentPlayer = playerIndex === gameState.currentPlayerIndex;

  // Get MY hand (the logged-in player's hand)
  const myPlayer = gameState.players[playerIndex];
  const myHand = sortHand(myPlayer.hand || []);

  // Get UI data
  const topDiscardPile1 = gameState.discardPile1?.[gameState.discardPile1.length - 1];
  const topDiscardPile2 = gameState.discardPile2?.[gameState.discardPile2.length - 1];
  const myScore = calculateHandScore(myHand);
  const validPairs = findValidPairs(myHand);
  const canDeclareSelf = canDeclare(myPlayer);
  const targetScore = getTargetScore(gameState.players.length);

  // Handle card selection for pairs
  const handleCardClick = (index) => {
    if (!isCurrentPlayer) return;

    setSelectedCardIndices(prev => {
      // If clicking an already selected card, deselect it
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }

      // If no cards selected, select this one
      if (prev.length === 0) {
        return [index];
      }

      // If one card already selected, check if they can form a valid pair
      if (prev.length === 1) {
        const firstCard = myHand[prev[0]];
        const secondCard = myHand[index];

        // Only allow selection if they form a valid pair
        if (isValidPair(firstCard, secondCard)) {
          return [...prev, index];
        } else {
          // Can't pair with first card, so replace selection with new card
          setMessage('這兩張牌無法配對，請選擇可配對的牌');
          setTimeout(() => setMessage(''), 2000);
          return [index];
        }
      }

      // If two cards already selected, start fresh with new selection
      return [index];
    });
  };

  // Handle drawing from deck
  const handleInitiateDraw = async () => {
    if (!isCurrentPlayer) {
      setMessage('不是你的回合!');
      return;
    }

    if (gameState.hasDrawnThisTurn) {
      setMessage('你這回合已經抽過牌了!');
      return;
    }

    // Prevent drawing if already in drawing state
    if (drawnCards) {
      setMessage('請先完成當前抽牌!');
      return;
    }

    // Check if deck has enough cards
    if (gameState.deck.length < 2) {
      setMessage('牌堆没有足夠的牌!');
      return;
    }

    // Draw 2 random cards to show on screen
    const deckCopy = [...gameState.deck];
    const randomIndex1 = Math.floor(Math.random() * deckCopy.length);
    const card1 = deckCopy[randomIndex1];

    // Remove first drawn card from temporary copy
    deckCopy.splice(randomIndex1, 1);

    const randomIndex2 = Math.floor(Math.random() * deckCopy.length);
    const card2 = deckCopy[randomIndex2];

    setDrawnCards([card1, card2]);
    setMessage('拖曳一張牌到棄牌堆，另一張會加入你的手牌');

    // Sync drawing state to Firebase so other players can see
    try {
      const updatedGameState = {
        ...gameState,
        drawingState: {
          playerId: playerId,
          playerName: myPlayer.name,
          isDrawing: true
        }
      };
      await syncCompleteGameState(roomCode, updatedGameState);
      // Don't update local state here - wait for Firebase sync
    } catch (error) {
      console.error('[GameBoard] Failed to sync drawing state:', error);
    }

    // Add to action log
    addActionLog({
      player: myPlayer.name,
      action: '從牌堆抽牌',
      icon: '🎴'
    });
  };

  const handleConfirmDrawSelection = async (draggedCardIndex, discardPileIndex) => {
    console.log('[GameBoard.handleConfirmDrawSelection] ========== 確認抽牌選擇 ==========');
    console.log('[GameBoard] draggedCardIndex:', draggedCardIndex);
    console.log('[GameBoard] discardPileIndex:', discardPileIndex);

    try {
      setLoading(true);
      console.log('[GameBoard] 呼叫 drawFromDeck...');

      // The card that was dragged goes to discard, the other goes to hand
      const keepCardIndex = draggedCardIndex === 0 ? 1 : 0;

      // drawFromDeck参数顺序: (gameState, keepCardIndex, discardPileIndex, preDrawnCards)
      const result = drawFromDeck(gameState, keepCardIndex, discardPileIndex, drawnCards);
      console.log('[GameBoard] ✓ drawFromDeck 成功');
      console.log('[GameBoard] 保留的牌:', result.keptCard);
      console.log('[GameBoard] 棄掉的牌:', result.discardedCard);

      // Change phase to 'playing' after drawing
      result.updatedGameState.gamePhase = 'playing';

      // Clear drawing state
      result.updatedGameState.drawingState = null;

      // Sync to Firebase before updating local state
      console.log('[GameBoard] 同步狀態到 Firebase...');
      console.log('[GameBoard] hasDrawnThisTurn:', result.updatedGameState.hasDrawnThisTurn);
      await syncCompleteGameState(roomCode, result.updatedGameState);
      console.log('[GameBoard] ✓ 狀態已同步');

      // Force update gameState immediately
      console.log('[GameBoard] 強制更新本地 gameState...');
      console.log('[GameBoard] result.updatedGameState.hasDrawnThisTurn:', result.updatedGameState.hasDrawnThisTurn);
      setGameState({...result.updatedGameState});
      setMessage(`抽牌成功！拿到${result.keptCard.name}`);
      setSelectedCardIndices([]);
      setDrawnCards(null);
      setDraggedCardIndex(null);
      setDragOverPile(null);

      // Add to action log
      addActionLog({
        player: myPlayer.name,
        action: `留下 ${result.keptCard.name}，棄置 ${result.discardedCard.name}`,
        icon: '✅'
      });

      console.log('[GameBoard] ✓ 抽牌完成');
    } catch (error) {
      console.error('[GameBoard] ✗ 抽牌失敗:', error);
      console.error('[GameBoard] 錯誤訊息:', error.message);
      setMessage('抽牌失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Add action to log (synced to Firebase)
  const addActionLog = async (action) => {
    try {
      const timestamp = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newAction = { ...action, timestamp, id: Date.now() };

      // Update gameState with new action log
      const updatedGameState = {
        ...gameState,
        actionLog: [newAction, ...(gameState.actionLog || [])].slice(0, 50) // Keep last 50 actions
      };

      // Sync to Firebase
      await syncCompleteGameState(roomCode, updatedGameState);

      // Update local state (will also be updated by Firebase subscription)
      setGameState(updatedGameState);
    } catch (error) {
      console.error('[GameBoard] Failed to add action log:', error);
    }
  };

  // Handle drag start (for drawn cards)
  const handleDragStart = (e, cardIndex) => {
    setDraggedCardIndex(cardIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle hand card drag start
  const handleHandCardDragStart = (e, cardIndex) => {
    setDraggedHandCardIndex(cardIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle hand card drag over
  const handleHandCardDragOver = (e, targetIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverHandIndex(targetIndex);
  };

  // Handle hand card drop
  const handleHandCardDrop = async (e, targetIndex) => {
    e.preventDefault();
    setDragOverHandIndex(null);

    if (draggedHandCardIndex === null || draggedHandCardIndex === targetIndex) {
      setDraggedHandCardIndex(null);
      return;
    }

    try {
      // Reorder hand cards
      const newHand = [...myHand];
      const [draggedCard] = newHand.splice(draggedHandCardIndex, 1);
      newHand.splice(targetIndex, 0, draggedCard);

      // Update gameState
      const updatedPlayers = [...gameState.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        hand: newHand
      };

      const updatedGameState = {
        ...gameState,
        players: updatedPlayers
      };

      // Sync to Firebase
      await syncCompleteGameState(roomCode, updatedGameState);
      setGameState(updatedGameState);
    } catch (error) {
      console.error('[GameBoard] Failed to reorder hand:', error);
    } finally {
      setDraggedHandCardIndex(null);
    }
  };

  // Handle hand card drag leave
  const handleHandCardDragLeave = () => {
    setDragOverHandIndex(null);
  };

  // Handle resize start
  const handleResizeStart = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: handPanelSize.width, height: handPanelSize.height });
  };

  // Handle card hover
  const handleCardHover = (card, e) => {
    console.log('[GameBoard] Card hover started:', card.name);

    // Update mouse position
    setMousePosition({ x: e.clientX, y: e.clientY });

    if (hoverTimer) {
      console.log('[GameBoard] Clearing previous timer');
      clearTimeout(hoverTimer);
    }

    const timer = setTimeout(() => {
      console.log('[GameBoard] 2 seconds passed, showing tooltip for:', card.name);
      setHoveredCard(card);
    }, 2000);

    setHoverTimer(timer);
  };

  const handleCardMouseMove = (e) => {
    if (hoveredCard) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCardLeave = () => {
    console.log('[GameBoard] Card hover ended');
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }
    setHoveredCard(null);
  };

  // Handle drag over discard pile
  const handleDragOver = (e, pileIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPile(pileIndex);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverPile(null);
  };

  // Handle drop on discard pile
  const handleDrop = (e, pileIndex) => {
    e.preventDefault();
    setDragOverPile(null);

    if (draggedCardIndex !== null) {
      handleConfirmDrawSelection(draggedCardIndex, pileIndex);
    }
  };

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
    console.log('[GameBoard.handleTakeFromDiscard] ========== 從棄牌堆拿牌 ==========');
    console.log('[GameBoard] pileIndex:', pileIndex);
    
    if (!isCurrentPlayer) {
      console.log('[GameBoard] ✗ 不是當前玩家的回合');
      setMessage('不是你的回合!');
      return;
    }

    if (gameState.hasDrawnThisTurn) {
      console.log('[GameBoard] ✗ 這回合已經抽過牌');
      setMessage('你這回合已經抽過牌了!');
      return;
    }

    try {
      setLoading(true);
      console.log('[GameBoard] 呼叫 takeFromDiscardPile...');
      const result = takeFromDiscardPile(gameState, pileIndex);
      if (!result) {
        console.log('[GameBoard] ✗ 棄牌堆是空的');
        setMessage('棄牌堆空了!');
        return;
      }
      console.log('[GameBoard] ✓ 成功從棄牌堆拿牌');
      console.log('[GameBoard] 拿到的牌:', result.takenCard);
      
      // Change phase to 'playing' after taking from discard
      result.updatedGameState.gamePhase = 'playing';
      
      // Sync to Firebase before updating local state
      console.log('[GameBoard] 同步狀態到 Firebase...');
      console.log('[GameBoard] result.updatedGameState.hasDrawnThisTurn:', result.updatedGameState.hasDrawnThisTurn);
      await syncCompleteGameState(roomCode, result.updatedGameState);
      console.log('[GameBoard] ✓ 狀態已同步');

      // Force update gameState immediately
      console.log('[GameBoard] 強制更新本地 gameState...');
      setGameState({...result.updatedGameState});
      setMessage(`拿到${result.takenCard.name}`);
      setSelectedCardIndices([]);

      // Add to action log
      addActionLog({
        player: myPlayer.name,
        action: `從棄牌堆拿取 ${result.takenCard.name}`,
        icon: '♻️'
      });

      console.log('[GameBoard] ✓ 完成從棄牌堆拿牌');
    } catch (error) {
      console.error('[GameBoard] ✗ 操作失敗:', error);
      console.error('[GameBoard] 錯誤訊息:', error.message);
      setMessage('操作失敗');
    } finally {
      setLoading(false);
    }
  };

  // Handle pair effect
  const handlePlayPair = async () => {
    if (!isCurrentPlayer) {
      setMessage('不是你的回合!');
      return;
    }

    if (selectedCardIndices.length !== 2) {
      setMessage('請選擇 2 張卡牌');
      return;
    }

    // Check if valid pair
    const card1 = myHand[selectedCardIndices[0]];
    const card2 = myHand[selectedCardIndices[1]];

    // Debug: Log card details
    console.log('[GameBoard.handlePlayPair] ========== 配對驗證 ==========');
    console.log('[GameBoard.handlePlayPair] Card1:', {
      id: card1.id,
      name: card1.name,
      type: card1.type,
      pairEffect: card1.pairEffect
    });
    console.log('[GameBoard.handlePlayPair] Card2:', {
      id: card2.id,
      name: card2.name,
      type: card2.type,
      pairEffect: card2.pairEffect
    });
    console.log('[GameBoard.handlePlayPair] Card1.id === Card2.id:', card1.id === card2.id);
    console.log('[GameBoard.handlePlayPair] Card1.type:', card1.type);
    console.log('[GameBoard.handlePlayPair] Expected type for pair:', 'pairEffect');
    console.log('[GameBoard.handlePlayPair] validPairs:', validPairs);
    console.log('[GameBoard.handlePlayPair] Direct isValidPair check:', isValidPair(card1, card2));

    const isValid = validPairs.some(
      pair => (pair.index1 === selectedCardIndices[0] && pair.index2 === selectedCardIndices[1]) ||
               (pair.index1 === selectedCardIndices[1] && pair.index2 === selectedCardIndices[0])
    );

    if (!isValid) {
      // Show more detailed error message
      const pairCheckResult = isValidPair(card1, card2);
      console.error('[GameBoard] Pair validation failed. Direct check result:', pairCheckResult);
      setMessage(`這不是有效的配對! (${card1.name} + ${card2.name})`);
      return;
    }

    try {
      setLoading(true);

      // Play the pair
      const result = playPair(gameState, selectedCardIndices);
      const { updatedGameState, playedPair, effect } = result;

      // Sync to Firebase
      await syncCompleteGameState(roomCode, updatedGameState);
      setGameState(updatedGameState);
      setSelectedCardIndices([]);

      // Add to action log
      await addActionLog({
        player: myPlayer.name,
        action: `打出配對 ${playedPair[0].name} + ${playedPair[1].name}`,
        icon: '⚡'
      });

      // Handle different effects
      if (effect === 'blindDraw') {
        // Blind draw from deck
        if (updatedGameState.deck.length > 0) {
          const drawnCard = updatedGameState.deck.pop();
          updatedGameState.players[playerIndex].hand.push(drawnCard);
          await syncCompleteGameState(roomCode, updatedGameState);
          setGameState(updatedGameState);
          setMessage(`配對成功！盲抽獲得 ${drawnCard.name}`);
          await addActionLog({
            player: myPlayer.name,
            action: `盲抽獲得 ${drawnCard.name}`,
            icon: '🎲'
          });
        } else {
          setMessage('配對成功！但牌堆已空');
        }
      } else if (effect === 'pickDiscard') {
        setMessage('配對成功！請從棄牌堆選擇一張牌');
        // User needs to click on a discard pile to take a card
      } else if (effect === 'extraTurn') {
        setMessage('配對成功！你可以再進行一個回合！');
        await addActionLog({
          player: myPlayer.name,
          action: '獲得額外回合',
          icon: '🔄'
        });
      } else if (effect === 'steal') {
        // Steal random card from opponent
        const opponents = updatedGameState.players.filter((_, idx) => idx !== playerIndex && updatedGameState.players[idx].hand.length > 0);
        if (opponents.length > 0) {
          const targetOpponent = opponents[Math.floor(Math.random() * opponents.length)];
          const targetOpponentIndex = updatedGameState.players.indexOf(targetOpponent);
          const stolenCardIndex = Math.floor(Math.random() * targetOpponent.hand.length);
          const stolenCard = targetOpponent.hand.splice(stolenCardIndex, 1)[0];
          updatedGameState.players[playerIndex].hand.push(stolenCard);
          await syncCompleteGameState(roomCode, updatedGameState);
          setGameState(updatedGameState);
          setMessage(`配對成功！從 ${targetOpponent.name} 偷取了 ${stolenCard.name}`);
          await addActionLog({
            player: myPlayer.name,
            action: `從 ${targetOpponent.name} 偷取 ${stolenCard.name}`,
            icon: '🦈'
          });
        } else {
          setMessage('配對成功！但沒有對手有手牌可偷');
        }
      } else {
        setMessage(`配對成功！${playedPair[0].name} + ${playedPair[1].name}`);
      }

    } catch (error) {
      console.error('[GameBoard] ✗ 打出配對失敗:', error);
      setMessage('打出配對失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle end turn
  const handleEndTurn = async () => {
    console.log('[GameBoard.handleEndTurn] ========== 結束回合 ==========');
    console.log('[GameBoard] 當前玩家:', currentPlayer.name);
    console.log('[GameBoard] 當前玩家索引:', gameState.currentPlayerIndex);

    if (!isCurrentPlayer) {
      console.log('[GameBoard] ✗ 不是當前玩家');
      return;
    }

    // Check if player has drawn a card this turn
    if (!gameState.hasDrawnThisTurn) {
      console.log('[GameBoard] ✗ 尚未抽牌');
      setMessage('你必須先抽牌或從棄牌堆拿牌!');
      return;
    }

    try {
      setLoading(true);
      console.log('[GameBoard] 呼叫 nextTurn...');
      const newGameState = nextTurn(gameState);
      console.log('[GameBoard] ✓ 回合切換完成');
      console.log('[GameBoard] 新的當前玩家索引:', newGameState.currentPlayerIndex);
      console.log('[GameBoard] 新的當前玩家:', newGameState.players[newGameState.currentPlayerIndex]?.name);

      // Sync to Firebase before updating local state
      console.log('[GameBoard] 同步狀態到 Firebase...');
      await syncCompleteGameState(roomCode, newGameState);
      console.log('[GameBoard] ✓ 狀態已同步');

      setGameState(newGameState);
      setSelectedCardIndices([]);
      setMessage('');

      // Add to action log
      addActionLog({
        player: myPlayer.name,
        action: '結束回合',
        icon: '⏭️'
      });

      console.log('[GameBoard] ✓ 結束回合完成');
    } catch (error) {
      console.error('[GameBoard] ✗ 結束回合失敗:', error);
      console.error('[GameBoard] 錯誤訊息:', error.message);
      setMessage('結束回合失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
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

  // Render card component
  const renderCard = (card, enableHover = false, size = 'normal') => {
    if (!card) {
      return (
        <div className="card empty">
          <div className="empty-card">🎴</div>
        </div>
      );
    }

    // Mini version for played pairs
    if (size === 'mini') {
      return (
        <div className={`card card-mini card-color-${card.color}`}>
          <div className="card-name-mini">{card.name}</div>
        </div>
      );
    }

    return (
      <div
        className={`card card-color-${card.color}`}
        onMouseEnter={enableHover ? () => handleCardHover(card) : null}
        onMouseLeave={enableHover ? handleCardLeave : null}
      >
        <div className="card-header">
          <div className="card-name">{card.name}</div>
          <div className="card-value">{card.value}分</div>
        </div>
        <div className="card-body">
          <div className="card-emoji">{card.emoji || '🎴'}</div>
        </div>
        {card.pairEffect && (
          <div className="card-effect">{card.pairEffect}</div>
        )}
      </div>
    );
  };

  return (
    <div className="game-board">
      {/* Header */}
      <div className="game-header">
        <div className="header-info">
          <h1 className="room-code">房間 {roomCode}</h1>
          <div className="header-details">
            <p>回合 {gameState.roundNumber + 1}</p>
            <p>當前玩家: {currentPlayer.name}</p>
          </div>
        </div>
        <button className="back-btn" onClick={onBack}>
          ← 離開
        </button>
      </div>

      {/* Message Toast */}
      {message && (
        <div className="game-message">
          <p>{message}</p>
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {/* Game Layout */}
      <div className="game-layout-wrapper">
        {/* Main Game Area */}
        <div className="game-layout">
        {/* Opponents Area (Top) */}
        <div className="opponents-area">
          {gameState.players.map((player, idx) => (
            <div
              key={idx}
              className={`opponent-card ${
                idx === gameState.currentPlayerIndex ? 'current-turn' : ''
              } ${idx === playerIndex ? 'is-me' : ''}`}
            >
              <div className="player-avatar">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="player-info-detail">
                <div className="player-name">
                  {player.name}
                  {idx === playerIndex && ' (你)'}
                </div>
                <div className="player-stats">
                  <span className="stat-badge">
                    🎴 <span className="stat-value">{player.hand?.length || 0}</span>
                  </span>
                  <span className="stat-badge">
                    ⭐ <span className="stat-value">{player.score}</span>/{targetScore}
                  </span>
                  <span className="stat-badge">
                    ⚡ <span className="stat-value">{player.playedPairs?.length || 0}</span> 對
                  </span>
                </div>
                {/* Played Pairs Display */}
                {player.playedPairs && player.playedPairs.length > 0 && (
                  <div className="played-pairs-mini">
                    {player.playedPairs.map((pair, pairIdx) => (
                      <div key={pairIdx} className="pair-mini">
                        <span className="pair-card-mini">{pair[0].name}</span>
                        <span className="pair-card-mini">{pair[1].name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Table Area (Middle) */}
        <div className="table-area">
          {/* Left Discard Pile */}
          <div
            className="discard-left"
            onDragOver={drawnCards ? (e) => handleDragOver(e, 0) : null}
            onDragLeave={drawnCards ? handleDragLeave : null}
            onDrop={drawnCards ? (e) => handleDrop(e, 0) : null}
          >
            <div className={`discard-pile ${dragOverPile === 0 ? 'drag-over' : ''}`}>
              <h3 className="discard-title">
                棄牌堆 1
                <span className="pile-count">({gameState.discardPile1?.length || 0}張)</span>
              </h3>
              <div
                className="clickable"
                onClick={isCurrentPlayer && !gameState.hasDrawnThisTurn && !drawnCards ? () => handleTakeFromDiscard(0) : null}
              >
                {renderCard(topDiscardPile1, true)}
              </div>
            </div>
          </div>

          {/* Center Deck Area */}
          <div className="deck-area">
            {drawnCards ? (
              <div className="drawn-cards-area">
                <h3 className="drawn-cards-title">抽到的牌 - 拖曳一張到棄牌堆</h3>
                <div className="drawn-cards-container">
                  {drawnCards.map((card, index) => (
                    <div
                      key={index}
                      className={`drawn-card ${draggedCardIndex === index ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                    >
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
                <button
                  className="btn-cancel-draw"
                  onClick={async () => {
                    // Clear drawing state in Firebase
                    try {
                      const updatedGameState = {
                        ...gameState,
                        drawingState: null
                      };
                      await syncCompleteGameState(roomCode, updatedGameState);
                    } catch (error) {
                      console.error('[GameBoard] Failed to clear drawing state:', error);
                    }

                    setDrawnCards(null);
                    setDraggedCardIndex(null);
                    setDragOverPile(null);
                    setMessage('');
                  }}
                >
                  取消
                </button>
              </div>
            ) : gameState.drawingState && gameState.drawingState.playerId !== playerId ? (
              // Other player is drawing - show card backs
              <div className="other-player-drawing">
                <h3 className="drawing-title">
                  {gameState.drawingState.playerName} 正在二選一
                </h3>
                <div className="card-backs-container">
                  <div className="card-back">
                    <div className="card-back-content">🎴</div>
                  </div>
                  <div className="card-back">
                    <div className="card-back-content">🎴</div>
                  </div>
                </div>
                <p className="drawing-hint">等待玩家選擇...</p>
              </div>
            ) : (
              <>
                <div className="deck-info">
                  <h3>牌堆</h3>
                  <p className="deck-count">{gameState.deck.length} 張</p>
                </div>
                <div className="deck-actions">
                  <button
                    className="draw-btn"
                    onClick={handleInitiateDraw}
                    disabled={!isCurrentPlayer || gameState.hasDrawnThisTurn || loading}
                  >
                    <span className="btn-icon">🎴</span>
                    <span>抽牌</span>
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowDeclarationModal(true)}
                    disabled={!isCurrentPlayer || !canDeclareSelf}
                  >
                    📋 宣告結束
                    {canDeclareSelf && <span className="can-declare-badge">✓</span>}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowDeckViewer(true)}
                  >
                    👁️ 查看牌堆
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Discard Pile */}
          <div
            className="discard-right"
            onDragOver={drawnCards ? (e) => handleDragOver(e, 1) : null}
            onDragLeave={drawnCards ? handleDragLeave : null}
            onDrop={drawnCards ? (e) => handleDrop(e, 1) : null}
          >
            <div className={`discard-pile ${dragOverPile === 1 ? 'drag-over' : ''}`}>
              <h3 className="discard-title">
                棄牌堆 2
                <span className="pile-count">({gameState.discardPile2?.length || 0}張)</span>
              </h3>
              <div
                className="clickable"
                onClick={isCurrentPlayer && !gameState.hasDrawnThisTurn && !drawnCards ? () => handleTakeFromDiscard(1) : null}
              >
                {renderCard(topDiscardPile2, true)}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* My Area (Hand Panel at Bottom) */}
          <div
            className={`my-area ${isResizing ? 'resizing' : ''}`}
            style={{
              width: `${handPanelSize.width}px`,
              height: `${handPanelSize.height}px`,
            }}
          >
          <div className="my-area-header">
            <h3 className="hand-title">
              🎴 我的手牌
              {isCurrentPlayer && <span className="your-turn-indicator">你的回合</span>}
            </h3>
            <div className="hand-controls">
              <div className="hand-stats">
                <div className="stat-item">
                  <span className="stat-label">手牌數:</span>
                  <span className="stat-value-highlight">{myHand.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">總分:</span>
                  <span
                    className="stat-value-highlight clickable-score"
                    onClick={() => setShowScoreDetail(true)}
                    title="點擊查看分數來源"
                  >
                    {myScore.total}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">已打出:</span>
                  <span className="stat-value-highlight">{myPlayer.playedPairs?.length || 0} 對</span>
                </div>
              </div>
            </div>
          </div>

          {/* Played Pairs Display */}
          {myPlayer.playedPairs && myPlayer.playedPairs.length > 0 && (
            <div className="my-played-pairs">
              <div className="played-pairs-title">⚡ 已打出的配對:</div>
              <div className="played-pairs-list">
                {myPlayer.playedPairs.map((pair, pairIdx) => (
                  <div key={pairIdx} className="played-pair-item">
                    <div className="pair-cards">
                      {renderCard(pair[0], false, 'mini')}
                      <span className="pair-separator">+</span>
                      {renderCard(pair[1], false, 'mini')}
                    </div>
                    <div className="pair-effect-label">
                      {pair[0].pairEffect === 'blindDraw' && '盲抽'}
                      {pair[0].pairEffect === 'pickDiscard' && '選牌'}
                      {pair[0].pairEffect === 'extraTurn' && '額外回合'}
                      {pair[0].pairEffect === 'steal' && '偷牌'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hand-container">
            {myHand.length === 0 ? (
              <div className="empty-hand">你還沒有任何手牌</div>
            ) : (
              myHand.map((card, index) => {
                const isSelected = selectedCardIndices.includes(index);
                const canPair = validPairs.some(
                  pair => pair.index1 === index || pair.index2 === index
                );

                return (
                  <div
                    key={index}
                    className={`card-in-hand ${isCurrentPlayer ? 'clickable' : ''} ${
                      isSelected ? 'selected' : ''
                    } ${canPair ? 'can-pair' : ''} ${
                      draggedHandCardIndex === index ? 'dragging-hand' : ''
                    } ${dragOverHandIndex === index ? 'drag-over-hand' : ''}`}
                    draggable
                    onClick={() => handleCardClick(index)}
                    onMouseEnter={(e) => handleCardHover(card, e)}
                    onMouseMove={handleCardMouseMove}
                    onMouseLeave={handleCardLeave}
                    onDragStart={(e) => handleHandCardDragStart(e, index)}
                    onDragOver={(e) => handleHandCardDragOver(e, index)}
                    onDrop={(e) => handleHandCardDrop(e, index)}
                    onDragLeave={handleHandCardDragLeave}
                  >
                    {renderCard(card)}
                  </div>
                );
              })
            )}
          </div>

          {isCurrentPlayer && (
            <div className="action-buttons">
              <button
                className="action-btn action-btn-play-pair"
                onClick={handlePlayPair}
                disabled={selectedCardIndices.length !== 2 || loading}
              >
                ⚡ 打出配對牌
              </button>
              <button
                className="action-btn action-btn-end-turn"
                onClick={handleEndTurn}
                disabled={!gameState.hasDrawnThisTurn || loading}
                title={!gameState.hasDrawnThisTurn ? '請先抽牌或從棄牌堆拿牌' : '點擊結束回合'}
                style={{
                  opacity: gameState.hasDrawnThisTurn ? 1 : 0.5,
                  cursor: gameState.hasDrawnThisTurn ? 'pointer' : 'not-allowed'
                }}
              >
                ✓ 結束回合 {gameState.hasDrawnThisTurn ? '(可用)' : '(需先抽牌)'}
              </button>
              {/* Debug info */}
              <div style={{
                fontSize: '10px',
                color: '#888',
                marginTop: '4px',
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '4px'
              }}>
                Debug: hasDrawnThisTurn = {String(gameState.hasDrawnThisTurn)}
              </div>
            </div>
          )}

          {/* Resize Handle */}
          <div
            className="resize-handle"
            onMouseDown={handleResizeStart}
            title="拖拽調整大小"
          >
            ⋰
          </div>
        </div>
      </div>

      {/* Card Tooltip - Simple One-Line Display */}
      {hoveredCard && (
        <div
          className="card-tooltip-simple"
          style={{
            left: `${mousePosition.x + 15}px`,
            top: `${mousePosition.y + 15}px`,
          }}
        >
          {hoveredCard.pairEffect && (
            <>
              {hoveredCard.pairEffect === 'blindDraw' && '配對效果: 盲抽牌庫頂1張牌'}
              {hoveredCard.pairEffect === 'pickDiscard' && '配對效果: 從棄牌堆選擇任意1張牌'}
              {hoveredCard.pairEffect === 'extraTurn' && '配對效果: 立即再進行一個回合'}
              {hoveredCard.pairEffect === 'steal' && '配對效果: 隨機偷取對手1張手牌'}
            </>
          )}
          {!hoveredCard.pairEffect && hoveredCard.description && hoveredCard.description}
          {!hoveredCard.pairEffect && !hoveredCard.description && `${hoveredCard.name} - ${hoveredCard.value}分`}
        </div>
      )}

      {/* Modals */}
      {showDeclarationModal && (
        <DeclarationModal
          canDeclare={canDeclareSelf}
          onImmediate={() => handleDeclare('immediate')}
          onLastChance={() => handleDeclare('lastChance')}
          onCancel={() => setShowDeclarationModal(false)}
          playerName={currentPlayer.name}
          playerScore={myScore.total}
        />
      )}

      {showDeckViewer && (
        <DeckViewer
          gameState={gameState}
          onClose={() => setShowDeckViewer(false)}
        />
      )}

      {/* Score Detail Modal */}
      {showScoreDetail && (
        <div className="modal-overlay" onClick={() => setShowScoreDetail(false)}>
          <div className="score-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💰 分數來源詳情</h2>
              <button className="close-btn" onClick={() => setShowScoreDetail(false)}>✕</button>
            </div>
            <div className="score-detail-content">
              {/* Cards List */}
              <div className="score-section">
                <h3>📋 手牌明細 ({myHand.length} 張)</h3>
                <div className="cards-list-detail">
                  {myHand.map((card, idx) => (
                    <div key={idx} className="card-detail-item">
                      <span className={`card-name-badge card-color-${card.color}`}>
                        {card.name}
                      </span>
                      <span className="card-points">{card.value} 分</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="score-section">
                <h3>🧮 分數計算</h3>
                <div className="score-breakdown">
                  <div className="score-row">
                    <span>基礎分數 (所有手牌分數總和):</span>
                    <span className="score-value">{myScore.breakdown?.baseScore || 0} 分</span>
                  </div>

                  {myScore.breakdown?.multiplierBonus > 0 && (
                    <div className="score-row score-highlight">
                      <div className="score-row-detail">
                        <span>倍增牌加成:</span>
                        <span className="score-hint">
                          {myHand.filter(c => c.type === 'multiplier').map(m =>
                            `${m.name}: ${myScore.breakdown?.cardCounts[m.multiplierFor] || 0}張${m.multiplierFor === 'shell' ? '×2' : '×1'}`
                          ).join(', ')}
                        </span>
                      </div>
                      <span className="score-value">+{myScore.breakdown?.multiplierBonus} 分</span>
                    </div>
                  )}

                  {myScore.breakdown?.mermaidScore > 0 && (
                    <div className="score-row score-highlight">
                      <div className="score-row-detail">
                        <span>美人魚分數:</span>
                        <span className="score-hint">
                          {myScore.breakdown?.mermaidCount}張美人魚，每張得分等於第N多顏色的張數
                        </span>
                      </div>
                      <span className="score-value">+{myScore.breakdown?.mermaidScore} 分</span>
                    </div>
                  )}

                  {myScore.breakdown?.colorBonus > 0 && (
                    <div className="score-row score-highlight">
                      <div className="score-row-detail">
                        <span>同色加成 (最多顏色的張數):</span>
                        <span className="score-hint">
                          {Object.entries(myScore.breakdown?.colorCounts || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 1)
                            .map(([color, count]) => {
                              const colorNames = {
                                blue: '藍', red: '紅', green: '綠', yellow: '黃',
                                orange: '橘', purple: '紫', pink: '粉', cyan: '青', gray: '灰'
                              };
                              return `${colorNames[color] || color}色 ${count}張`;
                            })
                            .join(', ')}
                        </span>
                      </div>
                      <span className="score-value">+{myScore.breakdown?.colorBonus} 分</span>
                    </div>
                  )}

                  {myPlayer.playedPairs && myPlayer.playedPairs.length > 0 && (
                    <div className="score-row">
                      <span>已打出配對:</span>
                      <span className="score-value">+{myPlayer.playedPairs.length} 分</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Distribution */}
              {myScore.breakdown?.colorCounts && Object.keys(myScore.breakdown.colorCounts).length > 0 && (
                <div className="score-section">
                  <h3>🎨 顏色分布</h3>
                  <div className="color-distribution">
                    {Object.entries(myScore.breakdown.colorCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([color, count]) => {
                        const colorNames = {
                          blue: '藍色', red: '紅色', green: '綠色', yellow: '黃色',
                          orange: '橘色', purple: '紫色', pink: '粉色', cyan: '青色', gray: '灰色'
                        };
                        return (
                          <div key={color} className="color-stat">
                            <span className={`color-badge color-${color}`}>
                              {colorNames[color] || color}
                            </span>
                            <span className="color-count">{count} 張</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="score-total-section">
                <div className="score-total-row">
                  <span>總分:</span>
                  <span className="total-score">{myScore.total} 分</span>
                </div>
                <div className="score-formula">
                  = 基礎分數 {myScore.breakdown?.baseScore || 0}
                  {myScore.breakdown?.multiplierBonus > 0 && ` + 倍增 ${myScore.breakdown.multiplierBonus}`}
                  {myScore.breakdown?.mermaidScore > 0 && ` + 美人魚 ${myScore.breakdown.mermaidScore}`}
                  {myScore.breakdown?.colorBonus > 0 && ` + 同色 ${myScore.breakdown.colorBonus}`}
                  {myPlayer.playedPairs?.length > 0 && ` + 配對 ${myPlayer.playedPairs.length}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Log Panel */}
      <GameActionLog gameState={gameState} players={gameState.players} />
    </div>
  );
}