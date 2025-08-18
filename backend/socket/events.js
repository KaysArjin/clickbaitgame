module.exports = {
    // server -> client
    CONNECTION_ESTABLISHED: 'connection-established',
    GAME_STATE_UPDATE: 'game-state-update',
    PLAYER_NOTIFICATION: 'player-notification',
    ROUND_STARTED: 'round-started',
    SUBMISSION_CONFIRMED: 'submission-confirmed',
    JUDGING_PHASE_STARTED: 'judging-phase-started',
    ROUND_COMPLETED: 'round-completed',
    GAME_STATS: 'game-stats',
    SETTINGS_UPDATED: 'settings-updated',
    GAME_RESET: 'game-reset',
    JUDGE_CHANGED: 'judge-changed',
    GAME_ERROR: 'game-error',
    JOIN_SUCCESS: 'join-success',
    JOIN_ERROR: 'join-error',

    // client -> server
    JOIN_GAME: 'join-game',
    START_ROUND: 'start-round',
    SUBMIT_LINK: 'submit-link',
    JUDGE_GUESS: 'judge-guess',
    GET_STATS: 'get-stats',
    UPDATE_SETTINGS: 'update-settings',
    RESET_GAME: 'reset-game',
};
