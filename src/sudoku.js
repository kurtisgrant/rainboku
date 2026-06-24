export const colours = [
  { name: "Red", hex: "#e32636" },
  { name: "Orange", hex: "#ff7f00" },
  { name: "Pink", hex: "#ff4fa3" },
  { name: "Yellow", hex: "#ffd21a" },
  { name: "Lime", hex: "#7fff00" },
  { name: "Green", hex: "#00a651" },
  { name: "Cyan", hex: "#00bcd4" },
  { name: "Blue", hex: "#0066ff" },
  { name: "Violet", hex: "#7f00ff" }
];

export const difficultyLabels = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard"
};

const difficultyConfigs = {
  easy: { targetClues: 42, minClues: 39, maxClues: 45, minScore: 135, maxScore: 170, attempts: 10 },
  medium: { targetClues: 34, minClues: 31, maxClues: 37, minScore: 170, maxScore: 200, attempts: 12 },
  hard: { targetClues: 28, minClues: 25, maxClues: 31, minScore: 200, maxScore: 245, attempts: 14 }
};

const fallbackPuzzles = {
  easy: [
    { id: "fallback-easy-1", puzzle: "530070000600195000098000060800060003400803001700020006060000280000419005000080079", solution: "534678912672195348198342567859761423426853791713924856961537284287419635345286179" },
    { id: "fallback-easy-2", puzzle: "002900060007062040001500090608100000009384000320000900900000205000437080000200130", solution: "832941567597862341461573892678129453159384726324756918943618275215437689786295134" },
    { id: "fallback-easy-3", puzzle: "850030000002000176046000050009500030007100509003400080000290040000300762030065000", solution: "851637294392854176746912853189526437467183529523479681678291345915348762234765918" }
  ],
  medium: [
    { id: "fallback-medium-1", puzzle: "000260701680070090190004500820100040004602900050003028009300074040050036703018000", solution: "435269781682571493197834562826195347374682915951743628519326874248957136763418259" },
    { id: "fallback-medium-2", puzzle: "502004700070059003800060520000905041209100300304070008030006170700800690061420000", solution: "592384716176259483843761529687935241259148367314672958438596172725813694961427835" },
    { id: "fallback-medium-3", puzzle: "041006900093010020000409075010580700600001308085020009407000830060350040200760001", solution: "541276983793815624826439175914583762672941358385627419457192836169358247238764591" }
  ],
  hard: [
    { id: "fallback-hard-1", puzzle: "000000907000420180000705026100904000050000040000507009920108000034059000507000000", solution: "462831957795426183381795426173984265659312748248567319926178534834259671517643892" },
    { id: "fallback-hard-2", puzzle: "004073000800000700000018030000000013000507204000081590503024000670830000018000000", solution: "164273985839456721725918436957642813381597264246381597593124678672835149418769352" },
    { id: "fallback-hard-3", puzzle: "000680705000091026000204000000700601010020000006000204604000000750000180083000402", solution: "291683745347591826568274319832749651415326978976815234624138597759462183183957462" }
  ]
};

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function prettyDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

export function generateDailyPuzzle(dateKey, difficulty) {
  const config = difficultyConfigs[difficulty];
  if (!config) throw new Error(`Unknown difficulty: ${difficulty}`);
  const baseSeed = `rainboku:${dateKey}:${difficulty}`;
  let best = null;

  for (let attempt = 0; attempt < config.attempts; attempt += 1) {
    const seed = `${baseSeed}:${attempt}`;
    const rng = createRng(seed);
    const solution = generateSolvedGrid(rng);
    const puzzle = removeClues(solution, config, rng);
    const clues = countClues(puzzle);
    const solutionCount = countSolutions(puzzle, 2);
    if (solutionCount !== 1) continue;

    const rating = ratePuzzle(puzzle);
    const candidate = {
      id: `${difficulty}:${dateKey}:${attempt}`,
      seed,
      dateKey,
      difficulty,
      puzzle,
      solution,
      clues,
      rating,
      generated: true
    };
    if (!best || distanceFromBand(candidate, config) < distanceFromBand(best, config)) {
      best = candidate;
    }
    if (clues >= config.minClues && clues <= config.maxClues && rating.score >= config.minScore && rating.score <= config.maxScore) {
      return candidate;
    }
  }

  return fallbackForDate(dateKey, difficulty, best);
}

function fallbackForDate(dateKey, difficulty, best) {
  if (best) return best;
  const bank = fallbackPuzzles[difficulty];
  const rng = createRng(`rainboku:fallback:${dateKey}:${difficulty}`);
  const selected = bank[Math.floor(rng() * bank.length)];
  const rating = ratePuzzle(selected.puzzle);
  return {
    ...selected,
    seed: `rainboku:${dateKey}:${difficulty}:fallback`,
    dateKey,
    difficulty,
    clues: countClues(selected.puzzle),
    rating,
    generated: false
  };
}

function distanceFromBand(candidate, config) {
  const clueDistance = candidate.clues < config.minClues
    ? config.minClues - candidate.clues
    : candidate.clues > config.maxClues
      ? candidate.clues - config.maxClues
      : 0;
  const score = candidate.rating.score;
  const scoreDistance = score < config.minScore
    ? config.minScore - score
    : score > config.maxScore
      ? score - config.maxScore
      : 0;
  return clueDistance * 4 + scoreDistance;
}

function generateSolvedGrid(rng) {
  const base = 3;
  const side = 9;
  const pattern = (row, col) => (base * (row % base) + Math.floor(row / base) + col) % side;
  const rows = shuffle([0, 1, 2], rng).flatMap((band) => shuffle([0, 1, 2], rng).map((row) => band * base + row));
  const cols = shuffle([0, 1, 2], rng).flatMap((stack) => shuffle([0, 1, 2], rng).map((col) => stack * base + col));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const grid = [];
  for (const row of rows) {
    for (const col of cols) {
      grid.push(nums[pattern(row, col)]);
    }
  }
  return grid.join("");
}

function removeClues(solution, config, rng) {
  const puzzle = solution.split("").map(Number);
  const pairs = [];
  const seen = new Set();
  for (let index = 0; index < 81; index += 1) {
    if (seen.has(index)) continue;
    const mirror = 80 - index;
    seen.add(index);
    seen.add(mirror);
    pairs.push(index === mirror ? [index] : [index, mirror]);
  }

  for (const pair of shuffle(pairs, rng)) {
    const currentClues = puzzle.filter(Boolean).length;
    if (currentClues <= config.targetClues) break;
    const filled = pair.filter((index) => puzzle[index] !== 0);
    if (!filled.length || currentClues - filled.length < config.targetClues) continue;
    const removed = filled.map((index) => [index, puzzle[index]]);
    removed.forEach(([index]) => {
      puzzle[index] = 0;
    });
    if (countSolutions(puzzle.join(""), 2) !== 1) {
      removed.forEach(([index, value]) => {
        puzzle[index] = value;
      });
    }
  }

  return puzzle.join("");
}

export function countSolutions(puzzle, limit = 2) {
  const grid = puzzle.split("").map(Number);
  let count = 0;

  function search() {
    if (count >= limit) return;
    const next = findBestCell(grid);
    if (!next) {
      count += 1;
      return;
    }
    for (const value of next.options) {
      grid[next.index] = value;
      search();
      grid[next.index] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}

export function ratePuzzle(puzzle) {
  const grid = puzzle.split("").map(Number);
  let guesses = 0;
  let branchScore = 0;

  function search() {
    const next = findBestCell(grid);
    if (!next) return true;
    guesses += 1;
    branchScore += next.options.length;
    for (const value of next.options) {
      grid[next.index] = value;
      if (search()) {
        grid[next.index] = 0;
        return true;
      }
      grid[next.index] = 0;
    }
    return false;
  }

  search();
  const empty = puzzle.split("").filter((value) => value === "0").length;
  return {
    score: empty + guesses * 2 + branchScore,
    empty,
    guesses,
    branchScore
  };
}

export function isSolvedBoard(board) {
  if (!Array.isArray(board) || board.length !== 81 || board.some((value) => !value)) return false;
  const expected = "123456789";
  const sorted = (indices) => indices.map((index) => board[index]).sort().join("");
  for (let row = 0; row < 9; row += 1) {
    if (sorted(Array.from({ length: 9 }, (_, col) => row * 9 + col)) !== expected) return false;
  }
  for (let col = 0; col < 9; col += 1) {
    if (sorted(Array.from({ length: 9 }, (_, row) => row * 9 + col)) !== expected) return false;
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const indices = [];
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          indices.push((boxRow * 3 + row) * 9 + boxCol * 3 + col);
        }
      }
      if (sorted(indices) !== expected) return false;
    }
  }
  return true;
}

export function conflictSet(board) {
  const conflicts = new Set();
  const units = [];
  for (let row = 0; row < 9; row += 1) {
    units.push(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  }
  for (let col = 0; col < 9; col += 1) {
    units.push(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const box = [];
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          box.push((boxRow * 3 + row) * 9 + boxCol * 3 + col);
        }
      }
      units.push(box);
    }
  }
  units.forEach((unit) => {
    const seen = new Map();
    unit.forEach((index) => {
      const value = board[index];
      if (!value) return;
      const existing = seen.get(value) || [];
      existing.push(index);
      seen.set(value, existing);
    });
    seen.forEach((indices) => {
      if (indices.length > 1) indices.forEach((index) => conflicts.add(index));
    });
  });
  return conflicts;
}

function findBestCell(grid) {
  let best = null;
  for (let index = 0; index < 81; index += 1) {
    if (grid[index]) continue;
    const options = candidates(grid, index);
    if (!options.length) return { index, options };
    if (!best || options.length < best.options.length) {
      best = { index, options };
      if (options.length === 1) break;
    }
  }
  return best;
}

function candidates(grid, index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Set();
  for (let i = 0; i < 9; i += 1) {
    used.add(grid[row * 9 + i]);
    used.add(grid[i * 9 + col]);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      used.add(grid[(boxRow + r) * 9 + boxCol + c]);
    }
  }
  const options = [];
  for (let value = 1; value <= 9; value += 1) {
    if (!used.has(value)) options.push(value);
  }
  return options;
}

function createRng(seed) {
  return mulberry32(xmur3(seed)());
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function hash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function countClues(puzzle) {
  return puzzle.split("").filter((value) => value !== "0").length;
}
