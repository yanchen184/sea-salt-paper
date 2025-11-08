import React, { useState } from 'react';
import HomePage from './components/HomePage';
import RoomLobby from './components/RoomLobby';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';
import { initializeGameDeck } from './utils/gameLogic';
import { CARD_DECK, GAME_CONFIG } from './data/cards';
import { startGame } from './services/gameService';
import './App.css';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [playerData, setPlayerData] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [gameData, setGameData] = useState(null);

  // Navigate between screens
  const handleNavigate = (screen, data = {}) => {
    if (screen === 'create-room') {
      setPlayerData(data);
      setCurrentScreen('room-lobby');
    } else if (screen === 'join-room') {
      setPlayerData(data);
      setCurrentScreen('room-lobby');
    } else if (screen === 'game') {
      const { roomCode, players } = data;
      
      // Initialize game deck
      const { drawPile, discardPile } = initializeGameDeck(CARD_DECK);
      
      // Distribute initial cards to players (5 cards each)
      const initPlayers = players.map(player => ({
        ...player,
        hand: drawPile.splice(0, 5),
      }));

      setGameData({
        roomCode,
        players: initPlayers,
        drawPile,
        discardPile,
        gameStarted: false,
      });

      setCurrentScreen('game');
    } else if (screen === 'game-over') {
      setGameData(data);
      setCurrentScreen('game-over');
    } else if (screen === 'home') {
      setCurrentScreen('home');
      setPlayerData(null);
      setRoomData(null);
      setGameData(null);
    }
  };

  // Start game from lobby
  const handleGameStart = async (roomCode, room) => {
    try {
      // Initialize game deck
      const { drawPile, discardPile } = initializeGameDeck(CARD_DECK);
      
      // Distribute initial cards (5 cards each)
      const playersWithCards = room.players.map(player => ({
        ...player,
        hand: drawPile.splice(0, 5),
      }));

      // Start game in Firebase
      await startGame(roomCode, { drawPile, discardPile });

      handleNavigate('game', {
        roomCode,
        players: playersWithCards,
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
          playerId={playerData.playerId}
          playerName={playerData.playerName}
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
          players={gameData.players}
          scores={gameData.scores}
          winnerName={gameData.winnerName}
          winnerId={gameData.winnerId}
          onPlayAgain={() => handleNavigate('room-lobby')}
          onMainMenu={() => handleNavigate('home')}
        />
      </div>
    );
  }

  return null;
}