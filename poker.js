/* Poker scorekeeper — loaded before app.js */

const POKER_SCHOOL_IDS = ['1', '2', '3', '4', '5', '6'];

const POKER_COMBO_ROWS = [
  { id: 'para', label: 'Пара' },
  { id: 'dve_pary', label: 'Две пары' },
  { id: 'troynik', label: 'Тройник' },
  { id: 'strit_maly', label: 'Стрит малый +15 (30/45)' },
  { id: 'strit_bolshoy', label: 'Стрит большой +20 (40/60)' },
  { id: 'full', label: 'Фулл +15' },
  { id: 'kare', label: 'Каре +20' },
  { id: 'poker', label: 'Покер +50' },
  { id: 'musor', label: 'Мусор +30' },
];

const POKER_SCHOOL_TURNS_LIMIT = 3;

let pokerMounted = false;
let pokerSelectedCell = null;

function createPokerPlayer(name) {
  const school = {};
  POKER_SCHOOL_IDS.forEach((id) => { school[id] = null; });
  const combinations = {};
  POKER_COMBO_ROWS.forEach((row) => { combinations[row.id] = null; });
  return { name, school, combinations, turns: 0 };
}

function getPokerRowLabel(rowId, section) {
  if (section === 'school') return `школа ${rowId}`;
  const row = POKER_COMBO_ROWS.find((r) => r.id === rowId);
  return row ? row.label.toLowerCase() : rowId;
}

function getPokerCellValue(player, rowId, section) {
  return section === 'school' ? player.school[rowId] : player.combinations[rowId];
}

function setPokerCellValue(player, rowId, section, value) {
  if (section === 'school') player.school[rowId] = value;
  else player.combinations[rowId] = value;
}

function calculateSchoolSum(player) {
  return POKER_SCHOOL_IDS.reduce((sum, id) => {
    const v = player.school[id];
    return v !== null ? sum + v : sum;
  }, 0);
}

function calculateSchoolResult(player) {
  const sum = calculateSchoolSum(player);
  return sum >= 0 ? sum : sum - 50;
}

function calculatePokerCombinationsSum(player) {
  return POKER_COMBO_ROWS.reduce((sum, row) => {
    const v = player.combinations[row.id];
    return v !== null ? sum + v : sum;
  }, 0);
}

function calculatePokerTotal(player) {
  return calculateSchoolResult(player) + calculatePokerCombinationsSum(player);
}

function getAvailablePokerRows(player) {
  const rows = [];
  POKER_SCHOOL_IDS.forEach((id) => {
    if (player.school[id] === null) rows.push({ id, section: 'school' });
  });
  if (player.turns >= POKER_SCHOOL_TURNS_LIMIT) {
    POKER_COMBO_ROWS.forEach((row) => {
      if (player.combinations[row.id] === null) rows.push({ id: row.id, section: 'combo' });
    });
  }
  return rows;
}

function isPlayerPokerComplete(player) {
  const schoolDone = POKER_SCHOOL_IDS.every((id) => player.school[id] !== null);
  const combosDone = POKER_COMBO_ROWS.every((row) => player.combinations[row.id] !== null);
  return schoolDone && combosDone;
}

function isPokerGameFinished() {
  return state.players.every(isPlayerPokerComplete);
}

function parsePokerScore(value) {
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed === '-') {
    return { valid: false, error: 'Введите очки' };
  }
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed)) {
    return { valid: false, error: 'Введите целое число' };
  }
  return { valid: true, points: parsed };
}

function maybeLogSchoolResult(player) {
  const allFilled = POKER_SCHOOL_IDS.every((id) => player.school[id] !== null);
  if (allFilled) {
    addHistoryEntry(
      `${player.name}: результат школы = ${calculateSchoolResult(player)}`,
      'school'
    );
  }
}

function addPokerScore(playerIndex, rowId, section, value) {
  const player = state.players[playerIndex];
  const validation = parsePokerScore(value);
  if (!validation.valid) return { ok: false, error: validation.error };

  const isEdit = getPokerCellValue(player, rowId, section) !== null;
  setPokerCellValue(player, rowId, section, validation.points);

  const label = getPokerRowLabel(rowId, section);
  addHistoryEntry(`${player.name}: ${label} = ${validation.points}`, section === 'school' ? 'school' : 'combo');

  if (section === 'school') maybeLogSchoolResult(player);

  if (!isEdit) player.turns += 1;

  pokerSelectedCell = null;
  nextPlayer();
  saveState();

  if (isPokerGameFinished()) {
    finishPokerGame();
    return { ok: true, finished: true };
  }

  renderPokerGameScreen();
  return { ok: true };
}

function skipPokerTurn() {
  const player = getCurrentPlayer();
  player.turns += 1;
  addHistoryEntry(`${player.name}: пропуск`, 'skip');
  pokerSelectedCell = null;
  nextPlayer();
  saveState();
  renderPokerGameScreen();
}

function finishPokerGame() {
  const totals = state.players.map((p) => ({
    name: p.name,
    total: calculatePokerTotal(p),
  }));
  const maxTotal = Math.max(...totals.map((t) => t.total));
  const winners = totals.filter((t) => t.total === maxTotal).map((t) => t.name);

  state.pokerResults = totals;
  state.winners = winners;
  state.winner = winners.length === 1 ? winners[0] : null;
  state.gameStatus = 'finished';
  state.screen = 'poker-victory';
  saveState();
  renderPokerWinnerScreen();
}

function startPokerGame() {
  pokerMounted = false;
  pokerSelectedCell = null;
  state.players = state.players.map((p) => createPokerPlayer(p.name));
  state.currentPlayerIndex = 0;
  state.gameStatus = 'playing';
  state.winner = null;
  state.winners = null;
  state.pokerResults = null;
  state.history = [];
  state.screen = 'poker-game';
  saveState();
  renderPokerGameScreen();
}

function resetPokerGame() {
  pokerMounted = false;
  pokerSelectedCell = null;
  state.screen = 'setup';
  state.gameStatus = 'setup';
  state.currentPlayerIndex = 0;
  state.winner = null;
  state.winners = null;
  state.pokerResults = null;
  state.history = [];
  state.players = state.players.map((p) => createPokerPlayer(p.name));
  saveState();
  renderPokerSetupScreen();
}

function handlePokerCellClick(playerIndex, rowId, section) {
  if (playerIndex !== state.currentPlayerIndex) return;

  const player = state.players[playerIndex];
  const value = getPokerCellValue(player, rowId, section);
  const available = getAvailablePokerRows(player);
  const isAvailable = available.some((r) => r.id === rowId && r.section === section);

  if (value === null && !isAvailable) return;

  if (value !== null) {
    const label = section === 'school' ? `школу ${rowId}` : getPokerRowLabel(rowId, section);
    if (!confirm(`Изменить значение в «${label}»?`)) return;
  }

  pokerSelectedCell = { playerIndex, rowId, section, currentValue: value };
  renderPokerGameScreen();
}

function renderPokerSetupScreen() {
  renderSetupScreen('poker');
}

function pokerCellClass(playerIndex, rowId, section) {
  const player = state.players[playerIndex];
  const value = getPokerCellValue(player, rowId, section);
  const isCurrent = playerIndex === state.currentPlayerIndex;
  const available = getAvailablePokerRows(player);
  const canFill = isCurrent && available.some((r) => r.id === rowId && r.section === section);
  const selected = pokerSelectedCell
    && pokerSelectedCell.playerIndex === playerIndex
    && pokerSelectedCell.rowId === rowId
    && pokerSelectedCell.section === section;

  const classes = ['poker-cell'];
  if (isCurrent) classes.push('current-player-col');
  if (value !== null) classes.push('filled');
  else classes.push('empty');
  if (canFill) classes.push('available');
  if (selected) classes.push('selected');
  if (value !== null && value < 0) classes.push('negative');
  return classes.join(' ');
}

function renderPokerInputSheet() {
  if (!pokerSelectedCell) return '';

  const { rowId, section, currentValue } = pokerSelectedCell;
  const label = section === 'school'
    ? `Школа — ${rowId}`
    : POKER_COMBO_ROWS.find((r) => r.id === rowId).label;

  return `
    <div class="poker-sheet-overlay" id="poker-sheet">
      <div class="poker-sheet">
        <div class="poker-sheet-title">${escapeHtml(label)}</div>
        <input
          class="score-input poker-score-input"
          id="poker-score-input"
          type="tel"
          inputmode="numeric"
          autocomplete="off"
          enterkeyhint="done"
          placeholder="0"
          value="${currentValue !== null ? currentValue : ''}"
        >
        <p class="score-error hidden" id="poker-score-error" role="alert"></p>
        <div class="btn-row">
          <button class="btn btn-primary" id="poker-btn-save">Сохранить</button>
          <button class="btn btn-secondary" id="poker-btn-cancel">Отмена</button>
        </div>
      </div>
    </div>
  `;
}

function bindPokerInputSheet() {
  if (!pokerSelectedCell) return;

  const input = document.getElementById('poker-score-input');
  const errorEl = document.getElementById('poker-score-error');

  input.addEventListener('input', () => {
    const raw = input.value;
    if (raw === '' || raw === '-') return;
    input.value = raw.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
    errorEl.classList.add('hidden');
    input.classList.remove('invalid');
  });

  const save = () => {
    const { playerIndex, rowId, section } = pokerSelectedCell;
    const result = addPokerScore(playerIndex, rowId, section, input.value);
    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.classList.remove('hidden');
      input.classList.add('invalid');
    }
  };

  document.getElementById('poker-btn-save').addEventListener('click', save);
  document.getElementById('poker-btn-cancel').addEventListener('click', () => {
    pokerSelectedCell = null;
    renderPokerGameScreen();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });

  setTimeout(() => input.focus(), 50);
}

function renderPokerTableBody() {
  let html = '';

  html += `<tr class="poker-section-row"><td class="poker-sticky-col" colspan="${state.players.length + 1}">Школа</td></tr>`;

  POKER_SCHOOL_IDS.forEach((id) => {
    html += `<tr class="poker-data-row">
      <td class="poker-sticky-col poker-row-label">${id}</td>
      ${state.players.map((p, pi) => {
        const val = p.school[id];
        return `<td class="${pokerCellClass(pi, id, 'school')}" data-pi="${pi}" data-row="${id}" data-section="school">
          ${val !== null ? val : '·'}
        </td>`;
      }).join('')}
    </tr>`;
  });

  html += `<tr class="poker-summary-row">
    <td class="poker-sticky-col">Сумма по школе</td>
    ${state.players.map((p) => `<td>${calculateSchoolSum(p)}</td>`).join('')}
  </tr>`;
  html += `<tr class="poker-summary-row poker-summary-highlight">
    <td class="poker-sticky-col">Результат школы</td>
    ${state.players.map((p) => `<td>${calculateSchoolResult(p)}</td>`).join('')}
  </tr>`;

  html += `<tr class="poker-section-row"><td class="poker-sticky-col" colspan="${state.players.length + 1}">Комбинации</td></tr>`;

  POKER_COMBO_ROWS.forEach((row) => {
    html += `<tr class="poker-data-row">
      <td class="poker-sticky-col poker-row-label poker-row-label-long">${escapeHtml(row.label)}</td>
      ${state.players.map((p, pi) => {
        const val = p.combinations[row.id];
        return `<td class="${pokerCellClass(pi, row.id, 'combo')}" data-pi="${pi}" data-row="${row.id}" data-section="combo">
          ${val !== null ? val : '·'}
        </td>`;
      }).join('')}
    </tr>`;
  });

  html += `<tr class="poker-summary-row">
    <td class="poker-sticky-col">Сумма комбинаций</td>
    ${state.players.map((p) => `<td>${calculatePokerCombinationsSum(p)}</td>`).join('')}
  </tr>`;

  return html;
}

function renderPokerGameScreen() {
  const current = getCurrentPlayer();
  const turnHint = current.turns < POKER_SCHOOL_TURNS_LIMIT
    ? `Ход ${current.turns + 1} из ${POKER_SCHOOL_TURNS_LIMIT} — только школа`
    : 'Можно заполнять школу и комбинации';

  app.innerHTML = `
    <div class="screen poker-screen screen-enter" id="poker-screen">
      <div class="game-header">
        <h1 class="screen-title">Покер</h1>
      </div>

      <div class="current-turn" id="poker-current-turn">
        <div class="current-turn-label">Сейчас ходит</div>
        <div class="current-turn-name">${escapeHtml(current.name)}</div>
        <div class="poker-turn-hint">${turnHint}</div>
      </div>

      <div class="poker-totals-bar">
        ${state.players.map((p, i) => `
          <div class="poker-total-chip ${i === state.currentPlayerIndex ? 'active' : ''}">
            <span class="poker-total-name">${escapeHtml(p.name)}</span>
            <span class="poker-total-value">${calculatePokerTotal(p)}</span>
          </div>
        `).join('')}
      </div>

      <div class="poker-table-wrap">
        <table class="poker-table">
          <thead>
            <tr>
              <th class="poker-sticky-col poker-corner"></th>
              ${state.players.map((p, i) => `
                <th class="poker-player-head ${i === state.currentPlayerIndex ? 'active' : ''}">${escapeHtml(p.name)}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${renderPokerTableBody()}
            <tr class="poker-total-row">
              <td class="poker-sticky-col">Итог</td>
              ${state.players.map((p) => `<td class="poker-total-cell">${calculatePokerTotal(p)}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>

      <div class="poker-turn-actions">
        <button class="btn btn-secondary" id="poker-btn-skip">Пропуск</button>
        <button class="btn btn-primary" id="poker-btn-finish">Завершить игру</button>
      </div>

      <div class="history ${state.history.length === 0 ? 'hidden' : ''}" id="history-block">
        <div class="history-title">История</div>
        <ul class="history-list">
          ${state.history.map((h) => `<li class="history-item ${h.type}">${escapeHtml(h.text)}</li>`).join('')}
        </ul>
      </div>

      <div class="game-actions">
        <button class="btn btn-danger" id="poker-btn-new">Новая игра</button>
        <button class="btn btn-secondary" id="poker-btn-home">Назад к выбору игры</button>
      </div>

      ${renderPokerInputSheet()}
    </div>
  `;

  app.querySelectorAll(`[data-pi="${state.currentPlayerIndex}"].poker-cell`).forEach((cell) => {
    if (cell.classList.contains('available') || cell.classList.contains('filled')) {
      cell.addEventListener('click', () => {
        handlePokerCellClick(state.currentPlayerIndex, cell.dataset.row, cell.dataset.section);
      });
    }
  });

  document.getElementById('poker-btn-skip').addEventListener('click', skipPokerTurn);
  document.getElementById('poker-btn-finish').addEventListener('click', () => {
    if (confirm('Завершить игру и показать результаты?')) finishPokerGame();
  });
  document.getElementById('poker-btn-new').addEventListener('click', () => {
    if (confirm('Начать новую игру? Текущий прогресс будет сброшен.')) resetPokerGame();
  });
  document.getElementById('poker-btn-home').addEventListener('click', () => {
    pokerMounted = false;
    pokerSelectedCell = null;
    goToHome();
  });

  bindPokerInputSheet();
  pokerMounted = true;
}

function renderPokerWinnerScreen() {
  pokerMounted = false;
  const isTie = state.winners && state.winners.length > 1;

  app.innerHTML = `
    <div class="screen victory-screen screen-enter">
      <div class="victory-icon">🎉</div>
      <p class="victory-text">
        ${isTie
          ? `Ничья!<br>${state.winners.map(escapeHtml).join(', ')}`
          : `Победил(а) ${escapeHtml(state.winner)}`}
      </p>

      <div class="poker-final-results">
        ${state.pokerResults.map((r) => `
          <div class="poker-final-row ${!isTie && r.name === state.winner ? 'winner' : ''} ${isTie && state.winners.includes(r.name) ? 'winner' : ''}">
            <span>${escapeHtml(r.name)}</span>
            <span class="poker-final-score">${r.total}</span>
          </div>
        `).join('')}
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" id="btn-restart">Начать заново</button>
        <button class="btn btn-secondary" id="btn-home">Вернуться к выбору игры</button>
      </div>
    </div>
  `;

  document.getElementById('btn-restart').addEventListener('click', resetPokerGame);
  document.getElementById('btn-home').addEventListener('click', goToHome);
}
