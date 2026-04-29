/* Fox & Lantern — vanilla JS, SVG-rendered grid game.
   Edit content.json to change problems, positions, owl behaviour. */

const STORAGE_KEY = "foxLantern.v1";

const state = {
  content: null,
  N: 5,
  fox: [0, 0],
  owl: [0, 0],
  treasure: [4, 4],
  gates: {},
  visited: new Set(),
  moves: 0,
  busy: false,
  ended: false,
  stats: { wins: 0, losses: 0, streak: 0, lastPlayed: null },
};

const els = {
  board: document.getElementById("board"),
  moves: document.getElementById("moves"),
  wins: document.getElementById("wins"),
  streak: document.getElementById("streak"),
  newRunBtn: document.getElementById("newRunBtn"),
  modal: document.getElementById("modal"),
  modalCard: document.querySelector("#modal .modal-card"),
  modalTag: document.getElementById("modalTag"),
  modalPrompt: document.getElementById("modalPrompt"),
  modalFeedback: document.getElementById("modalFeedback"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  modalCancel: document.getElementById("modalCancel"),
  showWorkingBtn: document.getElementById("showWorkingBtn"),
  workingBoard: document.getElementById("workingBoard"),
  workingSteps: document.getElementById("workingSteps"),
  nextStepBtn: document.getElementById("nextStepBtn"),
  endModal: document.getElementById("endModal"),
  endEmoji: document.getElementById("endEmoji"),
  endTitle: document.getElementById("endTitle"),
  endText: document.getElementById("endText"),
  endAgain: document.getElementById("endAgain"),
};

const key = (a, b) => {
  const [a1, a2] = a, [b1, b2] = b;
  if (a1 < b1 || (a1 === b1 && a2 < b2)) return `${a1},${a2}|${b1},${b2}`;
  return `${b1},${b2}|${a1},${a2}`;
};
const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
const inBounds = ([x, y]) => x >= 0 && y >= 0 && x < state.N && y < state.N;
const neighbours = ([x, y]) =>
  [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(inBounds);
const manhattan = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s) Object.assign(state.stats, s);
  } catch (_) {}
}
function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
}
function bumpStreakIfNewDay() {
  const today = new Date().toDateString();
  if (state.stats.lastPlayed !== today) {
    const yest = new Date(Date.now() - 86400000).toDateString();
    state.stats.streak = state.stats.lastPlayed === yest ? state.stats.streak + 1 : 1;
    state.stats.lastPlayed = today;
    saveStats();
  }
}

function difficultyForCells(a, b) {
  const t = state.treasure;
  const midDist = (manhattan(a, t) + manhattan(b, t)) / 2;
  const maxDist = (state.N - 1) * 2;
  const closeness = 1 - midDist / maxDist;
  if (Math.random() < 0.1) return "hard";
  if (closeness > 0.66) return "hard";
  if (closeness > 0.33) return "medium";
  return "easy";
}

function buildGates() {
  state.gates = {};
  for (let x = 0; x < state.N; x++) {
    for (let y = 0; y < state.N; y++) {
      const here = [x, y];
      for (const nb of neighbours(here)) {
        const k = key(here, nb);
        if (state.gates[k]) continue;
        const diff = difficultyForCells(here, nb);
        const pool = state.content.problems[diff];
        const problem = { ...pick(pool) };
        state.gates[k] = { difficulty: diff, problem, open: false };
      }
    }
  }
  state.visited = new Set([state.fox.join(",")]);
}

function owlNextStep() {
  // Owl guards the lantern — it will never step onto it.
  let best = state.owl;
  let bestDist = manhattan(state.owl, state.fox);
  for (const c of neighbours(state.owl)) {
    if (eq(c, state.treasure)) continue; // can't perch on the lantern
    const d = manhattan(c, state.fox);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

function shouldOwlMoveThisTurn() {
  const cfg = state.content.config;
  const delay = cfg.owlStartDelay ?? 0;
  const every = cfg.owlMoveEvery ?? 1;
  return state.moves > delay && (state.moves - delay) % every === 0;
}

const VB = 1000;
const PAD = 40;
function cellSize() { return (VB - PAD * 2) / state.N; }
function cellCenter([x, y]) {
  const C = cellSize();
  return [PAD + x * C + C / 2, PAD + y * C + C / 2];
}

function render() {
  const N = state.N;
  const C = cellSize();
  const reachable = new Set(neighbours(state.fox).map(p => p.join(",")));

  let svg = `<svg viewBox="0 0 ${VB} ${VB}" xmlns="http://www.w3.org/2000/svg">`;

  // owl preview (only when owl will actually move next)
  if (!state.ended && shouldOwlMoveThisTurn()) {
    const aim = owlNextStep();
    if (!eq(aim, state.owl)) {
      const [ax, ay] = cellCenter(aim);
      svg += `<circle class="owl-aim" cx="${ax}" cy="${ay}" r="${C*0.32}" />`;
    }
  }

  // cells
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const px = PAD + x * C, py = PAD + y * C;
      const visited = state.visited.has(`${x},${y}`);
      const isReachable = reachable.has(`${x},${y}`) && !state.ended;
      const cls = ["cell-rect", visited ? "visited" : "", isReachable ? "reachable" : ""].join(" ");
      svg += `<rect class="${cls}" x="${px+4}" y="${py+4}" width="${C-8}" height="${C-8}" rx="12" />`;
    }
  }

  // gates
  for (const [k, g] of Object.entries(state.gates)) {
    if (g.open) continue;
    const [a, b] = k.split("|").map(s => s.split(",").map(Number));
    const [ax, ay] = cellCenter(a);
    const [bx, by] = cellCenter(b);
    let x1, y1, x2, y2;
    if (a[0] === b[0]) {
      const midY = (ay + by) / 2;
      x1 = ax - C*0.32; x2 = ax + C*0.32; y1 = midY; y2 = midY;
    } else {
      const midX = (ax + bx) / 2;
      y1 = ay - C*0.32; y2 = ay + C*0.32; x1 = midX; x2 = midX;
    }
    svg += `<line class="gate-line locked ${g.difficulty}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  }

  // entities
  const [tx, ty] = cellCenter(state.treasure);
  svg += `<text class="entity treasure" x="${tx}" y="${ty}">🏮</text>`;
  const [ox, oy] = cellCenter(state.owl);
  svg += `<text class="entity owl" x="${ox}" y="${oy}">🦉</text>`;
  const [fx, fy] = cellCenter(state.fox);
  svg += `<text class="entity fox" x="${fx}" y="${fy}">🦊</text>`;

  // hit areas
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const px = PAD + x * C, py = PAD + y * C;
      const isReachable = reachable.has(`${x},${y}`) && !state.ended;
      const cls = "cell-hit" + (isReachable ? " reachable" : "");
      svg += `<rect class="${cls}" x="${px}" y="${py}" width="${C}" height="${C}" data-cell="${x},${y}" />`;
    }
  }

  svg += `</svg>`;
  els.board.innerHTML = svg;

  els.board.querySelectorAll("[data-cell]").forEach(node => {
    node.addEventListener("click", () => {
      const [x, y] = node.dataset.cell.split(",").map(Number);
      onCellClick([x, y]);
    });
  });

  els.moves.textContent = state.moves;
  els.wins.textContent = state.stats.wins;
  els.streak.textContent = state.stats.streak;
}

let pendingTarget = null;
let pendingGate = null;
let attempts = 0;
let workingShown = 0;

function onCellClick(target) {
  if (state.busy || state.ended) return;
  if (manhattan(state.fox, target) !== 1) return;
  const k = key(state.fox, target);
  const gate = state.gates[k];
  if (gate.open) {
    moveFoxTo(target);
  } else {
    openProblem(target, gate);
  }
}

function openProblem(target, gate) {
  pendingTarget = target;
  pendingGate = gate;
  workingShown = 0;
  els.modalTag.textContent = `${gate.difficulty} gate`;
  els.modalTag.style.color =
    gate.difficulty === "hard" ? "var(--hard)" :
    gate.difficulty === "medium" ? "var(--medium)" : "var(--easy)";
  els.modalPrompt.textContent = gate.problem.prompt;
  els.modalFeedback.textContent = "";
  els.modalFeedback.className = "feedback";
  els.answerInput.value = "";
  // reset working board
  els.workingSteps.innerHTML = "";
  els.workingBoard.hidden = true;
  els.modalCard.classList.remove("show-working");
  const stepsAvailable = Array.isArray(gate.problem.steps) && gate.problem.steps.length > 0;
  els.showWorkingBtn.hidden = !stepsAvailable && !gate.problem.hint;
  els.showWorkingBtn.textContent = "👀 show working";
  els.nextStepBtn.disabled = false;

  els.modal.classList.add("show");
  setTimeout(() => els.answerInput.focus(), 60);
}

function getStepsForCurrent() {
  const p = pendingGate.problem;
  if (Array.isArray(p.steps) && p.steps.length > 0) return p.steps;
  if (p.hint) return [p.hint];
  return [];
}

function revealNextStep() {
  const steps = getStepsForCurrent();
  if (workingShown >= steps.length) return;
  els.workingBoard.hidden = false;
  els.modalCard.classList.add("show-working");
  const li = document.createElement("li");
  li.textContent = steps[workingShown];
  els.workingSteps.appendChild(li);
  workingShown += 1;
  if (workingShown >= steps.length) {
    els.nextStepBtn.disabled = true;
    els.showWorkingBtn.textContent = "all steps shown";
  } else {
    els.showWorkingBtn.textContent = `next step (${workingShown}/${steps.length})`;
  }
  setTimeout(() => els.answerInput.focus(), 60);
}

function closeProblem() {
  els.modal.classList.remove("show");
  pendingTarget = null;
  pendingGate = null;
  attempts = 0;
}

function submitAnswer(raw) {
  const given = raw.trim();
  if (given === "" || !pendingGate) return;
  const exp = pendingGate.problem.answer;
  const correct =
    typeof exp === "number"
      ? Number.isFinite(Number(given)) && Number(given) === exp
      : String(exp).toLowerCase() === given.toLowerCase();

  if (correct) {
    if (window.sfx) sfx.play("correct");
    els.modalFeedback.textContent = "✓ The gate sighs open.";
    els.modalFeedback.className = "feedback good";
    pendingGate.open = true;
    const target = pendingTarget;
    setTimeout(() => {
      closeProblem();
      if (window.sfx) sfx.play("open");
      moveFoxTo(target);
    }, 500);
  } else {
    attempts += 1;
    if (attempts === 1) {
      if (window.sfx) sfx.play("wrong");
      els.modalFeedback.innerHTML = `Not quite — try once more.<span class="hint">Hint: ${escapeHtml(pendingGate.problem.hint)}</span>`;
      els.modalFeedback.className = "feedback bad";
      els.answerInput.select();
    } else {
      if (window.sfx) sfx.play("wrong");
      els.modalFeedback.innerHTML = `The owl is moving…<span class="hint">Answer was ${escapeHtml(String(pendingGate.problem.answer))}</span>`;
      els.modalFeedback.className = "feedback bad";
      setTimeout(() => {
        closeProblem();
        // wrong-answer cost: owl steps, fox stays
        state.busy = true;
        owlMove();
        afterTurn();
      }, 1200);
    }
  }
}

function moveFoxTo(target) {
  state.busy = true;
  state.fox = target;
  state.visited.add(target.join(","));
  state.moves += 1;
  if (window.sfx) sfx.play("move");
  render();
  if (shouldOwlMoveThisTurn()) {
    setTimeout(() => { owlMove(); afterTurn(); }, 280);
  } else {
    setTimeout(afterTurn, 200);
  }
}

function owlMove() {
  state.owl = owlNextStep();
  if (window.sfx) sfx.play("owl");
}

function afterTurn() {
  render();
  state.busy = false;
  // Capture beats arrival: if the owl is on the same square, it's a loss
  // even if that square happens to be the lantern.
  if (eq(state.owl, state.fox)) {
    state.ended = true;
    state.stats.losses += 1;
    saveStats();
    showEnd(false);
  } else if (eq(state.fox, state.treasure)) {
    state.ended = true;
    state.stats.wins += 1;
    saveStats();
    showEnd(true);
  }
}

function showEnd(won) {
  if (window.sfx) sfx.play(won ? "win" : "lose");
  els.endEmoji.textContent = won ? "🏮" : "🦉";
  els.endTitle.textContent = won ? "Lantern recovered!" : "The owl spotted you!";
  els.endText.textContent = won
    ? `You crossed the night in ${state.moves} moves, Asher. Brilliant.`
    : `Lasted ${state.moves} moves. Sneak again — try a different path.`;
  els.endModal.classList.add("show");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function newRun() {
  const cfg = state.content.config;
  state.N = cfg.gridSize;
  state.fox = [...cfg.fox];
  state.owl = [...cfg.owl];
  state.treasure = [...cfg.treasure];
  state.moves = 0;
  state.ended = false;
  state.busy = false;
  buildGates();
  bumpStreakIfNewDay();
  els.endModal.classList.remove("show");
  render();
}

async function boot() {
  const res = await fetch("content.json");
  state.content = await res.json();
  loadStats();
  newRun();
}

els.answerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitAnswer(els.answerInput.value);
});
els.modalCancel.addEventListener("click", closeProblem);
els.showWorkingBtn.addEventListener("click", revealNextStep);
els.nextStepBtn.addEventListener("click", revealNextStep);
els.newRunBtn.addEventListener("click", newRun);

// Sound toggle
const soundBtn = document.getElementById("soundBtn");
if (soundBtn && window.sfx) {
  const sync = () => { soundBtn.textContent = sfx.isMuted() ? "🔇" : "🔊"; };
  sync();
  soundBtn.addEventListener("click", () => { sfx.setMuted(!sfx.isMuted()); sync(); if (!sfx.isMuted()) sfx.play("click"); });
}
els.endAgain.addEventListener("click", newRun);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.modal.classList.contains("show")) closeProblem();
});

boot();
