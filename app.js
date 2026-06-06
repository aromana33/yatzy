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
  history: [],
};

const app = document.getElementById('app');

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

function addHistoryEntry(text, type = '') {
  state.history.unshift({ text, type });
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(0, MAX_HISTORY);
  }
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
    case 'victory':
      renderVictoryScreen();
      break;
    case 'stub':
      renderStubScreen();
      break;
    default:
      renderHomeScreen();
  }
}

function renderHomeScreen() {
  app.innerHTML = `
    <div class="screen">
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
      const game = btn.dataset.game;
      if (game === 'poker') {
        state.screen = 'stub';
        state.selectedGame = 'poker';
        saveState();
        render();
        return;
      }
      state.selectedGame = game;
      state.screen = 'setup';
      if (state.players.length === 0) {
        initDefaultPlayers();
      }
      saveState();
      render();
    });
  });
}

function initDefaultPlayers() {
  state.players = DEFAULT_NAMES.map((name) => ({
    name,
    score: 0,
    resets: 0,
  }));
}

function renderSetupScreen(gameName) {
  const title = gameName === 'tysyacha' ? 'Тысяча' : 'Настройка';
  const playerCount = state.players.length;

  app.innerHTML = `
    <div class="screen">
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
      state.players.push({ name: `Игрок ${state.players.length + 1}`, score: 0, resets: 0 });
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
    startGame();
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

function checkHundredReset(player) {
  if (!ROUND_HUNDREDS.includes(player.score)) return false;

  player.resets += 1;
  const isThirdReset = player.resets % 3 === 0;
  const newScore = isThirdReset ? 0 : 100;
  const oldScore = player.score;
  player.score = newScore;

  addHistoryEntry(
    `${player.name} сброс на сотне → ${newScore}`,
    'reset'
  );

  return true;
}

function checkBarrel(player, wasOnBarrel) {
  if (!wasOnBarrel && isOnBarrel(player)) {
    addHistoryEntry(`${player.name} вышел на бочку`, 'barrel');
  }
}

function addScore(points) {
  const player = getCurrentPlayer();
  const parsed = parseInt(points, 10);

  if (isNaN(parsed) || parsed < 0) return;

  const wasOnBarrel = isOnBarrel(player);
  const oldScore = player.score;
  player.score += parsed;

  addHistoryEntry(`${player.name} +${parsed} → ${player.score}`);

  checkHundredReset(player);
  checkBarrel(player, wasOnBarrel);

  nextPlayer();
  saveState();
  renderGameScreen();
}

function skipTurn() {
  const player = getCurrentPlayer();
  addHistoryEntry(`${player.name} ничего`);
  nextPlayer();
  saveState();
  renderGameScreen();
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
  state.screen = 'home';
  state.selectedGame = null;
  state.gameStatus = 'setup';
  state.winner = null;
  saveState();
  renderHomeScreen();
}

function renderGameScreen() {
  const current = getCurrentPlayer();
  const onBarrel = isOnBarrel(current);

  app.innerHTML = `
    <div class="screen">
      <div class="game-header">
        <h1 class="screen-title">Тысяча</h1>
      </div>

      <div class="current-turn ${onBarrel ? 'barrel-mode' : ''}">
        <div class="current-turn-label">Сейчас ходит</div>
        <div class="current-turn-name">
          ${escapeHtml(current.name)}
          ${onBarrel ? '<span class="player-badge">Бочка</span>' : ''}
        </div>
      </div>

      <div class="players-list">
        ${state.players.map((p, i) => {
          const active = i === state.currentPlayerIndex;
          const barrel = isOnBarrel(p);
          return `
            <div class="player-card ${active ? 'active' : ''} ${barrel ? 'barrel' : ''}">
              <div class="player-card-header">
                <span class="player-name">
                  ${escapeHtml(p.name)}
                  ${barrel ? '<span class="player-badge">Бочка</span>' : ''}
                </span>
                <span class="player-score">${p.score}</span>
              </div>
              <div class="player-stats">
                <span>До сотни: <span class="player-stat-value">${getNextHundred(p.score)}</span></span>
                <span>До бочки: <span class="player-stat-value">${getToBarrel(p.score)}</span></span>
                <span>Сбросов: <span class="player-stat-value">${p.resets}</span></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="turn-actions">
        <div class="turn-actions-title">
          ${onBarrel ? 'Игрок на бочке' : 'Очки за ход'}
        </div>
        ${onBarrel ? `
          <div class="btn-group">
            <button class="btn btn-primary" id="btn-win">Выигрыш</button>
            <button class="btn btn-secondary" id="btn-skip">Ничего</button>
          </div>
        ` : `
          <input class="score-input" id="score-input" type="number" inputmode="numeric" pattern="[0-9]*" min="0" placeholder="0" value="">
          <div class="btn-row" style="margin-top: 12px;">
            <button class="btn btn-primary" id="btn-add-score">Добавить очки</button>
            <button class="btn btn-secondary" id="btn-skip">Ничего</button>
          </div>
        `}
      </div>

      ${state.history.length > 0 ? `
        <div class="history">
          <div class="history-title">История ходов</div>
          <ul class="history-list">
            ${state.history.map((h) => `
              <li class="history-item ${h.type}">${escapeHtml(h.text)}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="game-actions">
        <button class="btn btn-danger" id="btn-new-game">Новая игра</button>
        <button class="btn btn-secondary" id="btn-home">Назад к выбору игры</button>
      </div>
    </div>
  `;

  if (onBarrel) {
    document.getElementById('btn-win').addEventListener('click', winGame);
    document.getElementById('btn-skip').addEventListener('click', skipTurn);
  } else {
    const input = document.getElementById('score-input');
    document.getElementById('btn-add-score').addEventListener('click', () => {
      addScore(input.value);
    });
    document.getElementById('btn-skip').addEventListener('click', skipTurn);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addScore(input.value);
    });
  }

  document.getElementById('btn-new-game').addEventListener('click', () => {
    if (confirm('Начать новую игру? Текущий прогресс будет сброшен.')) {
      resetGame();
    }
  });

  document.getElementById('btn-home').addEventListener('click', goToHome);
}

function renderVictoryScreen() {
  app.innerHTML = `
    <div class="screen victory-screen">
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

function renderStubScreen() {
  app.innerHTML = `
    <div class="screen stub-screen">
      <h1 class="screen-title">Покер</h1>
      <p class="stub-text">Игра в разработке</p>
      <button class="btn btn-secondary" id="btn-back">Назад</button>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', () => {
    state.screen = 'home';
    state.selectedGame = null;
    saveState();
    render();
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
    if (state.screen === 'game' && state.gameStatus === 'playing') {
      renderGameScreen();
      return;
    }
    if (state.screen === 'victory' && state.gameStatus === 'finished') {
      renderVictoryScreen();
      return;
    }
    if (state.screen === 'setup') {
      if (state.players.length === 0) initDefaultPlayers();
      renderSetupScreen(state.selectedGame);
      return;
    }
    if (state.screen === 'stub') {
      renderStubScreen();
      return;
    }
  }

  renderHomeScreen();
}

init();
