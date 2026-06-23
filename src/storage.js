const storageKey = "rainboku.daily.v1";
const difficulties = ["easy", "medium", "hard"];

export function loadStore() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      games: parsed.games && typeof parsed.games === "object" ? parsed.games : {}
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function getGame(store, dateKey, difficulty) {
  return store.games?.[dateKey]?.[difficulty] || null;
}

export function upsertGame(store, dateKey, difficulty, game) {
  if (!store.games[dateKey]) store.games[dateKey] = {};
  store.games[dateKey][difficulty] = {
    ...game,
    updatedAt: new Date().toISOString()
  };
  saveStore(store);
}

export function resetGame(store, dateKey, difficulty) {
  if (store.games[dateKey]) {
    delete store.games[dateKey][difficulty];
    if (!Object.keys(store.games[dateKey]).length) delete store.games[dateKey];
  }
  saveStore(store);
}

export function computeStats(store, todayKey) {
  const solvedEntries = [];
  const solvedByDate = new Set();
  const byDifficulty = Object.fromEntries(difficulties.map((difficulty) => [difficulty, { solved: 0, bestMs: null }]));

  Object.entries(store.games || {}).forEach(([dateKey, dailyGames]) => {
    let solvedOnDate = false;
    difficulties.forEach((difficulty) => {
      const game = dailyGames?.[difficulty];
      if (!game?.solved) return;
      solvedOnDate = true;
      solvedEntries.push({ dateKey, difficulty, elapsedMs: game.elapsedMs || 0 });
      byDifficulty[difficulty].solved += 1;
      if (game.elapsedMs && (!byDifficulty[difficulty].bestMs || game.elapsedMs < byDifficulty[difficulty].bestMs)) {
        byDifficulty[difficulty].bestMs = game.elapsedMs;
      }
    });
    if (solvedOnDate) solvedByDate.add(dateKey);
  });

  return {
    totalSolved: solvedEntries.length,
    currentStreak: currentStreak(solvedByDate, todayKey),
    bestStreak: bestStreak(solvedByDate),
    byDifficulty
  };
}

export function statusForGame(game) {
  if (!game) return "Not started";
  if (game.solved) return `Solved ${formatDuration(game.elapsedMs || 0)}`;
  if ((game.board || []).some((value) => value !== 0)) return "In progress";
  return "Not started";
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function emptyStore() {
  return { version: 1, games: {} };
}

function currentStreak(solvedByDate, todayKey) {
  let streak = 0;
  let cursor = parseLocalDate(todayKey);
  while (solvedByDate.has(formatLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function bestStreak(solvedByDate) {
  const dates = [...solvedByDate].sort();
  let best = 0;
  let current = 0;
  let previous = null;
  dates.forEach((dateKey) => {
    if (!previous || daysBetween(previous, dateKey) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    previous = dateKey;
  });
  return best;
}

function daysBetween(leftKey, rightKey) {
  const left = parseLocalDate(leftKey);
  const right = parseLocalDate(rightKey);
  return Math.round((right - left) / 86400000);
}

function parseLocalDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
