const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, '../frontend')));

let gameState = {
  players: {},
  submissions: {},
  selectedLink: null,
  selectedPlayer: null,
  gamePhase: 'lobby',
  roundNumber: 0,
  gameHistory: [],
  settings: {
    maxPlayers: 8,
    roundTimeLimit: 300,
    pointsForCorrect: 1,
    pointsForFooling: 2
  }
};


function getPlayersArray() {
  return Object.keys(gameState.players).map(id => ({
    id,
    name: gameState.players[id].name,
    score: gameState.players[id].score,
    isJudge: gameState.players[id].isJudge,
    avatar: gameState.players[id].avatar,
    joinedAt: gameState.players[id].joinedAt
  }));
}

function assignRandomJudge() {
  const playerIds = Object.keys(gameState.players);
  if (playerIds.length > 0) {

    playerIds.forEach(id => gameState.players[id].isJudge = false);

    const randomId = playerIds[Math.floor(Math.random() * playerIds.length)];
    gameState.players[randomId].isJudge = true;
    return randomId;
  }
  return null;
}

function isValidWikipediaUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('wikipedia.org') && 
           urlObj.pathname.includes('/wiki/') &&
           !urlObj.pathname.includes(':') &&
           !urlObj.pathname.includes('disambiguation');
  } catch {
    return false;
  }
}

async function extractWikipediaTitle(url) {
  try {
    const urlObj = new URL(url);
    const title = decodeURIComponent(urlObj.pathname.split('/wiki/')[1] || '');
    return title.replace(/_/g, ' ');
  } catch {
    return 'Unknown Article';
  }
}

function generateAvatar() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
  const icons = ['🎯', '🎪', '🎨', '🎭', '🎪', '🎲', '🎸', '🎺', '🎻', '🎹', '🚀', '🦄', '🐸', '🐙', '🦋', '🌟'];
  
  return {
    color: colors[Math.floor(Math.random() * colors.length)],
    icon: icons[Math.floor(Math.random() * icons.length)]
  };
}

function broadcastGameState() {
  io.emit('game-state-update', {
    players: getPlayersArray(),
    gamePhase: gameState.gamePhase,
    selectedLink: gameState.selectedLink,
    roundNumber: gameState.roundNumber,
    submissionCount: Object.keys(gameState.submissions).length,
    totalNonJudges: Object.keys(gameState.players).filter(id => !gameState.players[id].isJudge).length
  });
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.emit('connection-established', { socketId: socket.id });

  socket.on('join-game', async (data) => {
    const { playerName } = data;
    
    if (!playerName || playerName.trim() === '') {
      socket.emit('join-error', 'Name cannot be empty');
      return;
    }

    if (playerName.length > 20) {
      socket.emit('join-error', 'Name must be 20 characters or less');
      return;
    }

    const existingNames = Object.values(gameState.players).map(p => p.name.toLowerCase());
    if (existingNames.includes(playerName.toLowerCase())) {
      socket.emit('join-error', 'Name already taken');
      return;
    }

    if (Object.keys(gameState.players).length >= gameState.settings.maxPlayers) {
      socket.emit('join-error', 'Game is full');
      return;
    }

    gameState.players[socket.id] = {
      name: playerName.trim(),
      score: 0,
      isJudge: false,
      avatar: generateAvatar(),
      joinedAt: Date.now()
    };

    const currentJudge = Object.values(gameState.players).find(p => p.isJudge);
    if (!currentJudge) {
      gameState.players[socket.id].isJudge = true;
    }

    socket.emit('join-success', {
      playerId: socket.id,
      playerData: gameState.players[socket.id]
    });

    broadcastGameState();

    io.emit('player-notification', {
      type: 'player-joined',
      message: `${playerName} joined the game`,
      timestamp: Date.now()
    });

    console.log(`${playerName} joined the game`);
  });

  socket.on('start-round', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.isJudge) {
      socket.emit('game-error', 'Only the judge can start a round');
      return;
    }

    const nonJudges = Object.keys(gameState.players).filter(id => !gameState.players[id].isJudge);
    if (nonJudges.length < 2) {
      socket.emit('game-error', 'Need at least 2 non-judge players to start');
      return;
    }

    gameState.submissions = {};
    gameState.selectedLink = null;
    gameState.selectedPlayer = null;
    gameState.gamePhase = 'submitting';
    gameState.roundNumber++;

    broadcastGameState();

    io.emit('round-started', {
      roundNumber: gameState.roundNumber,
      judge: player.name
    });

    console.log(`Round ${gameState.roundNumber} started by ${player.name}`);
  });

  socket.on('submit-link', async (data) => {
    const { link } = data;
    const player = gameState.players[socket.id];
    
    if (!player) {
      socket.emit('game-error', 'You must join the game first');
      return;
    }

    if (player.isJudge) {
      socket.emit('game-error', 'Judge cannot submit links');
      return;
    }

    if (gameState.gamePhase !== 'submitting') {
      socket.emit('game-error', 'Not accepting submissions right now');
      return;
    }

    if (!isValidWikipediaUrl(link)) {
      socket.emit('game-error', 'Please submit a valid Wikipedia article URL');
      return;
    }

    const title = await extractWikipediaTitle(link);
    gameState.submissions[socket.id] = {
      link: link,
      title: title,
      submittedAt: Date.now()
    };
    
    socket.emit('submission-confirmed', { title });

    broadcastGameState();

    const nonJudges = Object.keys(gameState.players).filter(id => !gameState.players[id].isJudge);
    const submissions = Object.keys(gameState.submissions);
    
    if (nonJudges.length > 0 && submissions.length === nonJudges.length) {

      const randomSubmission = submissions[Math.floor(Math.random() * submissions.length)];
      gameState.selectedLink = gameState.submissions[randomSubmission];
      gameState.selectedPlayer = randomSubmission;
      gameState.gamePhase = 'judging';

      broadcastGameState();

      io.emit('judging-phase-started', {
        selectedLink: gameState.selectedLink,
        judgeId: Object.keys(gameState.players).find(id => gameState.players[id].isJudge)
      });

      console.log('All submissions received, judging phase started');
    }
  });

  socket.on('judge-guess', (data) => {
    const { guessedPlayerId } = data;
    const player = gameState.players[socket.id];
    
    if (!player || !player.isJudge) {
      socket.emit('game-error', 'Only the judge can make guesses');
      return;
    }

    if (gameState.gamePhase !== 'judging') {
      socket.emit('game-error', 'Not in judging phase');
      return;
    }

    if (!gameState.players[guessedPlayerId]) {
      socket.emit('game-error', 'Invalid player guess');
      return;
    }

    const correctPlayer = gameState.selectedPlayer;
    const judgeId = socket.id;
    const wasCorrect = guessedPlayerId === correctPlayer;

    let scoreChanges = {};

    if (wasCorrect) {

      gameState.players[judgeId].score += gameState.settings.pointsForCorrect;
      gameState.players[correctPlayer].score += gameState.settings.pointsForCorrect;
      scoreChanges[judgeId] = gameState.settings.pointsForCorrect;
      scoreChanges[correctPlayer] = gameState.settings.pointsForCorrect;
    } else {

      gameState.players[correctPlayer].score += gameState.settings.pointsForFooling;
      scoreChanges[correctPlayer] = gameState.settings.pointsForFooling;
    }


    gameState.gameHistory.push({
      roundNumber: gameState.roundNumber,
      judge: gameState.players[judgeId].name,
      selectedLink: gameState.selectedLink,
      actualSubmitter: gameState.players[correctPlayer].name,
      judgeGuess: gameState.players[guessedPlayerId].name,
      wasCorrect: wasCorrect,
      scoreChanges: scoreChanges,
      timestamp: Date.now()
    });


    gameState.gamePhase = 'scoring';

    io.emit('round-completed', {
      roundNumber: gameState.roundNumber,
      judgeGuess: gameState.players[guessedPlayerId].name,
      correctPlayer: gameState.players[correctPlayer].name,
      wasCorrect: wasCorrect,
      selectedLink: gameState.selectedLink,
      scoreChanges: scoreChanges,
      allSubmissions: Object.keys(gameState.submissions).map(id => ({
        player: gameState.players[id].name,
        ...gameState.submissions[id]
      }))
    });

    broadcastGameState();
    console.log(`Round ${gameState.roundNumber} completed`);
  });

  socket.on('get-stats', () => {
    const stats = {
      totalRounds: gameState.roundNumber,
      gameHistory: gameState.gameHistory,
      playerStats: Object.keys(gameState.players).map(id => {
        const player = gameState.players[id];
        const playerHistory = gameState.gameHistory.filter(round => 
          round.actualSubmitter === player.name || round.judge === player.name
        );
        
        return {
          name: player.name,
          score: player.score,
          roundsAsJudge: playerHistory.filter(r => r.judge === player.name).length,
          correctGuesses: playerHistory.filter(r => r.judge === player.name && r.wasCorrect).length,
          timesFooledJudge: playerHistory.filter(r => r.actualSubmitter === player.name && !r.wasCorrect).length
        };
      })
    };
    
    socket.emit('game-stats', stats);
  });

  socket.on('update-settings', (newSettings) => {
    const player = gameState.players[socket.id];
    if (!player || !player.isJudge) {
      socket.emit('game-error', 'Only judge can change settings');
      return;
    }

    gameState.settings = { ...gameState.settings, ...newSettings };
    io.emit('settings-updated', gameState.settings);
  });

  socket.on('reset-game', () => {

    Object.keys(gameState.players).forEach(id => {
      gameState.players[id].score = 0;
      gameState.players[id].isJudge = false;
    });

    assignRandomJudge();
    gameState.submissions = {};
    gameState.selectedLink = null;
    gameState.selectedPlayer = null;
    gameState.gamePhase = 'lobby';
    gameState.roundNumber = 0;
    gameState.gameHistory = [];

    broadcastGameState();

    io.emit('game-reset', {
      message: 'Game has been reset',
      newJudge: Object.values(gameState.players).find(p => p.isJudge)?.name
    });

    console.log('Game reset');
  });

  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      console.log(`${player.name} disconnected`);
      
      const wasJudge = player.isJudge;
      delete gameState.players[socket.id];
      delete gameState.submissions[socket.id];

      if (wasJudge && Object.keys(gameState.players).length > 0) {
        const newJudgeId = assignRandomJudge();
        if (newJudgeId) {
          io.emit('judge-changed', {
            newJudge: gameState.players[newJudgeId].name,
            reason: 'Previous judge disconnected'
          });
        }
      }

      if (Object.keys(gameState.players).length === 0) {
        gameState = {
          players: {},
          submissions: {},
          selectedLink: null,
          selectedPlayer: null,
          gamePhase: 'lobby',
          roundNumber: 0,
          gameHistory: [],
          settings: gameState.settings
        };
      }

      io.emit('player-notification', {
        type: 'player-left',
        message: `${player.name} left the game`,
        timestamp: Date.now()
      });

      broadcastGameState();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Enhanced Clickbait server running on port ${PORT}`);
});