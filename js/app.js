/*
 * app.js — UI controller. Wires the setup screen, renders the board(s),
 * drives turns (including the computer), tracks score, theme, and sound,
 * and fires confetti on a win.
 */
(function (TTT) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const STORE = 'ttt:v1';

  // ----- persisted settings + score ----------------------------------------
  const settings = {
    mode: 'classic',        // 'classic' | 'ultimate'
    opponent: 'cpu',        // 'cpu' | '2p'
    difficulty: 'impossible', // 'easy' | 'medium' | 'impossible'
    theme: 'dark',          // 'dark' | 'light'
    sound: true
  };
  let scores = {};          // keyed by `${mode}:${opponent}` -> {x,o,draw}

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
      Object.assign(settings, saved.settings || {});
      scores = saved.scores || {};
    } catch (e) { /* ignore corrupt storage */ }
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ settings, scores }));
    } catch (e) { /* storage may be unavailable */ }
  }
  function scoreKey() { return settings.mode + ':' + settings.opponent; }
  function currentScore() {
    return (scores[scoreKey()] = scores[scoreKey()] || { x: 0, o: 0, draw: 0 });
  }

  // ----- game state ---------------------------------------------------------
  const HUMAN = 'X';        // human is always X and moves first in vs-computer
  const CPU = 'O';
  let G = null;             // active engine state
  let last = null;          // last move, for the "pop" animation
  let busy = false;         // true while the computer is thinking

  // ----- elements ------------------------------------------------------------
  const el = {};
  function cacheEls() {
    ['setup', 'game', 'boardWrap', 'status', 'turnDot', 'startBtn', 'newGameBtn',
     'menuBtn', 'resetScoreBtn', 'themeBtn', 'soundBtn', 'difficultyField',
     'setupNote', 'scoreboard', 'sX', 'sO', 'sDraw', 'labelX', 'labelO'
    ].forEach((id) => { el[id] = document.getElementById(id); });
  }

  /* ============================ setup screen ============================== */

  function wireSegGroup(groupId, key, onChange) {
    const group = document.getElementById(groupId);
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg');
      if (!btn) return;
      group.querySelectorAll('.seg').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      settings[key] = btn.dataset.val;
      save();
      if (onChange) onChange();
    });
  }

  function syncSegGroup(groupId, value) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.seg').forEach((b) => {
      const on = b.dataset.val === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function refreshSetup() {
    // Difficulty only matters against the computer.
    el.difficultyField.classList.toggle('disabled', settings.opponent !== 'cpu');
    const notes = {
      classic: 'Classic 3×3. The Impossible computer plays a perfect game — the best you can hope for is a draw.',
      ultimate: 'Ultimate: nine boards in one. The square you pick decides which board your opponent must play next. Win three boards in a row to win.'
    };
    el.setupNote.textContent = notes[settings.mode];
  }

  function wireSetup() {
    wireSegGroup('modeGroup', 'mode', refreshSetup);
    wireSegGroup('oppGroup', 'opponent', refreshSetup);
    wireSegGroup('diffGroup', 'difficulty');
    syncSegGroup('modeGroup', settings.mode);
    syncSegGroup('oppGroup', settings.opponent);
    syncSegGroup('diffGroup', settings.difficulty);
    refreshSetup();
    el.startBtn.addEventListener('click', startGame);
  }

  /* ============================== controls =============================== */

  function wireControls() {
    el.newGameBtn.addEventListener('click', () => newRound());
    el.menuBtn.addEventListener('click', showSetup);
    el.resetScoreBtn.addEventListener('click', () => {
      scores[scoreKey()] = { x: 0, o: 0, draw: 0 };
      save();
      renderScore();
    });
    el.themeBtn.addEventListener('click', () => {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      save();
    });
    el.soundBtn.addEventListener('click', () => {
      settings.sound = !settings.sound;
      applySound();
      save();
    });
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    el.themeBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
    el.themeBtn.setAttribute('aria-label',
      settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  function applySound() {
    TTT.audio.setEnabled(settings.sound);
    el.soundBtn.textContent = settings.sound ? '🔊' : '🔇';
    el.soundBtn.setAttribute('aria-label', settings.sound ? 'Mute sound' : 'Unmute sound');
  }

  /* ============================ screens ================================== */

  function showSetup() {
    el.game.classList.add('hidden');
    el.setup.classList.remove('hidden');
  }

  function startGame() {
    el.setup.classList.add('hidden');
    el.game.classList.remove('hidden');
    el.game.dataset.mode = settings.mode;
    el.game.dataset.opponent = settings.opponent;

    // Score labels depend on who's playing.
    if (settings.opponent === 'cpu') {
      el.labelX.textContent = 'You';
      el.labelO.textContent = 'CPU';
    } else {
      el.labelX.textContent = 'X';
      el.labelO.textContent = 'O';
    }
    newRound();
  }

  function newRound() {
    G = settings.mode === 'classic' ? TTT.newClassic() : TTT.newUltimate();
    last = null;
    busy = false;
    render();
    renderScore();
    updateStatus();
  }

  /* ============================ turn flow ================================ */

  function humansTurn() {
    return settings.opponent === '2p' || G.current === HUMAN;
  }

  function onClassicCell(i) {
    if (busy || G.over || !humansTurn()) return;
    if (!TTT.classicMove(G, i)) return;
    last = { i };
    TTT.audio.sounds.place();
    afterMove();
  }

  function onUltimateCell(b, c) {
    if (busy || G.over || !humansTurn()) return;
    if (!TTT.ultimateMove(G, b, c)) return;
    last = { b, c };
    TTT.audio.sounds.place();
    afterMove();
  }

  function afterMove() {
    render();
    updateStatus();
    if (G.over) return endRound();
    if (settings.opponent === 'cpu' && G.current === CPU) {
      busy = true;
      render(); // re-render to lock the board while "thinking"
      updateStatus();
      setTimeout(cpuMove, 360 + Math.random() * 240);
    }
  }

  function cpuMove() {
    if (settings.mode === 'classic') {
      const i = TTT.classicAIMove(G.cells, CPU, HUMAN, settings.difficulty);
      if (i != null) { TTT.classicMove(G, i); last = { i }; }
    } else {
      const m = TTT.ultimateAIMove(G, CPU, HUMAN, settings.difficulty);
      if (m) { TTT.ultimateMove(G, m[0], m[1]); last = { b: m[0], c: m[1] }; }
    }
    busy = false;
    TTT.audio.sounds.place();
    render();
    updateStatus();
    if (G.over) endRound();
  }

  function endRound() {
    const s = currentScore();
    if (G.winner === 'draw') s.draw++;
    else if (G.winner === 'X') s.x++;
    else s.o++;
    save();
    renderScore();

    if (G.winner === 'draw') {
      TTT.audio.sounds.draw();
      return;
    }
    const humanWon = settings.opponent === '2p' || G.winner === HUMAN;
    if (humanWon) { TTT.audio.sounds.win(); confettiBurst(); }
    else TTT.audio.sounds.lose();
  }

  /* ============================ status / score ========================== */

  function name(mark) {
    if (settings.opponent === 'cpu') return mark === HUMAN ? 'You' : 'Computer';
    return 'Player ' + mark;
  }

  function updateStatus() {
    let text;
    if (!G.over) {
      if (busy) text = 'Computer is thinking…';
      else if (settings.opponent === 'cpu' && G.current === HUMAN) text = 'Your move';
      else text = name(G.current) + ' · ' + G.current;
    } else if (G.winner === 'draw') {
      text = "It's a draw 🤝";
    } else if (settings.opponent === 'cpu') {
      text = G.winner === HUMAN ? 'You win! 🎉' : 'Computer wins 🤖';
    } else {
      text = 'Player ' + G.winner + ' wins! 🎉';
    }
    el.status.textContent = text;
    el.turnDot.dataset.mark = G.over ? (G.winner || '') : G.current;
    el.game.classList.toggle('over', G.over);
  }

  function renderScore() {
    const s = currentScore();
    el.sX.textContent = s.x;
    el.sO.textContent = s.o;
    el.sDraw.textContent = s.draw;
  }

  /* ============================ rendering =============================== */

  function render() {
    if (settings.mode === 'classic') renderClassic();
    else renderUltimate();
  }

  // Hand-struck marks as SVG; pathLength="1" lets the stroke "draw itself in".
  function glyph(mark) {
    if (mark === 'X') {
      return '<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">' +
        '<line pathLength="1" x1="26" y1="26" x2="74" y2="74"/>' +
        '<line pathLength="1" x1="74" y1="26" x2="26" y2="74"/></svg>';
    }
    return '<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle pathLength="1" cx="50" cy="50" r="27"/></svg>';
  }

  function renderClassic() {
    const board = document.createElement('div');
    board.className = 'board classic';
    board.setAttribute('role', 'grid');
    if (humansTurn() && !G.over && !busy) board.dataset.current = G.current;

    for (let i = 0; i < 9; i++) {
      const v = G.cells[i];
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      if (v) {
        cell.innerHTML = glyph(v);
        cell.classList.add('filled', 'mark-' + v.toLowerCase());
      }
      if (G.winLine && G.winLine.indexOf(i) !== -1) cell.classList.add('win');
      if (last && last.i === i && !('b' in last)) cell.classList.add('pop');
      cell.disabled = !!v || G.over || busy || !humansTurn();
      cell.setAttribute('aria-label', 'Cell ' + (i + 1) + (v ? ', ' + v : ', empty'));
      cell.addEventListener('click', () => onClassicCell(i));
      board.appendChild(cell);
    }
    swapBoard(board);
    enableArrowNav(board);
  }

  function renderUltimate() {
    const valid = TTT.ultimateValidBoards(G);
    const board = document.createElement('div');
    board.className = 'board ultimate';

    for (let b = 0; b < 9; b++) {
      const mini = document.createElement('div');
      mini.className = 'mini';
      const decided = G.smallWin[b];
      if (decided) {
        mini.classList.add('decided');
        mini.classList.add('won-' + (decided === 'draw' ? 'draw' : decided.toLowerCase()));
      } else if (valid.indexOf(b) !== -1 && !G.over) {
        mini.classList.add('active');
      }
      if (G.winLine && G.winLine.indexOf(b) !== -1) mini.classList.add('metawin');

      for (let c = 0; c < 9; c++) {
        const v = G.boards[b][c];
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.type = 'button';
        if (v) {
          cell.innerHTML = glyph(v);
          cell.classList.add('filled', 'mark-' + v.toLowerCase());
        }
        if (G.smallLine[b] && decided !== 'draw' && G.smallLine[b].indexOf(c) !== -1) {
          cell.classList.add('win');
        }
        if (last && last.b === b && last.c === c) cell.classList.add('pop');
        const playable = !G.over && !busy && valid.indexOf(b) !== -1 && !v && humansTurn();
        cell.disabled = !playable;
        cell.setAttribute('aria-label',
          'Board ' + (b + 1) + ', cell ' + (c + 1) + (v ? ', ' + v : ''));
        cell.addEventListener('click', () => onUltimateCell(b, c));
        mini.appendChild(cell);
      }

      if (decided && decided !== 'draw') {
        const ov = document.createElement('div');
        ov.className = 'mini-overlay mark-' + decided.toLowerCase();
        ov.innerHTML = glyph(decided);
        mini.appendChild(ov);
      }
      board.appendChild(mini);
    }
    swapBoard(board);
  }

  function swapBoard(board) {
    el.boardWrap.innerHTML = '';
    el.boardWrap.appendChild(board);
  }

  // Arrow-key navigation across the 3x3 classic grid for keyboard players.
  function enableArrowNav(board) {
    board.addEventListener('keydown', (e) => {
      const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -3, ArrowDown: 3 };
      if (!(e.key in deltas)) return;
      const cells = Array.from(board.querySelectorAll('.cell'));
      const idx = cells.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      let n = idx + deltas[e.key];
      if (e.key === 'ArrowRight' && idx % 3 === 2) n = idx;
      if (e.key === 'ArrowLeft' && idx % 3 === 0) n = idx;
      if (n < 0 || n > 8) n = idx;
      (cells[n] || cells[idx]).focus();
    });
  }

  /* ============================= confetti =============================== */

  function confettiBurst() {
    const canvas = document.getElementById('confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * DPR;
    canvas.height = window.innerHeight * DPR;

    const colors = ['#ff6b81', '#ffd166', '#4dd4f0', '#5ad19a', '#9b8cff', '#ff9ff3'];
    const parts = [];
    const cx = canvas.width / 2;
    for (let i = 0; i < 150; i++) {
      const angle = (Math.PI * 2 * i) / 150 + Math.random();
      const speed = (Math.random() * 9 + 4) * DPR;
      parts.push({
        x: cx + (Math.random() - 0.5) * canvas.width * 0.4,
        y: canvas.height * 0.28,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6 * DPR,
        g: 0.32 * DPR,
        size: (Math.random() * 6 + 4) * DPR,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4
      });
    }
    let frames = 0;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
        if (p.y < canvas.height + 60) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      frames++;
      if (alive && frames < 280) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    tick();
  }

  /* ============================== init ================================== */

  function init() {
    cacheEls();
    load();
    applyTheme();
    applySound();
    wireSetup();
    wireControls();
    showSetup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(globalThis.TTT = globalThis.TTT || {});
