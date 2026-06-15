/*
 * Node test harness — no framework, just asserts. Loads the browser scripts
 * (they attach to globalThis.TTT) and exercises the engine + AI.
 *
 *   node test/engine.test.mjs
 */
import '../js/engine.js';
import '../js/ai.js';

const TTT = globalThis.TTT;
let passed = 0;
const failures = [];

function check(name, cond) {
  if (cond) { passed++; }
  else { failures.push(name); }
}

/* ----------------------------- engine basics ---------------------------- */

check('detects a row win', (() => {
  const g = TTT.newClassic();
  // X plays 0,1,2 ; O plays 3,4
  TTT.classicMove(g, 0); // X
  TTT.classicMove(g, 3); // O
  TTT.classicMove(g, 1); // X
  TTT.classicMove(g, 4); // O
  TTT.classicMove(g, 2); // X wins top row
  return g.over && g.winner === 'X' && g.winLine.join(',') === '0,1,2';
})());

check('detects a draw', (() => {
  const g = TTT.newClassic();
  // X O X / X O O / O X X  -> full, no winner
  [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach((i) => TTT.classicMove(g, i));
  return g.over && g.winner === 'draw';
})());

check('rejects illegal classic move', (() => {
  const g = TTT.newClassic();
  TTT.classicMove(g, 0);
  return TTT.classicMove(g, 0) === false;
})());

/* --------------------- minimax is unbeatable (the point) ---------------- */
// Play many full games: random X vs Impossible-O, and Impossible-X vs random O.
// The Impossible side must never lose.

function playGame(aiMark, getOpponentMove) {
  const g = TTT.newClassic();
  const human = TTT.other(aiMark);
  while (!g.over) {
    if (g.current === aiMark) {
      TTT.classicMove(g, TTT.classicBestMove(g.cells, aiMark, human));
    } else {
      const empties = TTT.emptyIndices(g.cells);
      TTT.classicMove(g, getOpponentMove(g.cells, empties));
    }
  }
  return g.winner;
}

const randMove = (_, empties) => empties[Math.floor(Math.random() * empties.length)];

let aiLosses = 0;
for (let i = 0; i < 400; i++) {
  if (playGame('O', randMove) === 'X') aiLosses++;   // AI is O (moves 2nd)
  if (playGame('X', randMove) === 'O') aiLosses++;   // AI is X (moves 1st)
}
check('Impossible AI never loses vs random (800 games)', aiLosses === 0);

// Two perfect players always draw.
let perfectDraw = true;
for (let i = 0; i < 50; i++) {
  const r = playGame('O', (cells) => TTT.classicBestMove(cells, 'X', 'O'));
  if (r !== 'draw') perfectDraw = false;
}
check('perfect vs perfect is always a draw', perfectDraw);

// AI must take an immediate winning move when offered one.
check('AI completes a winning line', (() => {
  const cells = ['O', 'O', null, 'X', 'X', null, null, null, null];
  return TTT.classicBestMove(cells, 'O', 'X') === 2;
})());

// AI must block an immediate threat.
check('AI blocks an opponent win', (() => {
  const cells = ['X', 'X', null, 'O', null, null, null, null, null];
  return TTT.classicBestMove(cells, 'O', 'X') === 2;
})());

/* ---------------------------- ultimate rules ---------------------------- */

check('ultimate: move sends opponent to matching board', (() => {
  const g = TTT.newUltimate();
  TTT.ultimateMove(g, 4, 2); // play center board, cell 2 -> next board 2
  return g.active === 2 && g.current === 'O';
})());

check('ultimate: winning a small board is recorded', (() => {
  const g = TTT.newUltimate();
  // Force X to take board 0 across several turns (ignoring active routing by
  // building the state directly is simpler):
  g.boards[0] = ['X', 'X', null, null, null, null, null, null, null];
  g.active = 0; g.current = 'X';
  TTT.ultimateMove(g, 0, 2); // completes top row of board 0
  return g.smallWin[0] === 'X';
})());

check('ultimate: three boards in a row wins the game', (() => {
  const g = TTT.newUltimate();
  g.smallWin = ['X', 'X', null, null, null, null, null, null, null];
  // Make board 2 a win-in-one for X and let X play it.
  g.boards[2] = ['X', 'X', null, null, null, null, null, null, null];
  g.active = 2; g.current = 'X';
  TTT.ultimateMove(g, 2, 2);
  return g.over && g.winner === 'X' && g.winLine.join(',') === '0,1,2';
})());

check('ultimate: free choice when target board is decided', (() => {
  const g = TTT.newUltimate();
  g.smallWin[5] = 'O';            // board 5 already taken
  g.active = null; g.current = 'X';
  TTT.ultimateMove(g, 0, 5);      // cell 5 -> would send to board 5 (decided)
  return g.active === null;       // so opponent may play anywhere
})());

check('ultimate AI returns a legal move', (() => {
  const g = TTT.newUltimate();
  TTT.ultimateMove(g, 4, 0);      // human opens
  const m = TTT.ultimateAIMove(g, 'O', 'X', 'impossible');
  const legal = TTT.ultimateMoves(g).some(([b, c]) => b === m[0] && c === m[1]);
  return legal;
})());

/* ------------------------------- report --------------------------------- */
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('FAILED:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('All engine/AI tests passed ✓\n');
