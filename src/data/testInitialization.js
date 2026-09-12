// Test file to verify game initialization
// 測試文件:驗證遊戲初始化

import { initializeGameDeck } from './cards.js';
import { initializeRound } from './gameRules.js';

/**
 * Test game initialization to ensure discard piles start with 2 cards
 * 測試遊戲初始化,確保棄牌堆一開始有兩張牌
 */
export function testGameInitialization() {
  console.log('=== 測試遊戲初始化 ===\n');

  // Create test players
  const testPlayers = [
    { id: 'player1', name: '玩家 1' },
    { id: 'player2', name: '玩家 2' },
  ];

  // Initialize deck WITHOUT shuffle to see the order
  const deck = initializeGameDeck(false); // false = don't shuffle
  console.log(`1. 初始牌堆總數: ${deck.length} 張\n`);

  // Show last 5 cards (next to be drawn)
  console.log('2. 牌堆頂端的 5 張牌 (即將被抽到):');
  deck.slice(-5).reverse().forEach((card, index) => {
    console.log(`   第 ${index + 1} 張: ${card.name} (${card.color}) - ${card.value}分`);
  });
  console.log('');

  // Initialize game round
  const gameState = initializeRound(testPlayers, deck);

  // Check discard piles
  console.log('3. 遊戲初始化後:');
  console.log(`   剩餘牌堆: ${gameState.deck.length} 張`);
  console.log(`   左棄牌堆: ${gameState.discardPile1.length} 張`);
  console.log(`   右棄牌堆: ${gameState.discardPile2.length} 張\n`);

  // Show discard pile cards
  if (gameState.discardPile1.length > 0) {
    const card = gameState.discardPile1[0];
    console.log(`   左棄牌堆的牌: ${card.name} (${card.color}) - ${card.value}分`);
  }

  if (gameState.discardPile2.length > 0) {
    const card = gameState.discardPile2[0];
    console.log(`   右棄牌堆的牌: ${card.name} (${card.color}) - ${card.value}分`);
  }
  console.log('');

  // Verify total
  const total = gameState.deck.length + gameState.discardPile1.length + gameState.discardPile2.length;
  console.log(`4. 驗證總牌數: ${total} 張 (應該是 72 張)`);
  
  // Verify discard piles
  const hasCorrectDiscardPiles = 
    gameState.discardPile1.length === 1 && 
    gameState.discardPile2.length === 1;
  
  console.log(`5. 棄牌堆驗證: ${hasCorrectDiscardPiles ? '✓ 通過' : '✗ 失敗'}`);
  console.log(`   每個棄牌堆都應該有 1 張牌\n`);

  // Show player hands
  console.log('6. 玩家初始手牌:');
  gameState.players.forEach((player, index) => {
    console.log(`   ${player.name}: ${player.hand.length} 張 (應該是 0 張)`);
  });
  console.log('');

  // Show next cards that will be drawn
  console.log('7. 接下來會抽到的 3 張牌:');
  gameState.deck.slice(-3).reverse().forEach((card, index) => {
    console.log(`   第 ${index + 1} 張: ${card.name} (${card.color}) - ${card.value}分`);
  });
  console.log('');

  // Return test result
  const allTestsPassed = 
    total === 72 && 
    hasCorrectDiscardPiles && 
    gameState.players.every(p => p.hand.length === 0);

  console.log(`=== 測試結果: ${allTestsPassed ? '✓ 全部通過' : '✗ 有測試失敗'} ===\n`);

  return {
    passed: allTestsPassed,
    gameState,
    details: {
      totalCards: total,
      deckSize: gameState.deck.length,
      discardPile1Size: gameState.discardPile1.length,
      discardPile2Size: gameState.discardPile2.length,
      playersHandSize: gameState.players.map(p => p.hand.length),
    },
  };
}

/**
 * Run the test
 * 執行測試
 */
if (typeof window === 'undefined') {
  // Node.js environment
  testGameInitialization();
}
