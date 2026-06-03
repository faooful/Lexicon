import { BOARD_SIZE, RARE } from "./config.js";

export function buildWordsByLetter(words) {
  const wordsByLetter = {};
  for (const word of words) {
    for (const ch of word) {
      if (!wordsByLetter[ch]) wordsByLetter[ch] = [];
      wordsByLetter[ch].push(word);
    }
  }
  return wordsByLetter;
}

export function validateBoardForState(state, words) {
  const placed = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c]) placed.push({ r, c });
    }
  }
  const extracted = extractWords(state.board);
  const fragments = extracted.filter(w => w.text.length === 2);
  const realWords = extracted.filter(w => w.text.length >= 3).map(w => ({ ...w, valid: words.has(w.text) }));
  const invalidWords = realWords.filter(w => !w.valid);
  const unused = state.roll.filter(d => !d.used).length;
  const connected = placed.length > 0 && isConnected(placed);
  const unassignedWild = placed.some(({ r, c }) => state.board[r][c].face === "*" && !state.board[r][c].assigned);
  const invalidCells = [...fragments.flatMap(w => w.cells), ...invalidWords.flatMap(w => w.cells)];
  return {
    placed,
    words: realWords,
    fragments,
    invalidWords,
    invalidCells,
    unused,
    connected,
    unassignedWild,
    complete: unused === 0 && connected && placed.length === state.roll.length && !unassignedWild && fragments.length === 0 && invalidWords.length === 0 && realWords.length > 0
  };
}

export function extractWords(board) {
  const words = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    let current = [];
    for (let c = 0; c <= BOARD_SIZE; c++) {
      const cell = c < BOARD_SIZE ? board[r][c] : null;
      if (cell) current.push({ r, c, letter: cell.assigned || "" });
      if ((!cell || c === BOARD_SIZE) && current.length) {
        if (current.length >= 2) {
          words.push({ text: current.map(x => x.letter).join(""), cells: current.map(({ r, c }) => ({ r, c })), axis: "row" });
        }
        current = [];
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let current = [];
    for (let r = 0; r <= BOARD_SIZE; r++) {
      const cell = r < BOARD_SIZE ? board[r][c] : null;
      if (cell) current.push({ r, c, letter: cell.assigned || "" });
      if ((!cell || r === BOARD_SIZE) && current.length) {
        if (current.length >= 2) {
          words.push({ text: current.map(x => x.letter).join(""), cells: current.map(({ r, c }) => ({ r, c })), axis: "col" });
        }
        current = [];
      }
    }
  }
  return words;
}

export function scoreBoardForState(state, validation) {
  if (!validation) return { wordPoints: 0, intersectionPoints: 0, rarePoints: 0, upgradePoints: 0, total: 0 };
  const validWords = validation.words.filter(w => w.valid);
  const wordPoints = validWords.reduce((sum, word) => sum + word.text.length * word.text.length, 0);
  const intersectionPoints = findIntersections(state.board).size * (3 + state.upgrades.intersectionBonus);
  let rareCount = 0;
  let consonants = 0;
  validation.placed.forEach(({ r, c }) => {
    const letter = state.board[r][c].assigned;
    if (RARE.has(letter)) rareCount++;
    if (!"AEIOU".includes(letter)) consonants++;
  });
  const rarePoints = rareCount * (4 + state.upgrades.rareBonus);
  const fiveBonus = validWords.filter(w => w.text.length === 5).length * state.upgrades.fiveBonus;
  const consonantBonus = consonants * state.upgrades.consonantBonus;
  const upgradePoints = fiveBonus + consonantBonus;
  return { wordPoints, intersectionPoints, rarePoints, upgradePoints, total: wordPoints + intersectionPoints + rarePoints + upgradePoints };
}

export function checkFeasibilityForState(state, wordsByLetter) {
  const pool = {};
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.board[r][c];
      if (cell) {
        const l = cell.face === "*" ? (cell.assigned || null) : cell.letter;
        if (l) pool[l] = (pool[l] || 0) + 1;
      }
    }
  }
  const wildcards = state.roll.filter(d => !d.used && d.face === "*").length;
  state.roll.filter(d => !d.used && d.face !== "*").forEach(d => {
    pool[d.letter] = (pool[d.letter] || 0) + 1;
  });
  const stuck = [];
  state.roll.forEach((die, index) => {
    if (die.used || die.face === "*") return;
    const candidates = wordsByLetter[die.letter] || [];
    const canForm = candidates.some(word => {
      const need = {};
      for (const ch of word) need[ch] = (need[ch] || 0) + 1;
      let wildcardsNeeded = 0;
      for (const [ch, count] of Object.entries(need)) {
        const have = pool[ch] || 0;
        if (have < count) wildcardsNeeded += count - have;
      }
      return wildcardsNeeded <= wildcards;
    });
    if (!canForm) stuck.push(index);
  });
  return stuck;
}

export function isConnected(placed) {
  const placedSet = new Set(placed.map(posKey));
  const seen = new Set();
  const queue = [placed[0]];
  seen.add(posKey(placed[0]));
  while (queue.length) {
    const pos = queue.shift();
    neighbors(pos.r, pos.c).forEach(next => {
      const key = posKey(next);
      if (placedSet.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    });
  }
  return seen.size === placed.length;
}

export function neighbors(r, c) {
  return [
    { r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }
  ].filter(p => p.r >= 0 && p.r < BOARD_SIZE && p.c >= 0 && p.c < BOARD_SIZE);
}

export function findIntersections(board) {
  const words = extractWords(board).filter(w => w.text.length >= 3);
  const counts = new Map();
  words.forEach(word => word.cells.forEach(cell => {
    const key = posKey(cell);
    counts.set(key, (counts.get(key) || 0) + 1);
  }));
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

export function posKey(pos) {
  return `${pos.r},${pos.c}`;
}
