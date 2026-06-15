# Tic·Tac·Toe — Classic & Ultimate

A polished, dependency-free Tic-Tac-Toe you can play in the browser. Take on an
**unbeatable AI** in the classic 3×3 game, or test yourself at the strategic
**Ultimate** variant (nine boards in one). No build step, no frameworks — just
HTML, CSS, and vanilla JavaScript.

🎮 **Live demo:** _added after first deploy_

## Features

- **Two game modes**
  - **Classic 3×3** with a minimax (alpha-beta) AI. On *Impossible*, it plays a
    perfect game — the best you can do is draw.
  - **Ultimate Tic-Tac-Toe** — the square you play sends your opponent to the
    matching board; win three boards in a row to win the game.
- **Three difficulties** (Easy / Medium / Impossible) and a local **2-player** mode.
- **Good UX**: animated piece placement, winning-line highlight, win confetti,
  synthesized sound effects, light/dark themes, and a persistent scoreboard.
- **Accessible**: real buttons, `aria-live` status, keyboard play (Tab/Enter,
  plus arrow keys on the classic board), and reduced-motion support.
- **Responsive** down to small phones.

## Run it locally

It's a static site — open `index.html` directly, or serve the folder:

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
index.html        # markup + script includes
css/styles.css    # theming (CSS variables), layout, animations
js/engine.js      # pure game logic for both modes (no DOM)
js/ai.js          # minimax (classic) + heuristic search (ultimate)
js/audio.js       # Web Audio sound effects
js/app.js         # UI controller, rendering, confetti
test/             # Node test harness (logic) + headless browser smoke test
```

## Tests

The game logic is covered by a zero-dependency Node test suite, including a
check that the Impossible AI never loses across hundreds of randomized games:

```bash
node test/engine.test.mjs
```

A headless-browser smoke test (Puppeteer) is also included:

```bash
npm i puppeteer && node test/browser.smoke.mjs
```

## License

MIT
