const defaults = require('./settings');
const { isValidWikipediaUrl, extractWikipediaTitle, generateAvatar } = require('./utils');
const { buildOutboundGameState, buildStats } = require('./selectors');

class GameState {
	constructor(io) {
		this.io = io;
		this.resetAll();
	}

	resetAll() {
		this.players = {};
		this.submissions = {};
		this.selectedLink = null;
		this.selectedPlayer = null;
		this.gamePhase = 'lobby';
		this.roundNumber = 0;
		this.gameHistory = [];
		this.settings = { ...defaults };
	}

	broadcast() {
		this.io.emit('game-state-update', buildOutboundGameState(this));
	}

	assignRandomJudge() {
		const ids = Object.keys(this.players);
		if (ids.length === 0) return null;
		ids.forEach((id) => (this.players[id].isJudge = false));
		const pick = ids[Math.floor(Math.random() * ids.length)];
		this.players[pick].isJudge = true;
		return pick;
	}

	ensureJudgeExists(newPlayerIdIfFirstJoin) {
		const anyJudge = Object.values(this.players).some((p) => p.isJudge);
		if (!anyJudge) {
			this.players[newPlayerIdIfFirstJoin].isJudge = true;
			return newPlayerIdIfFirstJoin;
		}
		return Object.keys(this.players).find((id) => this.players[id].isJudge);
	}

	addPlayer(socketId, name) {
		this.players[socketId] = {
			name: name.trim(),
			score: 0,
			isJudge: false,
			avatar: generateAvatar(),
			joinedAt: Date.now(),
		};
		const judgeId = this.ensureJudgeExists(socketId);
		return judgeId;
	}

	removePlayer(socketId) {
		const wasJudge = this.players[socketId]?.isJudge;
		delete this.players[socketId];
		delete this.submissions[socketId];

		let newJudgeId = null;
		if (wasJudge && Object.keys(this.players).length > 0) {
			newJudgeId = this.assignRandomJudge();
		}

		if (Object.keys(this.players).length === 0) {

			const settings = this.settings;
			this.resetAll();
			this.settings = settings;
		}

		return { wasJudge, newJudgeId };
	}

	getJudgeId() {
		return Object.keys(this.players).find((id) => this.players[id].isJudge) || null;
	}

	startRound(requesterId) {
		const player = this.players[requesterId];
		if (!player || !player.isJudge) {
			return { ok: false, error: 'Only the judge can start a round' };
		}

		const nonJudges = Object.keys(this.players).filter((id) => !this.players[id].isJudge);
		if (nonJudges.length < 2) {
			return { ok: false, error: 'Need at least 2 non-judge players to start' };
		}

		this.submissions = {};
		this.selectedLink = null;
		this.selectedPlayer = null;
		this.gamePhase = 'submitting';
		this.roundNumber += 1;

		return { ok: true, judgeName: player.name, roundNumber: this.roundNumber };
	}

	async submitLink(socketId, link) {
		const player = this.players[socketId];
		if (!player) return { ok: false, error: 'You must join the game first' };
		if (player.isJudge) return { ok: false, error: 'Judge cannot submit links' };
		if (this.gamePhase !== 'submitting') return { ok: false, error: 'Not accepting submissions right now' };
		if (!isValidWikipediaUrl(link)) return { ok: false, error: 'Please submit a valid Wikipedia article URL' };

		const title = await extractWikipediaTitle(link);
		this.submissions[socketId] = { link, title, submittedAt: Date.now() };

		const allNonJudges = Object.keys(this.players).filter((id) => !this.players[id].isJudge);
		const submissions = Object.keys(this.submissions);

		let movedToJudging = false;
		if (allNonJudges.length > 0 && submissions.length === allNonJudges.length) {
			const randomSubmitter = submissions[Math.floor(Math.random() * submissions.length)];
			this.selectedLink = this.submissions[randomSubmitter];
			this.selectedPlayer = randomSubmitter;
			this.gamePhase = 'judging';
			movedToJudging = true;
		}

		return { ok: true, title, movedToJudging };
	}

	judgeGuess(judgeId, guessedPlayerId) {
		const judge = this.players[judgeId];
		if (!judge || !judge.isJudge) return { ok: false, error: 'Only the judge can make guesses' };
		if (this.gamePhase !== 'judging') return { ok: false, error: 'Not in judging phase' };
		if (!this.players[guessedPlayerId]) return { ok: false, error: 'Invalid player guess' };

		const correctPlayer = this.selectedPlayer;
		const wasCorrect = guessedPlayerId === correctPlayer;
		const scoreChanges = {};

		if (wasCorrect) {
			this.players[judgeId].score += this.settings.pointsForCorrect;
			this.players[correctPlayer].score += this.settings.pointsForCorrect;
			scoreChanges[judgeId] = this.settings.pointsForCorrect;
			scoreChanges[correctPlayer] = this.settings.pointsForCorrect;
		} else {
			this.players[correctPlayer].score += this.settings.pointsForFooling;
			scoreChanges[correctPlayer] = this.settings.pointsForFooling;
		}

		this.gameHistory.push({
			roundNumber: this.roundNumber,
			judge: this.players[judgeId].name,
			selectedLink: this.selectedLink,
			actualSubmitter: this.players[correctPlayer].name,
			judgeGuess: this.players[guessedPlayerId].name,
			wasCorrect,
			scoreChanges,
			timestamp: Date.now(),
		});

		this.gamePhase = 'scoring';

		const allSubmissions = Object.keys(this.submissions).map((id) => ({
			player: this.players[id]?.name || 'Unknown',
			...this.submissions[id],
		}));

		return {
			ok: true,
			payload: {
				roundNumber: this.roundNumber,
				judgeGuess: this.players[guessedPlayerId].name,
				correctPlayer: this.players[correctPlayer].name,
				wasCorrect,
				selectedLink: this.selectedLink,
				scoreChanges,
				allSubmissions,
			},
		};
	}

	updateSettings(newSettings) {
		this.settings = { ...this.settings, ...newSettings };
		return this.settings;
	}

	resetGameKeepPlayers() {
		Object.keys(this.players).forEach((id) => {
			this.players[id].score = 0;
			this.players[id].isJudge = false;
		});
		this.assignRandomJudge();
		this.submissions = {};
		this.selectedLink = null;
		this.selectedPlayer = null;
		this.gamePhase = 'lobby';
		this.roundNumber = 0;
		this.gameHistory = [];
		return this.getJudgeId();
	}

	buildStats() {
		return buildStats(this);
	}
}

module.exports = GameState;
