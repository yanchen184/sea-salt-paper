/**
 * Automated game flow test script
 * Tests: Create room -> Add players -> Start game -> Player 1 draws -> Player 2 draws
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAu15y29vSK9lrncr5gyBK_sqWrU1KT1qg",
  authDomain: "sea-salt-5fb51.firebaseapp.com",
  projectId: "sea-salt-5fb51",
  storageBucket: "sea-salt-5fb51.firebasestorage.app",
  messagingSenderId: "674858991429",
  appId: "1:674858991429:web:942d28f809bf84e82e482c",
  databaseURL: "https://sea-salt-5fb51.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Utility functions
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Wait utility
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test game flow
async function testGameFlow() {
  console.log('\n🎮 ========== GAME FLOW TEST STARTED ==========\n');

  try {
    // Step 1: Create room
    console.log('📝 STEP 1: Creating room...');
    const roomCode = generateRoomCode();
    const player1Id = generatePlayerId();
    const player1Name = 'TestPlayer1';

    const roomData = {
      roomCode,
      createdBy: player1Id,
      createdAt: new Date().toISOString(),
      status: 'waiting',
      settings: {
        maxPlayers: 4,
        targetScore: 'auto',
        startingHandSize: 0,
        mermaidsWin: true,
        colorBonus: true,
        aiPlayers: []
      }
    };

    await setDoc(doc(db, 'rooms', roomCode), roomData);
    console.log('✅ Room created:', roomCode);

    // Add player 1
    const player1Data = {
      id: player1Id,
      name: player1Name,
      joinedAt: new Date().toISOString(),
      status: 'ready',
      isAI: false
    };
    await setDoc(doc(db, 'rooms', roomCode, 'players', player1Id), player1Data);
    console.log('✅ Player 1 added:', player1Name);

    await wait(500);

    // Step 2: Add player 2
    console.log('\n📝 STEP 2: Adding second player...');
    const player2Id = generatePlayerId();
    const player2Name = 'TestPlayer2';

    const player2Data = {
      id: player2Id,
      name: player2Name,
      joinedAt: new Date().toISOString(),
      status: 'ready',
      isAI: false
    };
    await setDoc(doc(db, 'rooms', roomCode, 'players', player2Id), player2Data);
    console.log('✅ Player 2 added:', player2Name);

    await wait(500);

    // Step 3: Initialize game deck and state
    console.log('\n📝 STEP 3: Starting game...');

    // Import card data to create deck
    const cardsModule = await import('./src/data/cards.js');
    const { initializeGameDeck } = cardsModule;
    const deck = initializeGameDeck();

    console.log('✅ Game deck created:', deck.length, 'cards');

    // Initialize game state
    const gameState = {
      status: 'playing',
      currentPlayerIndex: 0,
      players: [
        {
          id: player1Id,
          name: player1Name,
          hand: [],
          playedPairs: [],
          score: 0,
          totalScore: 0,
          hasDeclared: false,
          isAI: false
        },
        {
          id: player2Id,
          name: player2Name,
          hand: [],
          playedPairs: [],
          score: 0,
          totalScore: 0,
          hasDeclared: false,
          isAI: false
        }
      ],
      deck: deck.slice(2), // Remove first 2 cards for discard piles
      discardLeft: [deck[0]],
      discardRight: [deck[1]],
      round: 1,
      turnCount: 0,
      actionLog: [
        {
          timestamp: new Date().toISOString(),
          message: `🎮 Game started! ${player1Name} goes first.`
        }
      ],
      lastAction: null,
      settings: roomData.settings
    };

    // Save game state to Firebase
    await setDoc(doc(db, 'rooms', roomCode, 'game', 'state'), gameState);
    await updateDoc(doc(db, 'rooms', roomCode), { status: 'playing' });

    console.log('✅ Game started!');
    console.log('   Current player:', player1Name);
    console.log('   Deck size:', gameState.deck.length);
    console.log('   Discard Left:', gameState.discardLeft[0].name);
    console.log('   Discard Right:', gameState.discardRight[0].name);

    await wait(1000);

    // Step 4: Player 1 draws cards
    console.log('\n📝 STEP 4: Player 1 drawing cards...');

    const drawnCards = [
      gameState.deck[0],
      gameState.deck[1]
    ];

    console.log('🎴 Drawn cards:');
    console.log('   Card 1:', drawnCards[0].name, `(${drawnCards[0].value} pts)`);
    console.log('   Card 2:', drawnCards[1].name, `(${drawnCards[1].value} pts)`);

    // Player 1 keeps first card, discards second
    const keptCard = drawnCards[0];
    const discardedCard = drawnCards[1];

    const updatedGameState = {
      ...gameState,
      players: [
        {
          ...gameState.players[0],
          hand: [keptCard]
        },
        gameState.players[1]
      ],
      deck: gameState.deck.slice(2),
      discardLeft: [...gameState.discardLeft, discardedCard],
      turnCount: 1,
      actionLog: [
        ...gameState.actionLog,
        {
          timestamp: new Date().toISOString(),
          message: `${player1Name} drew 2 cards, kept ${keptCard.name}, discarded ${discardedCard.name}`
        }
      ],
      lastAction: {
        type: 'draw',
        playerId: player1Id,
        playerName: player1Name,
        cards: drawnCards,
        kept: keptCard,
        discarded: discardedCard
      }
    };

    await updateDoc(doc(db, 'rooms', roomCode, 'game', 'state'), updatedGameState);

    console.log('✅ Player 1 drew cards!');
    console.log('   Kept:', keptCard.name);
    console.log('   Discarded:', discardedCard.name);
    console.log('   Hand size:', updatedGameState.players[0].hand.length);

    await wait(1000);

    // Step 5: Switch to Player 2
    console.log('\n📝 STEP 5: Switching to Player 2...');

    const nextTurnState = {
      ...updatedGameState,
      currentPlayerIndex: 1,
      actionLog: [
        ...updatedGameState.actionLog,
        {
          timestamp: new Date().toISOString(),
          message: `⏭️ Turn switched to ${player2Name}`
        }
      ]
    };

    await updateDoc(doc(db, 'rooms', roomCode, 'game', 'state'), nextTurnState);

    console.log('✅ Turn switched to Player 2!');
    console.log('   Current player:', player2Name);
    console.log('   Current player index:', nextTurnState.currentPlayerIndex);

    await wait(1000);

    // Step 6: Player 2 draws cards
    console.log('\n📝 STEP 6: Player 2 drawing cards...');

    const player2DrawnCards = [
      nextTurnState.deck[0],
      nextTurnState.deck[1]
    ];

    console.log('🎴 Drawn cards:');
    console.log('   Card 1:', player2DrawnCards[0].name, `(${player2DrawnCards[0].value} pts)`);
    console.log('   Card 2:', player2DrawnCards[1].name, `(${player2DrawnCards[1].value} pts)`);

    // Player 2 keeps first card, discards second
    const player2KeptCard = player2DrawnCards[0];
    const player2DiscardedCard = player2DrawnCards[1];

    const finalGameState = {
      ...nextTurnState,
      players: [
        nextTurnState.players[0], // Player 1 unchanged
        {
          ...nextTurnState.players[1],
          hand: [player2KeptCard]
        }
      ],
      deck: nextTurnState.deck.slice(2),
      discardRight: [...nextTurnState.discardRight, player2DiscardedCard],
      turnCount: 2,
      actionLog: [
        ...nextTurnState.actionLog,
        {
          timestamp: new Date().toISOString(),
          message: `${player2Name} drew 2 cards, kept ${player2KeptCard.name}, discarded ${player2DiscardedCard.name}`
        }
      ],
      lastAction: {
        type: 'draw',
        playerId: player2Id,
        playerName: player2Name,
        cards: player2DrawnCards,
        kept: player2KeptCard,
        discarded: player2DiscardedCard
      }
    };

    await updateDoc(doc(db, 'rooms', roomCode, 'game', 'state'), finalGameState);

    console.log('✅ Player 2 drew cards!');
    console.log('   Kept:', player2KeptCard.name);
    console.log('   Discarded:', player2DiscardedCard.name);
    console.log('   Hand size:', finalGameState.players[1].hand.length);

    await wait(500);

    // Summary
    console.log('\n📊 ========== GAME STATE SUMMARY ==========');
    console.log('🏠 Room Code:', roomCode);
    console.log('🎮 Status:', finalGameState.status);
    console.log('🔄 Turn Count:', finalGameState.turnCount);
    console.log('📚 Deck Size:', finalGameState.deck.length);
    console.log('\n👥 Players:');
    finalGameState.players.forEach((player, index) => {
      console.log(`   ${index + 1}. ${player.name}`);
      console.log(`      - Hand: ${player.hand.length} cards`);
      console.log(`      - Cards: ${player.hand.map(c => c.name).join(', ')}`);
    });
    console.log('\n🗑️ Discard Piles:');
    console.log('   Left:', finalGameState.discardLeft.map(c => c.name).join(' -> '));
    console.log('   Right:', finalGameState.discardRight.map(c => c.name).join(' -> '));

    console.log('\n📝 Action Log:');
    finalGameState.actionLog.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.message}`);
    });

    console.log('\n✨ ========== TEST COMPLETED SUCCESSFULLY! ==========');
    console.log(`\n🌐 You can view this game in your browser at:`);
    console.log(`   http://localhost:3001`);
    console.log(`\n🔑 Room Code: ${roomCode}`);
    console.log(`\n💡 The game state has been saved to Firebase.`);
    console.log(`   You can now join this room from the browser to continue playing!\n`);

  } catch (error) {
    console.error('\n❌ ========== TEST FAILED ==========');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testGameFlow().then(() => {
  console.log('\n🏁 Test script finished. Exiting...\n');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
