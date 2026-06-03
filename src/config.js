export const BOARD_SIZE = 5;
export const TILE = 1;
export const TOP_H = 0.18;
export const DOCK_Y = TOP_H + 1.18;
export const DRAG_Y = TOP_H + 1.42;
export const DOCK_SCALE = 0.86;
export const DIRT_H = 0.42;
export const DRAG_THRESHOLD = 5;
export const ROLL_ANIMATION_MS = 2000;
export const DEFAULT_POLAR = 0.52;
export const DEFAULT_AZIMUTH = Math.PI * 0.25;
export const DEFAULT_VIEW_SIZE = 5.8;

export const RARE = new Set(["J", "Q", "X", "Z", "K", "V", "W", "Y"]);
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const STARTING_DICE_FACES = [
  ["S", "A", "R", "T", "E", "N"],
  ["T", "E", "A", "O", "L", "R"],
  ["O", "A", "I", "N", "C", "D"],
  ["N", "R", "E", "S", "T", "M"],
  ["E", "O", "A", "L", "P", "H"],
  ["A", "I", "U", "E", "Y", "O"],
  ["L", "C", "R", "S", "D", "G"],
  ["T", "N", "M", "K", "P", "B"]
];

export const ADD_DIE_FACES = [
  ["A", "E", "I", "O", "N", "R"],
  ["S", "T", "L", "C", "D", "M"],
  ["P", "B", "G", "F", "W", "Y"],
  ["H", "V", "K", "J", "X", "Z"]
];
