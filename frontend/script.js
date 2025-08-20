class ClickbaitGame {
    constructor() {
        this.socket = io();
        this.currentPlayer = null;
        this.gameState = {
            players: [],
            gamePhase: 'lobby',
            selectedLink: null,
            roundNumber: 0
        };
        this.currentView = 'loading';
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketHandlers();
    }

    initializeElements() {

        this.screens = {
            loading: document.getElementById('loading-screen'),
            welcome: document.getElementById('welcome-screen'),
            game: document.getElementById('game-screen')
        };

        this.views = {
            lobby: document.getElementById('lobby-view'),
            submission: document.getElementById('submission-view'),
            judging: document.getElementById('judging-view'),
            results: document.getElementById('results-view')
        };

        this.elements = {
            playerName: document.getElementById('player-name'),
            joinBtn: document.getElementById('join-btn'),
            joinError: document.getElementById('join-error'),
            playersList: document.getElementById('players-list'),
            roundNumber: document.getElementById('round-number'),
            phaseIndicator: document.getElementById('phase-indicator'),
            statusText: document.getElementById('status-text'),
            progressInfo: document.getElementById('progress-info'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            activityFeed: document.getElementById('activity-feed'),
            startRoundBtn: document.getElementById('start-round-btn'),
            wikiLink: document.getElementById('wiki-link'),
            submitLinkBtn: document.getElementById('submit-link-btn'),
            submissionStatus: document.getElementById('submission-status'),
            selectedTitle: document.getElementById('selected-title'),
            selectedUrl: document.getElementById('selected-url'),
            judgeActions: document.getElementById('judge-actions'),
            guessButtons: document.getElementById('guess-buttons'),
            waitingJudge: document.getElementById('waiting-judge'),
            roundResults: document.getElementById('round-results'),
            nextRoundBtn: document.getElementById('next-round-btn'),
            viewAllSubmissionsBtn: document.getElementById('view-all-submissions-btn'),
            randomLinkBtn: document.getElementById('random-link-btn')
        };

        this.modals = {
            stats: document.getElementById('stats-modal'),
            settings: document.getElementById('settings-modal'),
            menu: document.getElementById('menu-modal')
        };

        this.toastContainer = document.getElementById('toast-container');
    }

    setupEventListeners() {
        this.elements.joinBtn.addEventListener('click', () => this.joinGame());
        this.elements.playerName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        this.elements.startRoundBtn.addEventListener('click', () => {
            this.socket.emit('start-round');
        });

        this.elements.randomLinkBtn.addEventListener('click', () => this.generateRandomLink());

        this.elements.submitLinkBtn.addEventListener('click', () => this.submitLink());

        this.elements.wikiLink.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitLink();
        });

        this.elements.nextRoundBtn.addEventListener('click', () => {
            this.socket.emit('start-round');
        });

        document.getElementById('stats-btn').addEventListener('click', () => {
            this.socket.emit('get-stats');
            this.showModal('stats');
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showModal('settings');
        });

        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showModal('menu');
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.hideModal(e.target.closest('.modal').id.replace('-modal', ''));
            });
        });

        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('reset-game-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the game? This will clear all scores and history.')) {
                this.socket.emit('reset-game');
                this.hideModal('menu');
            }
        });

        document.getElementById('leave-game-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to leave the game?')) {
                window.location.reload();
            }
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id.replace('-modal', ''));
                }
            });
        });
    }

    setupSocketHandlers() {
        this.socket.on('connection-established', () => {
            setTimeout(() => this.showScreen('welcome'), 1000);
        });

        this.socket.on('join-success', (data) => {
            this.currentPlayer = data.playerData;
            this.showScreen('game');
            this.showToast('Welcome to the game!', 'success');
        });

        this.socket.on('join-error', (message) => {
            this.showJoinError(message);
        });

        this.socket.on('game-state-update', (newGameState) => {
            this.gameState = newGameState;
            this.updateGameDisplay();
        });

        this.socket.on('round-started', (data) => {
            this.showToast(`Round ${data.roundNumber} started!`, 'info');
            this.addActivityItem(`Round ${data.roundNumber} started by ${data.judge}`);
        });

        this.socket.on('submission-confirmed', (data) => {
            this.elements.submissionStatus.classList.remove('hidden');
            this.elements.submitLinkBtn.disabled = true;
            this.elements.wikiLink.disabled = true;
            this.showToast(`Link submitted: ${data.title}`, 'success');
        });

        this.socket.on('judging-phase-started', (data) => {
            this.showToast('All links submitted! Judging phase begins.', 'info');
            this.addActivityItem('All players have submitted their links');
        });

        this.socket.on('round-completed', (result) => {
            this.displayRoundResults(result);
            this.showToast(
                result.wasCorrect ? 
                'Judge guessed correctly!' : 
                'Judge was fooled!', 
                result.wasCorrect ? 'success' : 'warning'
            );
        });

        this.socket.on('player-notification', (notification) => {
            this.addActivityItem(notification.message);
            if (notification.type === 'player-joined') {
                this.showToast(notification.message, 'info');
            }
        });

        this.socket.on('judge-changed', (data) => {
            this.showToast(`${data.newJudge} is now the judge`, 'info');
            this.addActivityItem(`👨‍⚖️ ${data.newJudge} became the new judge`);
        });

        this.socket.on('game-reset', (data) => {
            this.showToast(data.message, 'info');
            this.addActivityItem('Game was reset');
            this.clearActivityFeed();
        });

        this.socket.on('game-stats', (stats) => {
            this.displayGameStats(stats);
        });

        this.socket.on('settings-updated', (settings) => {
            this.showToast('Settings updated', 'success');
            this.hideModal('settings');
        });

        this.socket.on('game-error', (message) => {
            this.showToast(message, 'error');
        });
    }

    showScreen(screenName) {
        Object.keys(this.screens).forEach(name => {
            this.screens[name].classList.toggle('hidden', name !== screenName);
        });
        this.currentView = screenName;
    }

    showView(viewName) {
        Object.keys(this.views).forEach(name => {
            this.views[name].classList.toggle('active', name === viewName);
        });
    }

    joinGame() {
        const name = this.elements.playerName.value.trim();
        if (!name) {
            this.showJoinError('Please enter your name');
            return;
        }
        
        if (name.length > 20) {
            this.showJoinError('Name must be 20 characters or less');
            return;
        }
        
        this.socket.emit('join-game', { playerName: name });
    }

    submitLink() {
        const link = this.elements.wikiLink.value.trim();
        if (!link) {
            this.showToast('Please enter a Wikipedia link', 'error');
            return;
        }
        
        if (!link.includes('wikipedia.org') || !link.includes('/wiki/')) {
            this.showToast('Please enter a valid Wikipedia article URL', 'error');
            return;
        }
        
        this.socket.emit('submit-link', { link });
    }

    async generateRandomLink() {
        try {
            this.elements.randomLinkBtn.disabled = true;
            this.elements.randomLinkBtn.innerHTML = '<i class="fas fa-dice"></i> Random';

            const resp = await fetch ('https://en.wikipedia.org/w/api.php?action=query&list=random&format=json&rnnamespace=0&rnlimit=1&origin=*');
            const data = await resp.json();
            const page = data?.query?.random?.[0];
            const title = page?.title;

            if (!page) throw new Error ('No Random page found');

            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;

            this.elements.wikiLink.value = url;

            window.open(url, '_blank');

        } catch (err) {
            console.error('Randomlink error:', err);
            this.showToast(`Could not fetch a random article: ${String(err.message || err)}`, 'error');
        } finally {
            this.elements.randomLinkBtn.disabled = false;
            this.elements.randomLinkBtn.innerHTML = '<i class="fas fa-dice"></i> Random';
        }
    }

    makeGuess(playerId) {
        this.socket.emit('judge-guess', { guessedPlayerId: playerId });
    }

    updateGameDisplay() {
        if (this.currentView !== 'game') return;

        this.updatePlayersDisplay();
        this.updateGameHeader();
        this.updateGamePhase();
        this.updateProgressInfo();
    }

    updatePlayersDisplay() {
        this.elements.playersList.innerHTML = '';
        
        this.gameState.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            if (player.isJudge) {
                playerCard.classList.add('judge');
            }
            
            if (this.currentPlayer && player.name === this.currentPlayer.name) {
                playerCard.classList.add('current-user');
            }
            
            playerCard.innerHTML = `
                <div class="player-info">
                    <div class="player-avatar" style="background-color: ${player.avatar?.color || '#6366f1'}">
                        ${player.avatar?.icon || '👤'}
                    </div>
                    <div class="player-details">
                        <div class="player-name">
                            ${player.name}
                            ${player.isJudge ? '<span class="judge-badge">JUDGE</span>' : ''}
                        </div>
                    </div>
                    <div class="player-score">${player.score}</div>
                </div>
            `;
            
            this.elements.playersList.appendChild(playerCard);
        });
    }

    updateGameHeader() {
        this.elements.roundNumber.textContent = `Round ${this.gameState.roundNumber || 1}`;
        
        const phaseNames = {
            'lobby': 'Lobby',
            'submitting': 'Submitting',
            'judging': 'Judging',
            'scoring': 'Results'
        };
        
        this.elements.phaseIndicator.textContent = phaseNames[this.gameState.gamePhase] || 'Unknown';
    }

    updateGamePhase() {
        const currentPlayerData = this.gameState.players.find(p => 
            this.currentPlayer && p.name === this.currentPlayer.name
        );
        const isJudge = currentPlayerData && currentPlayerData.isJudge;
        
        const statusTexts = {
            'lobby': 'Waiting for judge to start round',
            'submitting': isJudge ? 'Players are submitting links' : 'Submit your Wikipedia link',
            'judging': isJudge ? 'Make your guess!' : 'Judge is deciding',
            'scoring': 'Round complete!'
        };
        
        this.elements.statusText.textContent = statusTexts[this.gameState.gamePhase] || 'Unknown status';
        
        switch (this.gameState.gamePhase) {
            case 'lobby':
                this.showView('lobby');
                this.elements.startRoundBtn.classList.toggle('hidden', !isJudge);
                break;
                
            case 'submitting':
                if (isJudge) {
                    this.showView('judging');
                    this.elements.judgeActions.classList.add('hidden');
                    this.elements.waitingJudge.innerHTML = `
                        <i class="fas fa-hourglass-half"></i>
                        <p>Waiting for players to submit their links...</p>
                    `;
                } else {
                    this.showView('submission');
                    this.resetSubmissionForm();
                }
                break;
                
            case 'judging':
                this.showView('judging');
                if (this.gameState.selectedLink) {
                    this.displaySelectedLink();
                    if (isJudge) {
                        this.setupJudgeActions();
                    } else {
                        this.elements.judgeActions.classList.add('hidden');
                        this.elements.waitingJudge.innerHTML = `
                            <i class="fas fa-gavel"></i>
                            <p>Judge is reviewing the link and making their decision...</p>
                        `;
                    }
                }
                break;
                
            case 'scoring':
                this.showView('results');
                this.elements.nextRoundBtn.classList.toggle('hidden', !isJudge);
                break;
        }
    }

    updateProgressInfo() {
        if (this.gameState.gamePhase === 'submitting' && this.gameState.totalNonJudges > 0) {
            this.elements.progressInfo.classList.remove('hidden');
            const progress = (this.gameState.submissionCount / this.gameState.totalNonJudges) * 100;
            this.elements.progressFill.style.width = `${progress}%`;
            this.elements.progressText.textContent = `${this.gameState.submissionCount}/${this.gameState.totalNonJudges} submitted`;
        } else {
            this.elements.progressInfo.classList.add('hidden');
        }
    }

    displaySelectedLink() {
        if (this.gameState.selectedLink) {
            this.elements.selectedTitle.textContent = this.gameState.selectedLink.title || 'Wikipedia Article';
            this.elements.selectedUrl.href = this.gameState.selectedLink.link;
            this.elements.selectedUrl.style.display = 'flex';
        }
    }

    setupJudgeActions() {
        this.elements.judgeActions.classList.remove('hidden');
        this.elements.waitingJudge.classList.add('hidden');
        this.elements.guessButtons.innerHTML = '';
        
        this.gameState.players
            .filter(player => !player.isJudge)
            .forEach(player => {
                const button = document.createElement('button');
                button.className = 'guess-btn';
                button.innerHTML = `
                    <div class="player-avatar" style="background-color: ${player.avatar?.color || '#6366f1'}; width: 20px; height: 20px; font-size: 0.8rem;">
                        ${player.avatar?.icon || '👤'}
                    </div>
                    ${player.name}
                `;
                button.onclick = () => this.makeGuess(player.id);
                this.elements.guessButtons.appendChild(button);
            });
    }

    resetSubmissionForm() {
        this.elements.wikiLink.value = '';
        this.elements.wikiLink.disabled = false;
        this.elements.submitLinkBtn.disabled = false;
        this.elements.submissionStatus.classList.add('hidden');
    }

    displayRoundResults(result) {
        const resultCard = document.createElement('div');
        resultCard.className = `result-card ${result.wasCorrect ? 'correct' : 'incorrect'}`;
        
        resultCard.innerHTML = `
            <div class="result-header">
                <i class="fas ${result.wasCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <h3>${result.wasCorrect ? 'Correct Guess!' : 'Judge was Fooled!'}</h3>
            </div>
            <div class="result-details">
                <p><strong>Judge's Guess:</strong> ${result.judgeGuess}</p>
                <p><strong>Actual Submitter:</strong> ${result.correctPlayer}</p>
                <p><strong>Article:</strong> <a href="${result.selectedLink.link}" target="_blank" rel="noopener">${result.selectedLink.title}</a></p>
                <p><strong>Points Awarded:</strong></p>
                <ul>
                    ${Object.entries(result.scoreChanges).map(([playerId, points]) => {
                        const player = this.gameState.players.find(p => p.id === playerId);
                        return `<li>${player?.name || 'Unknown'}: +${points} points</li>`;
                    }).join('')}
                </ul>
            </div>
        `;
        
        this.elements.roundResults.innerHTML = '';
        this.elements.roundResults.appendChild(resultCard);
        
        this.addActivityItem(`🏆 Round ${this.gameState.roundNumber}: ${result.wasCorrect ? 'Judge guessed correctly' : result.correctPlayer + ' fooled the judge'}`);
    }

    addActivityItem(message) {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <span>${message}</span>
            <small>${new Date().toLocaleTimeString()}</small>
        `;
        
        this.elements.activityFeed.insertBefore(activityItem, this.elements.activityFeed.firstChild);
        
        while (this.elements.activityFeed.children.length > 10) {
            this.elements.activityFeed.removeChild(this.elements.activityFeed.lastChild);
        }
    }

    clearActivityFeed() {
        this.elements.activityFeed.innerHTML = '';
    }

    showModal(modalName) {
        const modal = this.modals[modalName];
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModal(modalName) {
        const modal = this.modals[modalName];
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    saveSettings() {
        const newSettings = {
            maxPlayers: parseInt(document.getElementById('max-players').value),
            pointsForCorrect: parseInt(document.getElementById('correct-points').value),
            pointsForFooling: parseInt(document.getElementById('fooling-points').value)
        };
        
        this.socket.emit('update-settings', newSettings);
    }

    displayGameStats(stats) {
        const statsContent = document.getElementById('stats-content');
        
        if (stats.totalRounds === 0) {
            statsContent.innerHTML = '<p class="text-center text-muted">No rounds played yet.</p>';
            return;
        }
        
        const topPlayer = stats.playerStats.reduce((prev, current) => 
            (prev.score > current.score) ? prev : current
        );
        
        statsContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Rounds</h4>
                    <div class="stat-value">${stats.totalRounds}</div>
                </div>
                <div class="stat-card">
                    <h4>Top Player</h4>
                    <div class="stat-value">${topPlayer.name}</div>
                    <small>${topPlayer.score} points</small>
                </div>
            </div>
            
            <h4 style="margin: 25px 0 15px 0;">Player Statistics</h4>
            <div class="player-stats">
                ${stats.playerStats.map(player => `
                    <div class="player-stat-row">
                        <div class="player-stat-name">${player.name}</div>
                        <div class="player-stat-details">
                            <span>Score: ${player.score}</span>
                            <span>Judge Accuracy: ${player.roundsAsJudge > 0 ? Math.round((player.correctGuesses / player.roundsAsJudge) * 100) : 0}%</span>
                            <span>Times Fooled Judge: ${player.timesFooledJudge}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    showJoinError(message) {
        this.elements.joinError.textContent = message;
        this.elements.joinError.classList.remove('hidden');
        setTimeout(() => {
            this.elements.joinError.classList.add('hidden');
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ClickbaitGame();
});
            