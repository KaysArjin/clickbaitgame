const GameState = require('../game/GameState');
const EVENTS = require('./events');

module.exports = function initSocket(io) {
	const state = new GameState(io);

	io.on('connection', (socket) => {
		console.log('Player connected:', socket.id);

		socket.emit(EVENTS.CONNECTION_ESTABLISHED, { socketId: socket.id });


		socket.on(EVENTS.JOIN_GAME, ({ playerName }) => {
			const name = (playerName || '').trim();

			if (!name) return socket.emit(EVENTS.JOIN_ERROR, 'Name cannot be empty');
			if (name.length > 20) return socket.emit(EVENTS.JOIN_ERROR, 'Name must be 20 characters or less');

			const existing = Object.values(state.players).map((p) => p.name.toLowerCase());
			if (existing.includes(name.toLowerCase())) return socket.emit(EVENTS.JOIN_ERROR, 'Name already taken');

			if (Object.keys(state.players).length >= state.settings.maxPlayers) {
				return socket.emit(EVENTS.JOIN_ERROR, 'Game is full');
			}

			state.addPlayer(socket.id, name);

			socket.emit(EVENTS.JOIN_SUCCESS, {
				playerId: socket.id,
				playerData: state.players[socket.id],
			});

			state.broadcast();

			io.emit(EVENTS.PLAYER_NOTIFICATION, {
				type: 'player-joined',
				message: `${name} joined the game`,
				timestamp: Date.now(),
			});

			console.log(`${name} joined the game`);
		});


		socket.on(EVENTS.START_ROUND, () => {
			const result = state.startRound(socket.id);
			if (!result.ok) {
				return socket.emit(EVENTS.GAME_ERROR, result.error);
			}

			state.broadcast();
			io.emit(EVENTS.ROUND_STARTED, {
				roundNumber: result.roundNumber,
				judge: result.judgeName,
			});

			console.log(`Round ${result.roundNumber} started by ${result.judgeName}`);
		});


		socket.on(EVENTS.SUBMIT_LINK, async ({ link }) => {
			const result = await state.submitLink(socket.id, link);
			if (!result.ok) {
				return socket.emit(EVENTS.GAME_ERROR, result.error);
			}

			socket.emit(EVENTS.SUBMISSION_CONFIRMED, { title: result.title });
			state.broadcast();

			if (result.movedToJudging) {
				state.broadcast();
				io.emit(EVENTS.JUDGING_PHASE_STARTED, {
					selectedLink: state.selectedLink,
					judgeId: state.getJudgeId(),
				});
				console.log('All submissions received, judging phase started');
			}
		});


		socket.on(EVENTS.JUDGE_GUESS, ({ guessedPlayerId }) => {
			const result = state.judgeGuess(socket.id, guessedPlayerId);
			if (!result.ok) {
				return socket.emit(EVENTS.GAME_ERROR, result.error);
			}

			io.emit(EVENTS.ROUND_COMPLETED, result.payload);
			state.broadcast();

			console.log(`Round ${state.roundNumber} completed`);
		});


		socket.on(EVENTS.GET_STATS, () => {
			socket.emit(EVENTS.GAME_STATS, state.buildStats());
		});


		socket.on(EVENTS.UPDATE_SETTINGS, (newSettings) => {
			const p = state.players[socket.id];
			if (!p || !p.isJudge) {
				return socket.emit(EVENTS.GAME_ERROR, 'Only judge can change settings');
			}

			const updated = state.updateSettings(newSettings);
			io.emit(EVENTS.SETTINGS_UPDATED, updated);
		});


		socket.on(EVENTS.RESET_GAME, () => {
			const newJudgeId = state.resetGameKeepPlayers();
			state.broadcast();

			io.emit(EVENTS.GAME_RESET, {
				message: 'Game has been reset',
				newJudge: newJudgeId ? state.players[newJudgeId].name : null,
			});

			console.log('Game reset');
		});


		socket.on('disconnect', () => {
			const player = state.players[socket.id];
			if (!player) return;

			console.log(`${player.name} disconnected`);
			const { wasJudge, newJudgeId } = state.removePlayer(socket.id);

			if (wasJudge && newJudgeId) {
				io.emit(EVENTS.JUDGE_CHANGED, {
					newJudge: state.players[newJudgeId].name,
					reason: 'Previous judge disconnected',
				});
			}

			io.emit(EVENTS.PLAYER_NOTIFICATION, {
				type: 'player-left',
				message: `${player.name} left the game`,
				timestamp: Date.now(),
			});

			state.broadcast();
		});
	});
};
