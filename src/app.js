import {
  colours,
  conflictSet,
  difficultyLabels,
  generateDailyPuzzle,
  isSolvedBoard,
  localDateKey,
  prettyDate
} from "./sudoku.js";
import {
  computeStats,
  formatDuration,
  getGame,
  loadStore,
  resetGame,
  upsertGame
} from "./storage.js";
import { setUserStats, streakBucket, trackEvent } from "./analytics.js";

const wheelOptions = [
  ...colours.map((colour, index) => ({ ...colour, value: index + 1 })),
  { name: "Empty", hex: "#fbfbf8", value: 0, empty: true }
];

const todayKey = localDateKey();
const labelColoursKey = "rainboku.labelColours.v1";
let store = loadStore();
let activeDifficulty = null;
let activePuzzle = null;
let board = [];
let givens = [];
let labelColours = loadLabelColours();
let activeCell = null;
let dragState = null;
let previewIndex = null;
let winShown = false;
let elapsedMs = 0;
let timerStartedAt = 0;
let timerId = null;
let conflictCount = 0;
let colourBarFrame = null;
let colourBarStart = 0;
let confettiFrame = null;
let particles = [];
const colourBarCycleMs = 12630;
const dragCommitDistance = 16;

const dashboardScreen = document.querySelector("#dashboardScreen");
const gameScreen = document.querySelector("#gameScreen");
const boardEl = document.querySelector("#board");
const menuButton = document.querySelector("#menuButton");
const resetButton = document.querySelector("#resetButton");
const shareButton = document.querySelector("#shareButton");
const labelColoursToggle = document.querySelector("#labelColoursToggle");
const labelColoursText = document.querySelector("#labelColoursText");
const difficultyLabel = document.querySelector("#difficultyLabel");
const statusText = document.querySelector("#statusText");
const dateLabel = document.querySelector("#dateLabel");
const currentStreak = document.querySelector("#currentStreak");
const bestStreak = document.querySelector("#bestStreak");
const totalSolved = document.querySelector("#totalSolved");
const wheel = document.querySelector("#colourWheel");
const wheelHub = document.querySelector(".wheel-hub");
const reelStrip = document.querySelector("#reelStrip");
const resetModal = document.querySelector("#resetModal");
const cancelResetButton = document.querySelector("#cancelResetButton");
const confirmResetButton = document.querySelector("#confirmResetButton");
const shareModal = document.querySelector("#shareModal");
const sharePreview = document.querySelector("#sharePreview");
const shareStatus = document.querySelector("#shareStatus");
const closeShareButton = document.querySelector("#closeShareButton");
const canvas = document.querySelector("#confettiCanvas");
const ctx = canvas.getContext("2d");

dateLabel.textContent = prettyDate(todayKey);
labelColoursText.textContent = labelColoursCopy();
labelColoursToggle.checked = labelColours;
boardEl.classList.toggle("label-colours", labelColours);
buildWheel();
buildColourBar();
renderDashboard();

document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => startGame(button.dataset.difficulty));
});
menuButton.addEventListener("click", showDashboard);
resetButton.addEventListener("click", () => {
  resetModal.hidden = false;
});
cancelResetButton.addEventListener("click", () => {
  resetModal.hidden = true;
});
confirmResetButton.addEventListener("click", () => {
  if (!activeDifficulty) return;
  const difficulty = activeDifficulty;
  trackEvent("reset_puzzle", {
    difficulty,
    date_key: todayKey,
    puzzle_id: activePuzzle?.id,
    elapsed_seconds: Math.floor(currentElapsed() / 1000),
    conflict_count: conflictCount
  });
  resetModal.hidden = true;
  resetGame(store, todayKey, difficulty);
  startGame(difficulty, { skipSave: true });
});
shareButton.addEventListener("click", shareResult);
labelColoursToggle.addEventListener("change", () => {
  labelColours = labelColoursToggle.checked;
  saveLabelColours(labelColours);
  boardEl.classList.toggle("label-colours", labelColours);
});
closeShareButton.addEventListener("click", () => {
  shareModal.hidden = true;
});

document.addEventListener("pointerdown", (event) => {
  if (!wheel.classList.contains("visible")) return;
  if (event.target.closest(".wheel") || event.target.closest(".cell")) return;
  closeWheel();
});

window.addEventListener("resize", () => {
  if (wheel.classList.contains("visible") && activeCell !== null) {
    const cell = getCell(activeCell);
    const rect = cell.getBoundingClientRect();
    positionWheel(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
});

function renderDashboard() {
  stopTimer();
  stopConfetti();
  closeWheel();
  store = loadStore();
  const stats = computeStats(store, todayKey);
  setAnalyticsUserStats(stats);
  currentStreak.textContent = String(stats.currentStreak);
  bestStreak.textContent = String(stats.bestStreak);
  totalSolved.textContent = String(stats.totalSolved);
  Object.keys(difficultyLabels).forEach((difficulty) => {
    const status = document.querySelector(`[data-status-for="${difficulty}"]`);
    const bestMs = stats.byDifficulty[difficulty]?.bestMs || null;
    status.textContent = dashboardStatusForGame(getGame(store, todayKey, difficulty), bestMs);
    renderDifficultyDots(difficulty, stats.byDifficulty[difficulty]?.solved || 0);
  });
}

function dashboardStatusForGame(game, bestMs) {
  const bestText = bestMs ? `Best ${formatDuration(bestMs)}` : "";
  let status = "Not started";
  if (game?.solved) {
    status = `Solved ${formatDuration(game.elapsedMs || 0)}`;
  } else if ((game?.board || []).some((value) => value !== 0)) {
    status = "In progress";
  }
  return bestText ? `${status} - ${bestText}` : status;
}

function renderDifficultyDots(difficulty, solvedCount) {
  const dotTrack = document.querySelector(`[data-dots-for="${difficulty}"]`);
  if (!dotTrack) return;
  dotTrack.innerHTML = "";
  dotTrack.classList.toggle("empty", solvedCount === 0);
  dotTrack.setAttribute("aria-label", `${difficultyLabels[difficulty]} solved ${solvedCount} day${solvedCount === 1 ? "" : "s"}`);
  const displayCount = Math.max(7, Math.min(solvedCount, 42));
  for (let index = 0; index < displayCount; index += 1) {
    const dot = document.createElement("span");
    dot.className = index < solvedCount ? "solve-dot filled" : "solve-dot";
    dotTrack.appendChild(dot);
  }
  if (solvedCount > 42) {
    const overflow = document.createElement("span");
    overflow.className = "solve-overflow";
    overflow.textContent = `+${solvedCount - 42}`;
    dotTrack.appendChild(overflow);
  }
}

function showDashboard() {
  saveActiveGame();
  activeDifficulty = null;
  activePuzzle = null;
  board = [];
  givens = [];
  boardEl.innerHTML = "";
  statusText.textContent = "";
  menuButton.hidden = true;
  gameScreen.hidden = true;
  dashboardScreen.hidden = false;
  renderDashboard();
}

function startGame(difficulty, options = {}) {
  if (!options.skipSave) saveActiveGame();
  stopTimer();
  store = loadStore();
  activeDifficulty = difficulty;
  activePuzzle = generateDailyPuzzle(todayKey, difficulty);
  const saved = getGame(store, todayKey, difficulty);
  if (saved && saved.seed === activePuzzle.seed && Array.isArray(saved.board) && saved.board.length === 81) {
    board = saved.board.map((value) => Number(value) || 0);
    elapsedMs = saved.elapsedMs || 0;
    winShown = Boolean(saved.solved);
    conflictCount = saved.conflictCount || 0;
  } else {
    board = activePuzzle.puzzle.split("").map(Number);
    elapsedMs = 0;
    winShown = false;
    conflictCount = 0;
  }
  givens = activePuzzle.puzzle.split("").map((value) => value !== "0");
  activeCell = null;
  previewIndex = null;
  difficultyLabel.textContent = `${difficultyLabels[difficulty]} - ${todayKey}`;
  dashboardScreen.hidden = true;
  gameScreen.hidden = false;
  menuButton.hidden = false;
  shareButton.hidden = !winShown;
  renderBoard();
  updateConflicts();
  startTimer();
  saveActiveGame();
  trackEvent("puzzle_start", {
    difficulty,
    date_key: todayKey,
    puzzle_id: activePuzzle.id,
    puzzle_seed: activePuzzle.seed,
    resumed: Boolean(saved)
  });
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.classList.toggle("label-colours", labelColours);
  board.forEach((value, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(index);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", labelForCell(index, value));
    if (value) {
      cell.style.background = colours[value - 1].hex;
      cell.classList.add("filled");
      const label = document.createElement("span");
      label.className = "cell-label";
      label.textContent = colours[value - 1].name.charAt(0).toUpperCase();
      cell.appendChild(label);
    }
    if (givens[index]) {
      cell.classList.add("given");
      cell.setAttribute("aria-disabled", "true");
    }
    if ((col + 1) % 3 === 0 && col !== 8) cell.classList.add("box-right");
    if ((row + 1) % 3 === 0 && row !== 8) cell.classList.add("box-bottom");
    cell.addEventListener("pointerdown", handleCellPointerDown);
    boardEl.appendChild(cell);
  });
  updateColourCounts();
}

function labelForCell(index, value) {
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  const content = value ? colours[value - 1].name : "empty";
  const locked = givens[index] ? ", locked" : "";
  return `Row ${row}, column ${col}, ${content}${locked}`;
}

function getCell(index) {
  return boardEl.querySelector(`[data-index="${index}"]`);
}

function handleCellPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const index = Number(event.currentTarget.dataset.index);
  if (givens[index] || winShown) return;
  event.preventDefault();
  activeCell = index;
  previewIndex = null;
  selectCell(index);
  const rect = event.currentTarget.getBoundingClientRect();
  openWheel(rect.left + rect.width / 2, rect.top + rect.height / 2);
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  window.addEventListener("pointermove", handleDragMove);
  window.addEventListener("pointerup", handleDragEnd, { once: true });
}

function selectCell(index) {
  boardEl.querySelectorAll(".cell.selected").forEach((cell) => cell.classList.remove("selected"));
  const cell = getCell(index);
  if (cell) cell.classList.add("selected");
}

function buildWheel() {
  const radius = 76;
  wheelOptions.forEach((option, index) => {
    const angle = (-90 + index * 360 / wheelOptions.length) * Math.PI / 180;
    const button = document.createElement("button");
    button.type = "button";
    button.className = option.empty ? "wheel-color empty-option" : "wheel-color";
    button.style.left = `${105 + Math.cos(angle) * radius}px`;
    button.style.top = `${105 + Math.sin(angle) * radius}px`;
    if (!option.empty) button.style.background = option.hex;
    button.dataset.optionIndex = String(index);
    button.tabIndex = -1;
    button.title = option.name;
    button.setAttribute("aria-label", option.name);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      commitOption(index);
    });
    wheel.appendChild(button);
  });
}

function openWheel(x, y) {
  wheel.setAttribute("aria-hidden", "false");
  wheel.querySelectorAll(".wheel-color").forEach((button) => {
    button.tabIndex = 0;
  });
  setWheelPreview(null);
  positionWheel(x, y);
  requestAnimationFrame(() => wheel.classList.add("visible"));
}

function positionWheel(x, y) {
  const half = 105;
  const margin = 8;
  const minX = half + margin;
  const maxX = window.innerWidth - half - margin;
  const minY = half + margin;
  const maxY = window.innerHeight - half - margin;
  const clampedX = clamp(x, minX, Math.max(minX, maxX));
  const clampedY = clamp(y, minY, Math.max(minY, maxY));
  wheel.style.left = `${clampedX}px`;
  wheel.style.top = `${clampedY}px`;
}

function closeWheel() {
  restorePreview();
  wheel.classList.remove("visible");
  wheel.setAttribute("aria-hidden", "true");
  wheel.querySelectorAll(".wheel-color").forEach((button) => {
    button.tabIndex = -1;
  });
  wheel.querySelectorAll(".hover").forEach((button) => button.classList.remove("hover"));
  setWheelPreview(null);
  boardEl.querySelectorAll(".cell.selected").forEach((cell) => cell.classList.remove("selected"));
  activeCell = null;
  dragState = null;
  previewIndex = null;
}

function handleDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  dragState.moved = dragState.moved || distance > dragCommitDistance;
  if (!dragState.moved) return;
  const index = optionIndexAtPoint(event.clientX, event.clientY);
  setWheelHover(index);
  setPreview(index);
}

function handleDragEnd(event) {
  window.removeEventListener("pointermove", handleDragMove);
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const index = optionIndexAtPoint(event.clientX, event.clientY);
  if (dragState.moved && index !== null) {
    commitOption(index);
    return;
  }
  if (dragState.moved) {
    closeWheel();
  } else {
    restorePreview();
    setWheelHover(null);
    dragState = null;
  }
}

function optionIndexAtPoint(x, y) {
  const buttons = Array.from(wheel.querySelectorAll(".wheel-color"));
  for (const button of buttons) {
    const rect = button.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2 + 8;
    if (Math.hypot(x - cx, y - cy) <= radius) {
      return Number(button.dataset.optionIndex);
    }
  }
  return null;
}

function setWheelHover(index) {
  wheel.querySelectorAll(".wheel-color").forEach((button) => {
    button.classList.toggle("hover", Number(button.dataset.optionIndex) === index);
  });
  setWheelPreview(index);
}

function setWheelPreview(index) {
  wheelHub.classList.remove("has-preview", "empty-preview");
  wheelHub.style.background = "";
  wheelHub.style.borderColor = "";
  if (index === null) return;
  const option = wheelOptions[index];
  if (!option) return;
  if (option.empty) {
    wheelHub.classList.add("empty-preview");
    return;
  }
  wheelHub.classList.add("has-preview");
  wheelHub.style.background = option.hex;
  wheelHub.style.borderColor = "rgba(255, 255, 255, 0.94)";
}

function setPreview(index) {
  if (activeCell === null) return;
  if (index === previewIndex) return;
  previewIndex = index;
  const cell = getCell(activeCell);
  if (!cell) return;
  if (index === null) {
    restorePreview();
    return;
  }
  const option = wheelOptions[index];
  cell.style.background = option.value ? option.hex : "#fbfbf8";
}

function restorePreview() {
  if (activeCell === null) return;
  const cell = getCell(activeCell);
  if (!cell) return;
  const value = board[activeCell];
  cell.style.background = value ? colours[value - 1].hex : "#fbfbf8";
}

function commitOption(index) {
  if (activeCell === null || givens[activeCell]) return;
  board[activeCell] = wheelOptions[index].value;
  closeWheel();
  renderBoard();
  const conflicts = updateConflicts();
  if (conflicts.size) conflictCount += 1;
  checkWin();
  saveActiveGame();
}

function updateConflicts() {
  const conflicts = conflictSet(board);
  boardEl.querySelectorAll(".cell").forEach((cell) => {
    const index = Number(cell.dataset.index);
    cell.classList.toggle("conflict", conflicts.has(index));
    cell.setAttribute("aria-label", labelForCell(index, board[index]));
  });
  if (!winShown) {
    statusText.textContent = conflicts.size ? "Colour conflict" : formatDuration(currentElapsed());
  }
  return conflicts;
}

function checkWin() {
  if (winShown || board.some((value) => value === 0)) return;
  if (!isSolvedBoard(board)) return;
  const previousStats = computeStats(loadStore(), todayKey);
  elapsedMs = currentElapsed();
  winShown = true;
  statusText.textContent = `Solved ${formatDuration(elapsedMs)}`;
  shareButton.hidden = false;
  saveActiveGame();
  const stats = computeStats(loadStore(), todayKey);
  setAnalyticsUserStats(stats);
  trackSolved(stats);
  if (stats.bestStreak > previousStats.bestStreak) {
    trackEvent("streak_record_reached", {
      record_streak: stats.bestStreak,
      record_streak_label: String(stats.bestStreak),
      streak_bucket: streakBucket(stats.bestStreak),
      date_key: todayKey
    });
  }
  celebrate();
}

function startTimer() {
  stopTimer();
  timerStartedAt = Date.now() - elapsedMs;
  timerId = window.setInterval(() => {
    if (!winShown) statusText.textContent = formatDuration(currentElapsed());
  }, 1000);
  statusText.textContent = winShown ? `Solved ${formatDuration(elapsedMs)}` : formatDuration(currentElapsed());
}

function stopTimer() {
  if (!timerId) return;
  if (!winShown) elapsedMs = currentElapsed();
  window.clearInterval(timerId);
  timerId = null;
}

function currentElapsed() {
  return winShown ? elapsedMs : Date.now() - timerStartedAt;
}

function saveActiveGame() {
  if (!activePuzzle || !activeDifficulty) return;
  const game = {
    seed: activePuzzle.seed,
    puzzleId: activePuzzle.id,
    puzzle: activePuzzle.puzzle,
    solution: activePuzzle.solution,
    board,
    solved: winShown,
    elapsedMs: currentElapsed(),
    completedAt: winShown ? new Date().toISOString() : null,
    conflictCount
  };
  upsertGame(store, todayKey, activeDifficulty, game);
}

async function shareResult() {
  if (!activePuzzle || !activeDifficulty || !winShown) return;
  const stats = computeStats(loadStore(), todayKey);
  const text = shareText(stats);
  const copied = await copyToClipboard(text);
  sharePreview.textContent = text;
  shareStatus.textContent = copied ? "Copied to clipboard." : "Copy this result:";
  shareModal.hidden = false;
  trackEvent("share_result", {
    difficulty: activeDifficulty,
    date_key: todayKey,
    puzzle_id: activePuzzle.id,
    elapsed_seconds: Math.floor(elapsedMs / 1000),
    current_streak: stats.currentStreak,
    current_streak_label: String(stats.currentStreak),
    best_streak: stats.bestStreak,
    streak_bucket: streakBucket(stats.currentStreak)
  });
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function shareText(stats) {
  const difficulty = difficultyLabels[activeDifficulty];
  const minutes = formatDurationWords(elapsedMs);
  const streak = stats.currentStreak === 1 ? "1 day" : `${stats.currentStreak} days`;
  return [
    "Rainboku",
    "🟥🟧🟨🟩🟦🟪",
    `I finished today's ${difficulty} Rainboku in ${minutes}.`,
    `Streak: ${streak}`,
    "Play: https://rainboku.com"
  ].join("\n");
}

function formatDurationWords(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  if (seconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}

function setAnalyticsUserStats(stats) {
  setUserStats({
    current_streak: stats.currentStreak,
    best_streak: stats.bestStreak,
    total_solved: stats.totalSolved,
    current_streak_bucket: streakBucket(stats.currentStreak),
    best_streak_bucket: streakBucket(stats.bestStreak)
  });
}

function trackSolved(stats) {
  const difficultyStats = stats.byDifficulty[activeDifficulty] || {};
  trackEvent("puzzle_solved", {
    difficulty: activeDifficulty,
    date_key: todayKey,
    puzzle_id: activePuzzle.id,
    puzzle_seed: activePuzzle.seed,
    elapsed_seconds: Math.floor(elapsedMs / 1000),
    conflict_count: conflictCount,
    current_streak: stats.currentStreak,
    current_streak_label: String(stats.currentStreak),
    best_streak: stats.bestStreak,
    best_streak_label: String(stats.bestStreak),
    streak_bucket: streakBucket(stats.currentStreak),
    total_solved: stats.totalSolved,
    difficulty_solved_days: difficultyStats.solved || 0,
    difficulty_solved_days_label: String(difficultyStats.solved || 0)
  });
}

function buildColourBar() {
  reelStrip.innerHTML = "";
  colours.forEach((colour, index) => {
    const panel = document.createElement("div");
    panel.className = "reel-panel";
    panel.dataset.colourValue = String(index + 1);
    panel.style.background = colour.hex;

    const count = document.createElement("span");
    count.className = "reel-count";
    count.textContent = "0";

    const name = document.createElement("span");
    name.className = "reel-name";
    name.textContent = colour.name;

    panel.append(count, name);
    reelStrip.appendChild(panel);
  });
  updateColourCounts();
  startColourBar();
}

function updateColourCounts() {
  const counts = Array(colours.length).fill(0);
  board.forEach((value) => {
    if (value >= 1 && value <= colours.length) counts[value - 1] += 1;
  });
  reelStrip.querySelectorAll(".reel-panel").forEach((panel) => {
    const value = Number(panel.dataset.colourValue);
    const count = counts[value - 1] || 0;
    const countEl = panel.querySelector(".reel-count");
    if (countEl) countEl.textContent = count === 9 ? "✓" : String(count);
  });
}

function startColourBar() {
  if (colourBarFrame) cancelAnimationFrame(colourBarFrame);
  colourBarStart = performance.now();
  const animate = (now) => {
    const panels = Array.from(reelStrip.querySelectorAll(".reel-panel"));
    if (!panels.length) return;
    const reelWidth = reelStrip.getBoundingClientRect().width;
    const panelWidth = panels[0].getBoundingClientRect().width;
    const cycleWidth = panelWidth * panels.length;
    const offset = ((now - colourBarStart) % colourBarCycleMs) / colourBarCycleMs * cycleWidth;
    panels.forEach((panel, index) => {
      let x = (index * panelWidth - offset) % cycleWidth;
      if (x < 0) x += cycleWidth;
      if (x > reelWidth) x -= cycleWidth;
      panel.style.transform = `translate3d(${x}px, 0, 0)`;
    });
    colourBarFrame = requestAnimationFrame(animate);
  };
  colourBarFrame = requestAnimationFrame(animate);
}

function celebrate() {
  stopConfetti();
  resizeCanvas();
  const count = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 35 : 150;
  particles = Array.from({ length: count }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: window.innerHeight * 0.28 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 8,
    vy: -6 - Math.random() * 7,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.32,
    size: 6 + Math.random() * 8,
    colour: colours[Math.floor(Math.random() * colours.length)].hex
  }));
  const start = performance.now();
  const draw = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.22;
      particle.vx *= 0.992;
      particle.rotation += particle.spin;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.colour;
      ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      ctx.restore();
    });
    ctx.restore();
    if (elapsed < 2200) {
      confettiFrame = requestAnimationFrame(draw);
    } else {
      stopConfetti();
    }
  };
  confettiFrame = requestAnimationFrame(draw);
}

function stopConfetti() {
  if (confettiFrame) cancelAnimationFrame(confettiFrame);
  confettiFrame = null;
  particles = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadLabelColours() {
  try {
    return localStorage.getItem(labelColoursKey) === "true";
  } catch {
    return false;
  }
}

function saveLabelColours(value) {
  try {
    localStorage.setItem(labelColoursKey, value ? "true" : "false");
  } catch {
    // Ignore private browsing or full storage failures.
  }
}

function labelColoursCopy() {
  const locale = navigator.language || "";
  return /^en-US\b/i.test(locale) ? "Label Colors" : "Label Colours";
}
