import {
  countSolutions,
  generateDailyPuzzle,
  isSolvedBoard
} from "../src/sudoku.js";

const dates = ["2026-06-23", "2026-06-24", "2026-12-31"];
const difficulties = ["easy", "medium", "hard"];
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

for (const dateKey of dates) {
  const puzzlesForDate = new Set();

  for (const difficulty of difficulties) {
    const first = generateDailyPuzzle(dateKey, difficulty);
    const second = generateDailyPuzzle(dateKey, difficulty);
    const solutionBoard = first.solution.split("").map(Number);

    assert(first.puzzle.length === 81, `${dateKey} ${difficulty} puzzle has 81 cells`);
    assert(first.solution.length === 81, `${dateKey} ${difficulty} solution has 81 cells`);
    assert(first.puzzle === second.puzzle, `${dateKey} ${difficulty} generation is deterministic`);
    assert(first.solution === second.solution, `${dateKey} ${difficulty} solution is deterministic`);
    assert(countSolutions(first.puzzle, 2) === 1, `${dateKey} ${difficulty} has exactly one solution`);
    assert(isSolvedBoard(solutionBoard), `${dateKey} ${difficulty} solution is valid`);
    assert(givensMatchSolution(first.puzzle, first.solution), `${dateKey} ${difficulty} givens match solution`);

    puzzlesForDate.add(first.puzzle);
    console.log(`${dateKey} ${difficulty}: clues=${first.clues} score=${first.rating.score} generated=${first.generated}`);
  }

  assert(puzzlesForDate.size === difficulties.length, `${dateKey} difficulties produce distinct puzzles`);
}

for (const difficulty of difficulties) {
  const today = generateDailyPuzzle(dates[0], difficulty);
  const tomorrow = generateDailyPuzzle(dates[1], difficulty);
  assert(today.puzzle !== tomorrow.puzzle, `${difficulty} differs across dates`);
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("Daily puzzle verification passed.");
}

function givensMatchSolution(puzzle, solution) {
  return puzzle.split("").every((value, index) => value === "0" || value === solution[index]);
}
