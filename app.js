const STORAGE_KEY = 'dice-scorekeeper-state';
const ROUND_HUNDREDS = [100, 200, 300, 400, 500, 600, 700, 800];
const BARREL_SCORE = 880;
const MAX_HISTORY = 10;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const DEFAULT_NAMES = ['Саша', 'Руслан'];

const state = {
  screen: 'home',
  selectedGame: null,
  players: [],
  currentPlayerIndex: 0,
  gameStatus: 'setup',
  winner: null,
  winners: null,
  pokerResults: null,
  history: [],
};

const app = document.getElementById('app');
const RESET_CARD_DURATION = 2000;
const SCORE_STEP = 5;

let gameMounted = false;
let lastBarrelMode = null;
let resetCardTimeout = null;
let resetCardEl = null;

function getNextHundred(score) {
  if (score >= BARREL_SCORE) return 0;
  if (score === 0) return 100;
  const next = Math.ceil(score / 100) * 100;
  if (next === score) return 100;
  return next - score;
}

function getToBarrel(score) {
  return score >= BARREL_SCORE ? 0 : BARREL_SCORE - score;
}

function isOnBarrel(player) {
  return player.score >= BARREL_SCORE;
}

function createGameSnapshot() {
  return {
    players: state.players.map((p) => ({ score: p.score, resets: p.resets })),
    currentPlayerIndex: state.currentPlayerIndex,
  };
}

function restoreGameSnapshot(snapshot) {
  snapshot.players.forEach((sp, i) => {
    state.players[i].score = sp.score;
    state.players[i].resets = sp.resets;
  });
  state.currentPlayerIndex = snapshot.currentPlayerIndex;
}

function addHistoryEntry(text, type = '', snapshot = null) {
  state.history.unshift({ text, type, snapshot });
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(0, MAX_HISTORY);
  }
}

function undoLastTysyachaMove() {
  if (!state.history.length) return;

  const entry = state.history[0];
  if (!entry.snapshot) return;

  if (!confirm('Отменить последний ход?')) return;

  restoreGameSnapshot(entry.snapshot);
  state.history.shift();
  saveState();
  updateGameScreen({ newHistory: false });
}

function getCurrentPlayer() {
  return state.players[state.currentPlayerIndex];
}

function nextPlayer() {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Не удалось сохранить состояние:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    return true;
  } catch (e) {
    console.warn('Не удалось загрузить состояние:', e);
    return false;
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function render() {
  switch (state.screen) {
    case 'home':
      renderHomeScreen();
      break;
    case 'setup':
      renderSetupScreen(state.selectedGame);
      break;
    case 'game':
      renderGameScreen();
      break;
    case 'poker-game':
      renderPokerGameScreen();
      break;
    case 'victory':
      renderVictoryScreen();
      break;
    case 'poker-victory':
      renderPokerWinnerScreen();
      break;
    default:
      renderHomeScreen();
  }
}

function renderHomeScreen() {
  gameMounted = false;
  pokerMounted = false;
  pokerSelectedCell = null;
  app.innerHTML = `
    <div class="screen screen-enter">
      <h1 class="screen-title">Кости</h1>
      <p class="screen-subtitle">Счёт для игр с костями</p>
      <div class="game-list">
        <button class="game-card" data-game="tysyacha">Тысяча</button>
        <button class="game-card" data-game="poker">Покер</button>
      </div>
    </div>
  `;

  app.querySelectorAll('.game-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedGame = btn.dataset.game;
      state.screen = 'setup';
      initDefaultPlayers(state.selectedGame);
      saveState();
      render();
    });
  });
}

function initDefaultPlayers(game) {
  if (game === 'poker') {
    state.players = DEFAULT_NAMES.map((name) => createPokerPlayer(name));
  } else {
    state.players = DEFAULT_NAMES.map((name) => ({
      name,
      score: 0,
      resets: 0,
    }));
  }
}

function createPlayerForGame(game, name) {
  if (game === 'poker') return createPokerPlayer(name);
  return { name, score: 0, resets: 0 };
}

function renderSetupScreen(gameName) {
  const title = gameName === 'tysyacha' ? 'Тысяча' : gameName === 'poker' ? 'Покер' : 'Настройка';
  const playerCount = state.players.length;

  gameMounted = false;
  app.innerHTML = `
    <div class="screen screen-enter">
      <h1 class="screen-title">${title}</h1>
      <p class="screen-subtitle">Настройка игроков</p>

      <div class="player-count-control">
        <button class="count-btn" id="btn-remove" ${playerCount <= MIN_PLAYERS ? 'disabled' : ''}>−</button>
        <span>${playerCount}</span>
        <button class="count-btn" id="btn-add" ${playerCount >= MAX_PLAYERS ? 'disabled' : ''}>+</button>
      </div>

      <div class="player-inputs" id="player-inputs">
        ${state.players.map((p, i) => `
          <div class="player-input-row">
            <label>${i + 1}.</label>
            <input class="input" type="text" data-index="${i}" value="${escapeHtml(p.name)}" placeholder="Имя игрока">
          </div>
        `).join('')}
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" id="btn-start">Начать игру</button>
        <button class="btn btn-secondary" id="btn-back">Назад к выбору игры</button>
      </div>
    </div>
  `;

  document.getElementById('btn-add').addEventListener('click', () => {
    syncPlayerNamesFromInputs();
    if (state.players.length < MAX_PLAYERS) {
      state.players.push(createPlayerForGame(gameName, `Игрок ${state.players.length + 1}`));
      saveState();
      renderSetupScreen(gameName);
    }
  });

  document.getElementById('btn-remove').addEventListener('click', () => {
    syncPlayerNamesFromInputs();
    if (state.players.length > MIN_PLAYERS) {
      state.players.pop();
      saveState();
      renderSetupScreen(gameName);
    }
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    syncPlayerNamesFromInputs();
    if (gameName === 'poker') startPokerGame();
    else startGame();
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    state.screen = 'home';
    state.selectedGame = null;
    saveState();
    render();
  });
}

function syncPlayerNamesFromInputs() {
  const inputs = document.querySelectorAll('#player-inputs .input');
  inputs.forEach((input) => {
    const idx = parseInt(input.dataset.index, 10);
    const name = input.value.trim() || `Игрок ${idx + 1}`;
    state.players[idx].name = name;
  });
}

function startGame() {
  gameMounted = false;
  state.players.forEach((p) => {
    p.score = 0;
    p.resets = 0;
  });
  state.currentPlayerIndex = 0;
  state.gameStatus = 'playing';
  state.winner = null;
  state.history = [];
  state.screen = 'game';
  saveState();
  render();
}

function checkHundredReset(player, snapshot) {
  if (!ROUND_HUNDREDS.includes(player.score)) return null;

  const snap = snapshot || createGameSnapshot();
  player.resets += 1;
  const isThirdReset = player.resets % 3 === 0;
  const newScore = isThirdReset ? 0 : 100;
  player.score = newScore;

  addHistoryEntry(
    `${player.name} сброс на сотне → ${newScore}`,
    'reset',
    snap
  );

  showResetCard(player.name, player.resets, newScore);

  return { resetNumber: player.resets, newScore };
}

function showResetCard(playerName, resetNumber, newScore) {
  if (!resetCardEl) {
    resetCardEl = document.createElement('div');
    resetCardEl.className = 'reset-overlay';
    resetCardEl.innerHTML = '<div class="reset-card" id="reset-card-content"></div>';
    document.body.appendChild(resetCardEl);
  }

  const content = document.getElementById('reset-card-content');
  content.innerHTML = `
    <div class="reset-card-icon">⚠️</div>
    <div class="reset-card-title">Сброс!</div>
    <div class="reset-card-player">${escapeHtml(playerName)}</div>
    <div class="reset-card-detail">${resetNumber}-й сброс на сотне</div>
    <div class="reset-card-score">→ ${newScore} очков</div>
  `;

  clearTimeout(resetCardTimeout);
  resetCardEl.classList.add('visible');

  resetCardTimeout = setTimeout(() => {
    resetCardEl.classList.remove('visible');
  }, RESET_CARD_DURATION);
}

function validateScore(points) {
  const trimmed = String(points).trim();
  if (trimmed === '') {
    return { valid: false, error: 'Введите количество очков' };
  }
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return { valid: false, error: 'Введите положительное число' };
  }
  if (parsed % SCORE_STEP !== 0) {
    return { valid: false, error: 'Очки должны быть кратны 5' };
  }
  return { valid: true, points: parsed };
}

function showScoreError(message) {
  const errorEl = document.getElementById('score-error');
  const input = document.getElementById('score-input');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  if (input) input.classList.add('invalid');
}

function clearScoreError() {
  const errorEl = document.getElementById('score-error');
  const input = document.getElementById('score-input');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (input) input.classList.remove('invalid');
}

function checkBarrel(player, wasOnBarrel) {
  if (!wasOnBarrel && isOnBarrel(player)) {
    addHistoryEntry(`${player.name} вышел на бочку`, 'barrel', createGameSnapshot());
  }
}

function addScore(points) {
  const validation = validateScore(points);
  if (!validation.valid) {
    showScoreError(validation.error);
    return false;
  }

  clearScoreError();
  const player = getCurrentPlayer();
  const parsed = validation.points;
  const wasOnBarrel = isOnBarrel(player);
  const snap = createGameSnapshot();
  player.score += parsed;

  addHistoryEntry(`${player.name} +${parsed} → ${player.score}`, 'score', snap);

  if (ROUND_HUNDREDS.includes(player.score)) {
    checkHundredReset(player, createGameSnapshot());
  }
  checkBarrel(player, wasOnBarrel);

  const prevIndex = state.currentPlayerIndex;
  nextPlayer();
  saveState();
  updateGameScreen({ bumpPlayerIndex: prevIndex, newHistory: true });
  return true;
}

function skipTurn() {
  const player = getCurrentPlayer();
  const snap = createGameSnapshot();
  addHistoryEntry(`${player.name} ничего`, 'skip', snap);
  nextPlayer();
  saveState();
  updateGameScreen({ newHistory: true });
}

function winGame() {
  const player = getCurrentPlayer();
  state.winner = player.name;
  state.gameStatus = 'finished';
  state.screen = 'victory';
  addHistoryEntry(`${player.name} выиграл(а)!`, 'win');
  saveState();
  renderVictoryScreen();
}

function resetGame() {
  gameMounted = false;
  state.screen = 'setup';
  state.gameStatus = 'setup';
  state.currentPlayerIndex = 0;
  state.winner = null;
  state.history = [];
  state.players.forEach((p) => {
    p.score = 0;
    p.resets = 0;
  });
  saveState();
  renderSetupScreen(state.selectedGame);
}

function goToHome() {
  gameMounted = false;
  pokerMounted = false;
  pokerSelectedCell = null;
  state.screen = 'home';
  state.selectedGame = null;
  state.gameStatus = 'setup';
  state.winner = null;
  state.winners = null;
  state.pokerResults = null;
  saveState();
  renderHomeScreen();
}

function playerCardHtml(p, i) {
  const active = i === state.currentPlayerIndex;
  const barrel = isOnBarrel(p);
  return `
    <div class="player-card ${active ? 'active' : ''} ${barrel ? 'barrel' : ''}" data-player-index="${i}">
      <div class="player-card-header">
        <span class="player-name">
          ${escapeHtml(p.name)}${barrel ? '<span class="player-badge">Бочка</span>' : ''}
        </span>
        <span class="player-score">${p.score}</span>
      </div>
      <div class="player-stats">
        <span class="player-stat">Сотня: <span class="player-stat-value">${getNextHundred(p.score)}</span></span>
        <span class="player-stat">Бочка: <span class="player-stat-value">${getToBarrel(p.score)}</span></span>
        <span class="player-stat">Сброс: <span class="player-stat-value">${p.resets}</span></span>
      </div>
    </div>
  `;
}

function turnPlayerBannerHtml(onBarrel) {
  const current = getCurrentPlayer();
  return `
    <div class="turn-player-banner ${onBarrel ? 'barrel-mode' : ''}" id="turn-player-banner">
      <div class="turn-player-banner-label">${onBarrel ? 'На бочке' : 'Сейчас ходит'}</div>
      <div class="turn-player-banner-name" id="turn-banner-name">${escapeHtml(current.name)}</div>
      <div class="turn-player-banner-score" id="turn-banner-score">${current.score} очков</div>
    </div>
  `;
}

function turnActionsHtml(onBarrel) {
  return `
    ${turnPlayerBannerHtml(onBarrel)}
    <div class="turn-actions-title">
      ${onBarrel ? 'Решение на бочке' : 'Очки за ход'}
    </div>
    ${onBarrel ? `
      <div class="btn-group">
        <button class="btn btn-primary" id="btn-win">Выигрыш</button>
        <button class="btn btn-secondary" id="btn-skip">Ничего</button>
      </div>
    ` : `
      <input
        class="score-input"
        id="score-input"
        type="tel"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        enterkeyhint="done"
        placeholder="0"
        value=""
      >
      <p class="score-error hidden" id="score-error" role="alert"></p>
      <div class="btn-row" style="margin-top: 10px;">
        <button class="btn btn-primary" id="btn-add-score">Добавить очки</button>
        <button class="btn btn-secondary" id="btn-skip">Ничего</button>
      </div>
    `}
  `;
}

function setInputFocused(focused) {
  const gameScreen = document.getElementById('game-screen');
  const turnActions = document.getElementById('turn-actions');
  const stickyBar = document.getElementById('turn-sticky-bar');
  if (!gameScreen) return;

  gameScreen.classList.toggle('input-focused', focused);
  if (turnActions) turnActions.classList.toggle('focused', focused);
  if (stickyBar) stickyBar.classList.toggle('visible', focused);
}

function bindTurnActionHandlers(onBarrel) {
  if (onBarrel) {
    document.getElementById('btn-win').addEventListener('click', winGame);
    document.getElementById('btn-skip').addEventListener('click', skipTurn);
  } else {
    const input = document.getElementById('score-input');

    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
      clearScoreError();
    });

    input.addEventListener('focus', () => {
      setInputFocused(true);
      const activeCard = document.querySelector('.player-card.active');
      if (activeCard) {
        setTimeout(() => {
          activeCard.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 300);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement?.id !== 'score-input') {
          setInputFocused(false);
        }
      }, 150);
    });

    document.getElementById('btn-add-score').addEventListener('click', () => {
      if (addScore(input.value)) input.value = '';
    });
    document.getElementById('btn-skip').addEventListener('click', () => {
      clearScoreError();
      skipTurn();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (addScore(input.value)) input.value = '';
      }
    });
  }
}

function bindGameActionHandlers() {
  document.getElementById('btn-new-game').addEventListener('click', () => {
    if (confirm('Начать новую игру? Текущий прогресс будет сброшен.')) {
      resetGame();
    }
  });
  document.getElementById('btn-home').addEventListener('click', goToHome);
}

function mountGameScreen() {
  const current = getCurrentPlayer();
  const onBarrel = isOnBarrel(current);
  lastBarrelMode = onBarrel;

  app.innerHTML = `
    <div class="screen game-screen screen-enter" id="game-screen">
      <div class="game-header">
        <h1 class="screen-title">Тысяча</h1>
      </div>

      <div class="current-turn ${onBarrel ? 'barrel-mode' : ''}" id="current-turn">
        <div class="current-turn-label">Сейчас ходит</div>
        <div class="current-turn-name" id="current-turn-name"></div>
      </div>

      <div class="players-list" id="players-list">
        ${state.players.map(playerCardHtml).join('')}
      </div>

      <div class="turn-sticky-bar" id="turn-sticky-bar" aria-live="polite">
        <span class="turn-sticky-dot"></span>
        <div class="turn-sticky-text">
          <span class="turn-sticky-label">Ходит</span>
          <span class="turn-sticky-name" id="turn-sticky-name"></span>
        </div>
        <span class="turn-sticky-score" id="turn-sticky-score"></span>
      </div>

      <div class="turn-actions" id="turn-actions">
        ${turnActionsHtml(onBarrel)}
      </div>

      <div class="history ${state.history.length === 0 ? 'hidden' : ''}" id="history-block">
        <div class="history-title">История</div>
        <ul class="history-list" id="history-list"></ul>
      </div>

      <div class="game-actions">
        <button class="btn btn-danger" id="btn-new-game">Новая игра</button>
        <button class="btn btn-secondary" id="btn-home">Назад к выбору игры</button>
      </div>
    </div>
  `;

  updateCurrentTurnUI();
  updateHistoryUI(false);
  bindTurnActionHandlers(onBarrel);
  bindGameActionHandlers();
  gameMounted = true;
}

function updateCurrentTurnUI() {
  const current = getCurrentPlayer();
  const onBarrel = isOnBarrel(current);
  const turnEl = document.getElementById('current-turn');
  const nameEl = document.getElementById('current-turn-name');

  if (turnEl) turnEl.classList.toggle('barrel-mode', onBarrel);
  if (nameEl) {
    nameEl.innerHTML = `
      ${escapeHtml(current.name)}${onBarrel ? '<span class="player-badge">Бочка</span>' : ''}
    `;
  }

  const stickyBar = document.getElementById('turn-sticky-bar');
  const stickyName = document.getElementById('turn-sticky-name');
  const stickyScore = document.getElementById('turn-sticky-score');
  const banner = document.getElementById('turn-player-banner');
  const bannerName = document.getElementById('turn-banner-name');
  const bannerScore = document.getElementById('turn-banner-score');

  if (stickyBar) stickyBar.classList.toggle('barrel-mode', onBarrel);
  if (stickyName) stickyName.textContent = current.name;
  if (stickyScore) stickyScore.textContent = `${current.score} очков`;
  if (banner) banner.classList.toggle('barrel-mode', onBarrel);
  if (bannerName) bannerName.textContent = current.name;
  if (bannerScore) bannerScore.textContent = `${current.score} очков`;
}

function updatePlayerCardUI(i, bumpScore) {
  const card = document.querySelector(`[data-player-index="${i}"]`);
  if (!card) return;

  const p = state.players[i];
  const active = i === state.currentPlayerIndex;
  const barrel = isOnBarrel(p);

  card.classList.toggle('active', active);
  card.classList.toggle('barrel', barrel);

  const nameEl = card.querySelector('.player-name');
  nameEl.innerHTML = `
    ${escapeHtml(p.name)}${barrel ? '<span class="player-badge">Бочка</span>' : ''}
  `;

  const scoreEl = card.querySelector('.player-score');
  scoreEl.textContent = p.score;
  if (bumpScore) {
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
  }

  const stats = card.querySelectorAll('.player-stat-value');
  stats[0].textContent = getNextHundred(p.score);
  stats[1].textContent = getToBarrel(p.score);
  stats[2].textContent = p.resets;
}

function updateHistoryUI(animateNew) {
  const block = document.getElementById('history-block');
  const list = document.getElementById('history-list');
  if (!block || !list) return;

  if (state.history.length === 0) {
    block.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  block.classList.remove('hidden');
  list.innerHTML = state.history.map((h, i) => `
    <li class="history-item ${h.type}${animateNew && i === 0 ? ' new-entry' : ''}">
      <span class="history-text">${escapeHtml(h.text)}</span>
      ${i === 0 && h.snapshot ? '<button class="history-undo" type="button" aria-label="Отменить ход">×</button>' : ''}
    </li>
  `).join('');

  const undoBtn = list.querySelector('.history-undo');
  if (undoBtn) undoBtn.addEventListener('click', undoLastTysyachaMove);
}

function updateTurnActionsIfNeeded() {
  const onBarrel = isOnBarrel(getCurrentPlayer());
  if (onBarrel === lastBarrelMode) return;

  lastBarrelMode = onBarrel;
  setInputFocused(false);
  const turnActions = document.getElementById('turn-actions');
  turnActions.innerHTML = turnActionsHtml(onBarrel);
  bindTurnActionHandlers(onBarrel);
  updateCurrentTurnUI();
}

function updateGameScreen({ bumpPlayerIndex, newHistory } = {}) {
  if (!gameMounted || !document.getElementById('game-screen')) {
    mountGameScreen();
    return;
  }

  updateCurrentTurnUI();
  state.players.forEach((_, i) => {
    updatePlayerCardUI(i, bumpPlayerIndex === i);
  });
  updateTurnActionsIfNeeded();
  updateHistoryUI(newHistory);
}

function renderGameScreen() {
  if (gameMounted && document.getElementById('game-screen')) {
    updateGameScreen();
  } else {
    mountGameScreen();
  }
}

function renderVictoryScreen() {
  gameMounted = false;
  app.innerHTML = `
    <div class="screen victory-screen screen-enter">
      <div class="victory-icon">🎉</div>
      <p class="victory-text">Победил(а) ${escapeHtml(state.winner)}</p>
      <div class="btn-group">
        <button class="btn btn-primary" id="btn-restart">Начать заново</button>
        <button class="btn btn-secondary" id="btn-home">Вернуться к выбору игры</button>
      </div>
    </div>
  `;

  document.getElementById('btn-restart').addEventListener('click', () => {
    resetGame();
  });

  document.getElementById('btn-home').addEventListener('click', () => {
    goToHome();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function init() {
  const loaded = loadState();

  if (loaded) {
    if (state.screen === 'game' && state.gameStatus === 'playing' && state.selectedGame === 'tysyacha') {
      renderGameScreen();
      return;
    }
    if (state.screen === 'poker-game' && state.gameStatus === 'playing' && state.selectedGame === 'poker') {
      renderPokerGameScreen();
      return;
    }
    if (state.screen === 'victory' && state.gameStatus === 'finished') {
      renderVictoryScreen();
      return;
    }
    if (state.screen === 'poker-victory' && state.gameStatus === 'finished') {
      renderPokerWinnerScreen();
      return;
    }
    if (state.screen === 'setup') {
      if (state.players.length === 0) initDefaultPlayers(state.selectedGame || 'tysyacha');
      renderSetupScreen(state.selectedGame);
      return;
    }
    if (state.screen === 'stub') {
      state.screen = 'home';
      state.selectedGame = null;
      saveState();
      renderHomeScreen();
      return;
    }
  }

  renderHomeScreen();
}

init();
