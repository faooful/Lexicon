import { BOARD_SIZE, STARTING_DICE_FACES } from "./config.js";

export function createBaseDice() {
  return STARTING_DICE_FACES.map((faces, i) => ({
    id: i + 1,
    faces: [...faces],
    wild: false,
    upgrades: []
  }));
}

export function cloneDice(baseDice) {
  return baseDice.map(die => ({
    id: die.id,
    faces: [...die.faces],
    wild: die.wild,
    upgrades: [...die.upgrades]
  }));
}

export function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

export function createInitialState(baseDice) {
  return {
    round: 1,
    score: 0,
    target: 24,
    rerollsBase: 1,
    rerolls: 1,
    nextDieId: baseDice.length + 1,
    dice: cloneDice(baseDice),
    roll: [],
    board: emptyBoard(),
    locked: false,
    isRolling: false,
    rollAnimationId: 0,
    rollStartedAt: 0,
    traySettlingUntil: 0,
    selectedWildIndex: null,
    upgrades: {
      intersectionBonus: 0,
      fiveBonus: 0,
      rareBonus: 0,
      consonantBonus: 0
    },
    lastValidation: null,
    lastScore: null,
    stuckDice: []
  };
}

export function rollDice(state) {
  return state.dice.map(die => {
    const letter = die.faces[Math.floor(Math.random() * die.faces.length)];
    return {
      id: `${state.round}-${die.id}-${Math.random().toString(36).slice(2)}`,
      dieId: die.id,
      face: letter,
      letter,
      assigned: letter === "*" ? "" : letter,
      used: false
    };
  });
}
