/*
 * engine.js — pure game logic for Classic and Ultimate Tic-Tac-Toe.
 * No DOM access here; everything is plain data so it can be unit-tested in Node.
 * Attaches to globalThis.TTT so the same file works in the browser and in tests.
 */
(function (TTT) {
  'use strict';

  // The 8 winning lines on a 3x3 grid (indices 0..8, row-major).
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  // Given 9 cells, return the winning mark and line, or nulls.
  function lineWinner(cells) {
    for (let n = 0; n < LINES.length; n++) {
      const [a, b, c] = LINES[n];
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
        return { winner: cells[a], line: [a, b, c] };
      }
    }
    return { winner: null, line: null };
  }

  function isFull(cells) {
    for (let i = 0; i < cells.length; i++) if (!cells[i]) return false;
    return true;
  }

  function emptyIndices(cells) {
    const out = [];
    for (let i = 0; i < cells.length; i++) if (!cells[i]) out.push(i);
    return out;
  }

  const other = (mark) => (mark === 'X' ? 'O' : 'X');

  /* ---------------------------------------------------------------- Classic */

  function newClassic() {
    return {
      mode: 'classic',
      cells: new Array(9).fill(null),
      current: 'X',
      winner: null,   // 'X' | 'O' | 'draw' | null
      winLine: null,  // [a,b,c] | null
      over: false
    };
  }

  // Apply a move at index i for the current player. Returns true if it was legal.
  function classicMove(state, i) {
    if (state.over || state.cells[i]) return false;
    state.cells[i] = state.current;

    const res = lineWinner(state.cells);
    if (res.winner) {
      state.winner = res.winner;
      state.winLine = res.line;
      state.over = true;
    } else if (isFull(state.cells)) {
      state.winner = 'draw';
      state.over = true;
    } else {
      state.current = other(state.current);
    }
    return true;
  }

  /* -------------------------------------------------------------- Ultimate */
  /*
   * Ultimate Tic-Tac-Toe: a 3x3 meta-grid of nine 3x3 boards.
   * The cell you play (0..8) dictates which board your opponent must play next.
   * If that board is already won or full, the opponent may play anywhere.
   * Win three small boards in a line to win the game.
   */

  function newUltimate() {
    return {
      mode: 'ultimate',
      boards: Array.from({ length: 9 }, () => new Array(9).fill(null)),
      smallWin: new Array(9).fill(null),   // per board: 'X' | 'O' | 'draw' | null
      smallLine: new Array(9).fill(null),  // winning line within a won board
      active: null,    // forced board index, or null = play anywhere
      current: 'X',
      winner: null,
      winLine: null,   // winning line on the meta-grid
      over: false
    };
  }

  // Only X/O small wins count toward the meta-grid (draws are dead squares).
  function metaCells(state) {
    return state.smallWin.map((w) => (w === 'X' || w === 'O' ? w : null));
  }

  // Which boards may be played in right now.
  function ultimateValidBoards(state) {
    if (state.over) return [];
    const playable = (b) => !state.smallWin[b] && !isFull(state.boards[b]);
    if (state.active !== null && playable(state.active)) return [state.active];
    const out = [];
    for (let b = 0; b < 9; b++) if (playable(b)) out.push(b);
    return out;
  }

  // Play in cell c of board b for the current player. Returns true if legal.
  function ultimateMove(state, b, c) {
    if (state.over) return false;
    if (ultimateValidBoards(state).indexOf(b) === -1) return false;
    if (state.boards[b][c]) return false;

    state.boards[b][c] = state.current;

    // Resolve the small board.
    const res = lineWinner(state.boards[b]);
    if (res.winner) {
      state.smallWin[b] = res.winner;
      state.smallLine[b] = res.line;
    } else if (isFull(state.boards[b])) {
      state.smallWin[b] = 'draw';
    }

    // Did that small win complete a line on the meta-grid?
    if (state.smallWin[b] === 'X' || state.smallWin[b] === 'O') {
      const meta = lineWinner(metaCells(state));
      if (meta.winner) {
        state.winner = meta.winner;
        state.winLine = meta.line;
        state.over = true;
      }
    }

    // If every board is decided with no meta line, the player with more
    // small-board wins takes it (ties are draws).
    if (!state.over && state.smallWin.every(Boolean)) {
      let x = 0, o = 0;
      for (const w of state.smallWin) { if (w === 'X') x++; else if (w === 'O') o++; }
      state.winner = x > o ? 'X' : o > x ? 'O' : 'draw';
      state.over = true;
    }

    if (!state.over) {
      // The cell played points at the next board to send the opponent to.
      const target = c;
      state.active = (!state.smallWin[target] && !isFull(state.boards[target])) ? target : null;
      state.current = other(state.current);
    }
    return true;
  }

  function cloneUltimate(state) {
    return {
      mode: 'ultimate',
      boards: state.boards.map((b) => b.slice()),
      smallWin: state.smallWin.slice(),
      smallLine: state.smallLine.slice(),
      active: state.active,
      current: state.current,
      winner: state.winner,
      winLine: state.winLine ? state.winLine.slice() : null,
      over: state.over
    };
  }

  TTT.LINES = LINES;
  TTT.lineWinner = lineWinner;
  TTT.isFull = isFull;
  TTT.emptyIndices = emptyIndices;
  TTT.other = other;
  TTT.newClassic = newClassic;
  TTT.classicMove = classicMove;
  TTT.newUltimate = newUltimate;
  TTT.metaCells = metaCells;
  TTT.ultimateValidBoards = ultimateValidBoards;
  TTT.ultimateMove = ultimateMove;
  TTT.cloneUltimate = cloneUltimate;
})(globalThis.TTT = globalThis.TTT || {});
