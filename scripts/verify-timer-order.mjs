import { readFileSync } from "node:fs";

const source = readFileSync("src/app.js", "utf8");
const checkWinMatch = source.match(/function checkWin\(\) \{[\s\S]*?\n\}/);

if (!checkWinMatch) {
  throw new Error("checkWin function not found");
}

const checkWin = checkWinMatch[0];
const elapsedIndex = checkWin.indexOf("elapsedMs = currentElapsed();");
const winShownIndex = checkWin.indexOf("winShown = true;");

if (elapsedIndex === -1 || winShownIndex === -1) {
  throw new Error("checkWin must capture elapsedMs and then mark winShown");
}

if (elapsedIndex > winShownIndex) {
  throw new Error("elapsedMs must be captured before winShown is set");
}

console.log("Timer completion order verification passed.");

const startGameMatch = source.match(/function startGame\(difficulty, options = \{\}\) \{[\s\S]*?\n\}/);

if (!startGameMatch) {
  throw new Error("startGame function not found");
}

const startGame = startGameMatch[0];
const stopTimerIndex = startGame.indexOf("stopTimer();");
const loadStoreIndex = startGame.indexOf("store = loadStore();");
const resetElapsedIndex = startGame.indexOf("elapsedMs = 0;");

if (stopTimerIndex === -1 || loadStoreIndex === -1 || resetElapsedIndex === -1) {
  throw new Error("startGame must stop the old timer before loading/resetting puzzle state");
}

if (stopTimerIndex > loadStoreIndex || stopTimerIndex > resetElapsedIndex) {
  throw new Error("startGame must stop the old timer before loading/resetting puzzle state");
}

console.log("Timer reset order verification passed.");
