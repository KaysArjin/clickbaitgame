function getPlayersArray(playersMap) {
    return Object.keys(playersMap).map((id) => ({
        id,
        name: playersMap[id].name,
        score: playersMap[id].score,
        isJudge: playersMap[id].isJudge,
        avatar: playersMap[id].avatar,
        joinedAt: playersMap[id].joinedAt,
    }));
}

function buildOutboundGameState(state) {
    const players = getPlayersArray(state.players);
    const submissionCount = Object.keys(state.submissions).length;
    const totalNonJudges = Object.keys(state.players).filter((id) => !state.players[id].isJudge).length;

    return {
        players,
        gamePhase: state.gamePhase,
        selectedLink: state.selectedLink,
        roundNumber: state.roundNumber,
        submissionCount,
        totalNonJudges,
    };
}

function buildStats(state) {
    const playerStats = Object.keys(state.players).map((id) => {
        const p = state.players[id];
        const history = state.gameHistory.filter(
            (r) => r.actualSubmitter === p.name || r.judge === p.name
    );
        return {
            name: p.name,
            score: p.score,
            roundsAsJudge: history.filter((r) => r.judge === p.name).length,
            correctGuesses: history.filter((r) => r.judge === p.name && r.wasCorrect).length,
            timesFooledJudge: history.filter((r) => r.actualSubmitter === p.name && !r.wasCorrect).length,
        };
    }); 
    return {
        totalRounds: state.roundNumber,
        gameHistory: state.gameHistory,
        playerStats,
    };
}

module.exports = {
    getPlayersArray,
    buildOutboundGameState,
    buildStats,
};