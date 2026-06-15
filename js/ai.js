/*
 * ai.js — computer opponents for both modes. Depends on engine.js.
 *
 * Classic uses full minimax with alpha-beta pruning, so "Impossible" is
 * provably unbeatable (the best you can do is draw).
 *
 * Ultimate's game tree is far too large to solve, so it uses a heuristic
 * evaluation with a shallow look-ahead — strong, but not perfect.
 */
(function (TTT) {
  'use strict';

  const { LINES, lineWinner, isFull, emptyIndices, ultimateValidBoards,
          ultimateMove, cloneUltimate } = TTT;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------------------------------------------------------- Classic AI */

  // Score is relative to `ai`: +ve good for ai. Depth nudges it toward the
  // quickest win and the slowest loss.
  function minimax(cells, depth, isMax, ai, human, alpha, beta) {
    const res = lineWinner(cells);
    if (res.winner === ai) return 10 - depth;
    if (res.winner === human) return depth - 10;
    if (isFull(cells)) return 0;

    const moves = emptyIndices(cells);
    if (isMax) {
      let best = -Infinity;
      for (const i of moves) {
        cells[i] = ai;
        best = Math.max(best, minimax(cells, depth + 1, false, ai, human, alpha, beta));
        cells[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const i of moves) {
      cells[i] = human;
      best = Math.min(best, minimax(cells, depth + 1, true, ai, human, alpha, beta));
      cells[i] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  function classicBestMove(cells, ai, human) {
    let bestScore = -Infinity;
    const best = [];
    for (const i of emptyIndices(cells)) {
      cells[i] = ai;
      const score = minimax(cells, 0, false, ai, human, -Infinity, Infinity);
      cells[i] = null;
      if (score > bestScore) { bestScore = score; best.length = 0; best.push(i); }
      else if (score === bestScore) best.push(i);
    }
    return best.length ? pick(best) : null;
  }

  // Difficulty is modeled as a chance of playing a random move instead of the
  // optimal one — a natural, beatable opponent at lower levels.
  function classicAIMove(cells, ai, human, difficulty) {
    const moves = emptyIndices(cells);
    if (!moves.length) return null;
    const slip = difficulty === 'easy' ? 0.8 : difficulty === 'medium' ? 0.4 : 0;
    if (slip && Math.random() < slip) return pick(moves);
    return classicBestMove(cells, ai, human);
  }

  /* --------------------------------------------------------- Ultimate AI */

  // Heuristic value of a single 3x3 board for `p` (vs `o`), looking at how
  // close each line is to completion.
  function evalSmall(cells, p, o) {
    let s = 0;
    for (const [a, b, c] of LINES) {
      let pc = 0, oc = 0;
      for (const v of [cells[a], cells[b], cells[c]]) {
        if (v === p) pc++; else if (v === o) oc++;
      }
      if (pc && oc) continue;            // line is dead — no one can win it
      if (pc === 3) s += 100;
      else if (pc === 2) s += 6;
      else if (pc === 1) s += 1;
      if (oc === 3) s -= 100;
      else if (oc === 2) s -= 6;
      else if (oc === 1) s -= 1;
    }
    return s;
  }

  // Center board / center cells matter more, so weight the meta-grid.
  const BOARD_WEIGHT = [1.4, 1, 1.4, 1, 1.75, 1, 1.4, 1, 1.4];

  function evaluateUltimate(state, ai, human) {
    let score = 0;
    for (let b = 0; b < 9; b++) {
      const w = state.smallWin[b];
      if (w === 'draw') continue;
      if (w === ai) score += 30 * BOARD_WEIGHT[b];
      else if (w === human) score -= 30 * BOARD_WEIGHT[b];
      else score += 0.3 * BOARD_WEIGHT[b] * evalSmall(state.boards[b], ai, human);
    }
    // Pressure on the meta-grid lines.
    const meta = state.smallWin.map((w) => (w === 'X' || w === 'O' ? w : null));
    for (const [a, b, c] of LINES) {
      let pc = 0, oc = 0;
      for (const v of [meta[a], meta[b], meta[c]]) {
        if (v === ai) pc++; else if (v === human) oc++;
      }
      if (pc && oc) continue;
      if (pc === 2) score += 40; else if (pc === 1) score += 8;
      if (oc === 2) score -= 40; else if (oc === 1) score -= 8;
    }
    return score;
  }

  function ultimateMoves(state) {
    const out = [];
    for (const b of ultimateValidBoards(state)) {
      for (const c of emptyIndices(state.boards[b])) out.push([b, c]);
    }
    return out;
  }

  const WIN = 1e6, LOSS = -1e6;

  function searchUltimate(state, depth, ai, human) {
    if (state.over) return state.winner === ai ? WIN : state.winner === human ? LOSS : 0;
    if (depth <= 0) return evaluateUltimate(state, ai, human);
    const moves = ultimateMoves(state);
    if (!moves.length) return evaluateUltimate(state, ai, human);

    const maximizing = state.current === ai;
    let best = maximizing ? -Infinity : Infinity;
    for (const [b, c] of moves) {
      const next = cloneUltimate(state);
      ultimateMove(next, b, c);
      const val = searchUltimate(next, depth - 1, ai, human);
      best = maximizing ? Math.max(best, val) : Math.min(best, val);
    }
    return best;
  }

  function ultimateAIMove(state, ai, human, difficulty) {
    const moves = ultimateMoves(state);
    if (!moves.length) return null;
    if (difficulty === 'easy') return pick(moves);

    // Impossible looks one reply ahead; medium is greedy on the heuristic.
    const depth = difficulty === 'impossible' ? 1 : 0;
    let bestVal = -Infinity;
    let best = [];
    for (const [b, c] of moves) {
      const next = cloneUltimate(state);
      ultimateMove(next, b, c);
      const val = searchUltimate(next, depth, ai, human);
      if (val > bestVal) { bestVal = val; best = [[b, c]]; }
      else if (val === bestVal) best.push([b, c]);
    }
    // Keep medium fallible (and break ties unpredictably).
    if (difficulty === 'medium' && Math.random() < 0.25) return pick(moves);
    return pick(best);
  }

  TTT.classicBestMove = classicBestMove;
  TTT.classicAIMove = classicAIMove;
  TTT.evaluateUltimate = evaluateUltimate;
  TTT.ultimateMoves = ultimateMoves;
  TTT.ultimateAIMove = ultimateAIMove;
})(globalThis.TTT = globalThis.TTT || {});
