/* Build Lab — tabs + 3 mini apps. No deps. */

// ---------- TABS ----------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
tabs.forEach(t => t.addEventListener("click", () => {
  tabs.forEach(x => x.classList.toggle("active", x === t));
  const name = t.dataset.tab;
  panels.forEach(p => p.classList.toggle("hidden", p.dataset.panel !== name));
}));

// ---------- helpers ----------
function makeBoardEl(host, size) {
  host.innerHTML = "";
  host.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  const cells = [];
  for (let i = 0; i < size * size; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    c.dataset.i = i;
    host.appendChild(c);
    cells.push(c);
  }
  return cells;
}

function winningLine(board, size, needed) {
  // rows, cols, diags — generic for any size with `needed` in a row.
  const lines = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - needed; c++) {
      lines.push(Array.from({length: needed}, (_, k) => r * size + c + k));
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - needed; r++) {
      lines.push(Array.from({length: needed}, (_, k) => (r + k) * size + c));
    }
  }
  for (let r = 0; r <= size - needed; r++) {
    for (let c = 0; c <= size - needed; c++) {
      lines.push(Array.from({length: needed}, (_, k) => (r + k) * size + (c + k)));
      lines.push(Array.from({length: needed}, (_, k) => (r + k) * size + (c + needed - 1 - k)));
    }
  }
  for (const line of lines) {
    const v = board[line[0]];
    if (v && line.every(i => board[i] === v)) return line;
  }
  return null;
}

// ============================================================
// TAB 1: PLAY — vanilla 3x3 tic-tac-toe
// ============================================================
function makePlay(hostId, statusId, resetId, opts = {}) {
  const onMove = opts.onMove;
  const host = document.getElementById(hostId);
  const status = document.getElementById(statusId);
  const resetBtn = document.getElementById(resetId);
  const SIZE = 3;
  let board, turn, done, cells;

  function reset() {
    board = Array(SIZE * SIZE).fill("");
    turn = "X";
    done = false;
    cells = makeBoardEl(host, SIZE);
    cells.forEach(c => c.addEventListener("click", () => click(+c.dataset.i)));
    status.textContent = `${turn} to play`;
  }

  function click(i) {
    if (done || board[i]) return;
    board[i] = turn;
    cells[i].textContent = turn;
    cells[i].classList.add("taken");
    if (window.sfx) sfx.play("place");
    if (onMove) onMove(i, turn);
    const line = winningLine(board, SIZE, 3);
    if (line) {
      done = true;
      line.forEach(k => cells[k].classList.add("win"));
      if (window.sfx) sfx.play("win");
      status.textContent = `${turn} wins! 🎉`;
      return;
    }
    if (board.every(v => v)) {
      done = true;
      status.textContent = "It's a draw.";
      return;
    }
    turn = (turn === "X") ? "O" : "X";
    status.textContent = `${turn} to play`;
  }

  resetBtn.addEventListener("click", reset);
  reset();
}

makePlay("playBoard", "playStatus", "playReset");

// ============================================================
// TAB 2: PEEK — same game, but each click flashes the matching idea
// ============================================================
function flashPeek(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 900);
}
makePlay("peekBoard", "peekStatus", "peekReset", {
  onMove: () => {
    // Show the relevant ideas in order on each click.
    flashPeek("peek-3"); // place letter
    setTimeout(() => flashPeek("peek-5"), 250); // check win
    setTimeout(() => flashPeek("peek-4"), 500); // flip turn
  }
});

// ============================================================
// TAB 3: BUILD — live editable code, runs in a sandboxed function
// ============================================================
const STARTER = `// Tic-tac-toe — 3 ideas: a board, whose turn, check win.
// Try changing the things in CAPITAL LETTERS, then press ▶ run.

const SIZE = 3;          // try 4 for a bigger board
const PLAYER_1 = "X";    // try "🦊"
const PLAYER_2 = "O";    // try "🦉"
const NEEDED   = 3;      // 3 in a row to win
const GLOW     = false;  // true = winning line glows
const BOT      = false;  // true = a robot plays as PLAYER_2

// --- the game ---
let board = Array(SIZE * SIZE).fill("");
let turn  = PLAYER_1;
let done  = false;

function onClick(i) {
  if (done || board[i]) return;
  board[i] = turn;
  paint();
  const line = checkWin();
  if (line) {
    done = true;
    say(turn + " wins!");
    if (GLOW) line.forEach(k => cells[k].classList.add("win"));
    return;
  }
  if (board.every(v => v)) { done = true; say("Draw."); return; }
  turn = (turn === PLAYER_1) ? PLAYER_2 : PLAYER_1;
  say(turn + " to play");
  if (BOT && turn === PLAYER_2) setTimeout(botMove, 350);
}

function botMove() {
  // very simple: pick a random empty square
  const empty = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) empty.push(i);
  if (empty.length) onClick(empty[Math.floor(Math.random() * empty.length)]);
}

// --- engine glue (don't worry about this part yet) ---
const cells = mountBoard(SIZE, onClick);
function paint() { cells.forEach((c,i) => c.textContent = board[i]); }
function checkWin() { return winningLine(board, SIZE, NEEDED); }
say(turn + " to play");
`;

const editor = document.getElementById("editor");
const runBtn = document.getElementById("runBtn");
const resetCodeBtn = document.getElementById("resetCodeBtn");
const consoleEl = document.getElementById("console");
const buildBoard = document.getElementById("buildBoard");
const buildStatus = document.getElementById("buildStatus");

const CODE_KEY = "buildLab.code.v1";
const CHAL_KEY = "buildLab.chal.v1";

editor.value = localStorage.getItem(CODE_KEY) || STARTER;

function logToConsole(msg, kind = "") {
  consoleEl.className = "console " + kind;
  consoleEl.textContent = msg;
}

function runCode() {
  const src = editor.value;
  localStorage.setItem(CODE_KEY, src);

  // engine helpers exposed to the user's code
  const sandbox = {
    mountBoard(size, onClick) {
      const cells = makeBoardEl(buildBoard, size);
      cells.forEach(c => c.addEventListener("click", () => onClick(+c.dataset.i)));
      return cells;
    },
    say(text) { buildStatus.textContent = text; },
    winningLine,
  };

  try {
    // wrap user code so its top-level `const`/`let` work, and inject helpers
    const fn = new Function("mountBoard", "say", "winningLine",
      `"use strict";\n${src}`);
    fn(sandbox.mountBoard, sandbox.say, sandbox.winningLine);
    logToConsole("✓ ran ok", "ok");
    checkChallenges(src);
  } catch (err) {
    logToConsole("× " + err.message, "error");
  }
}

runBtn.addEventListener("click", runCode);
resetCodeBtn.addEventListener("click", () => {
  if (confirm("Restore the starter code? Your changes will be lost.")) {
    editor.value = STARTER;
    localStorage.removeItem(CODE_KEY);
    runCode();
  }
});

// Run automatically on first load so he sees something straight away.
runCode();

// ---------- challenges ----------
const CHALLENGE_TESTS = {
  emoji: src => /PLAYER_1\s*=\s*["']🦊["']/.test(src) && /PLAYER_2\s*=\s*["']🦉["']/.test(src),
  size4: src => /SIZE\s*=\s*4\b/.test(src),
  glow:  src => /GLOW\s*=\s*true\b/.test(src),
  bot:   src => /BOT\s*=\s*true\b/.test(src),
};

function loadChallenges() {
  try { return JSON.parse(localStorage.getItem(CHAL_KEY)) || {}; }
  catch { return {}; }
}
function saveChallenges(s) { localStorage.setItem(CHAL_KEY, JSON.stringify(s)); }

function checkChallenges(src) {
  const state = loadChallenges();
  let newlyDone = [];
  document.querySelectorAll("#challenges li").forEach(li => {
    const id = li.dataset.id;
    const passes = CHALLENGE_TESTS[id](src);
    if (passes && !state[id]) { state[id] = true; newlyDone.push(id); }
    if (state[id]) {
      li.classList.add("done");
      li.querySelector(".check").textContent = "✓";
    }
  });
  saveChallenges(state);
  if (newlyDone.length) {
    logToConsole(`✓ ran ok  —  challenge complete! ⭐ (${newlyDone.length})`, "ok");
  }
}

// initial render of saved challenge ticks
(function paintChallenges() {
  const state = loadChallenges();
  document.querySelectorAll("#challenges li").forEach(li => {
    if (state[li.dataset.id]) {
      li.classList.add("done");
      li.querySelector(".check").textContent = "✓";
    }
  });
})();

// Tab key inside editor inserts two spaces instead of changing focus
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = editor.selectionStart, end = editor.selectionEnd;
    editor.value = editor.value.slice(0, s) + "  " + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = s + 2;
  }
});

// Sound toggle
const soundBtn = document.getElementById("soundBtn");
if (soundBtn && window.sfx) {
  const sync = () => { soundBtn.textContent = sfx.isMuted() ? "🔇" : "🔊"; };
  sync();
  soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.isMuted()); sync(); if (!sfx.isMuted()) sfx.play("click"); });
}

runBtn.addEventListener("click", () => { if (window.sfx) sfx.play("click"); });
