import test from "node:test";
import assert from "node:assert/strict";

import { createBaseDice, createInitialState, createStarterRoll, emptyBoard, STARTER_ROLL_LETTERS } from "../src/state.js";
import {
  buildWordsByLetter,
  checkFeasibilityForState,
  extractWords,
  scoreBoardForState,
  validateBoardForState
} from "../src/rules.js";

function createState() {
  const state = createInitialState(createBaseDice());
  state.board = emptyBoard();
  state.roll = [];
  return state;
}

function place(state, r, c, letter, rollIndex = state.roll.length) {
  const die = {
    id: `die-${rollIndex}`,
    dieId: rollIndex + 1,
    face: letter,
    letter,
    assigned: letter,
    used: true
  };
  state.roll[rollIndex] = die;
  state.board[r][c] = { ...die, rollIndex, dieFaces: [letter] };
}

function placeRolledDie(state, rollIndex, r, c) {
  const die = state.roll[rollIndex];
  die.used = true;
  state.board[r][c] = { ...die, rollIndex, dieFaces: [die.letter] };
}

test("extractWords returns horizontal and vertical runs of at least two cells", () => {
  const state = createState();
  place(state, 0, 0, "C", 0);
  place(state, 0, 1, "A", 1);
  place(state, 0, 2, "T", 2);
  place(state, 1, 0, "A", 3);
  place(state, 2, 0, "R", 4);

  assert.deepEqual(
    extractWords(state.board).map(word => `${word.axis}:${word.text}`).sort(),
    ["col:CAR", "row:CAT"]
  );
});

test("validateBoard requires connected dice, no fragments, no unknown words, and no unused dice", () => {
  const state = createState();
  place(state, 0, 0, "C", 0);
  place(state, 0, 1, "A", 1);
  place(state, 0, 2, "T", 2);

  const validation = validateBoardForState(state, new Set(["CAT"]));

  assert.equal(validation.complete, true);
  assert.equal(validation.connected, true);
  assert.equal(validation.unused, 0);
  assert.equal(validation.invalidWords.length, 0);
  assert.equal(validation.fragments.length, 0);
});

test("validateBoard flags disconnected dice and two-letter fragments", () => {
  const state = createState();
  place(state, 0, 0, "C", 0);
  place(state, 0, 1, "A", 1);
  place(state, 4, 4, "T", 2);

  const validation = validateBoardForState(state, new Set(["CAT"]));

  assert.equal(validation.complete, false);
  assert.equal(validation.connected, false);
  assert.deepEqual(validation.fragments.map(fragment => fragment.text), ["CA"]);
});

test("scoreBoard applies word, intersection, rare-letter, and upgrade bonuses", () => {
  const state = createState();
  state.upgrades.intersectionBonus = 2;
  state.upgrades.rareBonus = 3;
  state.upgrades.fiveBonus = 6;
  place(state, 0, 0, "Q", 0);
  place(state, 0, 1, "U", 1);
  place(state, 0, 2, "I", 2);
  place(state, 0, 3, "Z", 3);
  place(state, 0, 4, "E", 4);
  place(state, 1, 0, "A", 5);
  place(state, 2, 0, "D", 6);

  const validation = validateBoardForState(state, new Set(["QUIZE", "QAD"]));
  const score = scoreBoardForState(state, validation);

  assert.equal(score.wordPoints, 34);
  assert.equal(score.intersectionPoints, 5);
  assert.equal(score.rarePoints, 14);
  assert.equal(score.upgradePoints, 6);
  assert.equal(score.total, 59);
});

test("checkFeasibility flags unused non-wild dice that cannot form any candidate word", () => {
  const state = createState();
  state.roll = [
    { id: "a", dieId: 1, face: "Q", letter: "Q", assigned: "Q", used: false },
    { id: "b", dieId: 2, face: "A", letter: "A", assigned: "A", used: false },
    { id: "c", dieId: 3, face: "T", letter: "T", assigned: "T", used: false }
  ];

  const stuck = checkFeasibilityForState(state, buildWordsByLetter(new Set(["AT"])));

  assert.deepEqual(stuck, [0]);
});

test("createStarterRoll returns valid unused roll items from the starting dice", () => {
  const state = createInitialState(createBaseDice());
  const roll = createStarterRoll(state);

  assert.equal(roll.length, state.dice.length);
  assert.deepEqual(roll.map(die => die.letter), STARTER_ROLL_LETTERS);
  roll.forEach((die, index) => {
    assert.equal(die.face, STARTER_ROLL_LETTERS[index]);
    assert.equal(die.assigned, STARTER_ROLL_LETTERS[index]);
    assert.equal(die.used, false);
    assert.equal(state.dice[index].faces.includes(die.letter), true);
  });
});

test("starter roll supports a complete CART, ART, and TEA crossword", () => {
  const state = createInitialState(createBaseDice());
  state.roll = createStarterRoll(state);
  state.board = emptyBoard();

  placeRolledDie(state, 2, 1, 0); // C
  placeRolledDie(state, 0, 1, 1); // A
  placeRolledDie(state, 3, 1, 2); // R
  placeRolledDie(state, 1, 1, 3); // T
  placeRolledDie(state, 6, 2, 1); // R
  placeRolledDie(state, 7, 3, 1); // T
  placeRolledDie(state, 4, 2, 3); // E
  placeRolledDie(state, 5, 3, 3); // A

  const validation = validateBoardForState(state, new Set(["CART", "ART", "TEA"]));
  const score = scoreBoardForState(state, validation);

  assert.equal(validation.complete, true);
  assert.deepEqual(validation.words.map(word => word.text).sort(), ["ART", "CART", "TEA"]);
  assert.equal(score.wordPoints, 34);
  assert.equal(score.intersectionPoints, 6);
  assert.equal(score.total, 40);
});
