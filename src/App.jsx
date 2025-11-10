import React, { useState } from 'react';
import HomePage from './components/HomePage.jsx';
import RoomLobby from './components/RoomLobby.jsx';
import GameBoard from './components/GameBoard.jsx';
import GameOver from './components/GameOver.jsx';
import { initializeGameDeck } from './data/cards.js';
import { startGame } from './services/gameService.js';
import './App.css';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [playerData, setPlayerData] = useState(null);
  const [gameData, setGameData] = useState(null);

  // Navigate between screens
  const handleNavigate = (screen, data = {}) => {
    if (screen === 'create-room' || screen === 'join-room') {
      setPlayerData(data);
      setCurrentScreen('room-lobby');
    } else if (screen === 'game') {
      const { roomCode, players } = data;
      setGameData({
        roomCode,
        players,
        gameStarted: true,
      });
      setCurrentScreen('game');
    } else if (screen === 'game-over') {
      setGameData(data);
      setCurrentScreen('game-over');
    } else if (screen === 'home') {
      setCurrentScreen('home');
      setPlayerData(null);
      setGameData(null);
    }
  };

  // Start game from lobby
  const handleGameStart = async (roomCode, room) => {
    try {
      // Initialize game deck
      const deck = initializeGameDeck();
      
      // Import initializeRound to properly set up the game
      const { initializeRound } = await import('./data/gameRules.js');
      const gameState = initializeRound(room.players, deck);

      // Start game in Firebase with properly initialized state
      await startGame(roomCode, gameState);

      handleNavigate('game', {
        roomCode,
        players: room.players,
      });
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  // Handle game end
  const handleGameEnd = (finalData) => {
    handleNavigate('game-over', finalData);
  };

  // Render current screen
  if (currentScreen === 'home') {
    return (
      <div className="app">
        <HomePage onNavigate={handleNavigate} />
      </div>
    );
  }

  if (currentScreen === 'room-lobby' && playerData) {
    const isCreator = !playerData.roomCode;

    return (
      <div className="app">
        <RoomLobby
          playerName={playerData.playerName}
          playerId={playerData.playerId}
          roomCode={playerData.roomCode}
          isCreator={isCreator}
          onGameStart={handleGameStart}
          onBack={() => handleNavigate('home')}
        />
      </div>
    );
  }

  if (currentScreen === 'game' && gameData) {
    return (
      <div className="app">
        <GameBoard
          roomCode={gameData.roomCode}
          playerId={playerData?.playerId}
          playerName={playerData?.playerName}
          players={gameData.players}
          onGameOver={handleGameEnd}
          onBack={() => handleNavigate('home')}
        />
      </div>
    );
  }

  if (currentScreen === 'game-over' && gameData) {
    return (
      <div className="app">
        <GameOver
          roomCode={gameData.roomCode}
          winnerName={gameData.winnerName}
          winnerId={gameData.winnerId}
          onPlayAgain={() => handleNavigate('home')}
          onMainMenu={() => handleNavigate('home')}
        />
      </div>
    );
  }

  return null;
}