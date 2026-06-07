import {
  ADD_DIE_FACES,
  BOARD_SIZE,
  DEFAULT_AZIMUTH,
  DEFAULT_POLAR,
  DEFAULT_VIEW_SIZE,
  DIRT_H,
  DOCK_SCALE,
  DOCK_Y,
  DRAG_Y,
  LETTERS,
  ROLL_ANIMATION_MS,
  TOP_H
} from "./config.js";
import { castReceive, disposeObject, makeLetterDie } from "./dice3d.js";
import {
  buildWordsByLetter,
  checkFeasibilityForState,
  scoreBoardForState,
  validateBoardForState
} from "./rules.js";
import { createBaseDice, createInitialState, emptyBoard, rollDice as rollDiceForState } from "./state.js";

const WORDS = new Set(window.LEXICON_WORDS || []);
const WORDS_BY_LETTER = buildWordsByLetter(WORDS);

const els = {
  app: document.getElementById("app"),
  round: document.getElementById("roundStat"),
  score: document.getElementById("scoreStat"),
  target: document.getElementById("targetStat"),
  status: document.getElementById("status"),
  tray: document.getElementById("diceTray"),
  wildPicker: document.getElementById("wildPicker"),
  wordList: document.getElementById("wordList"),
  breakdown: document.getElementById("breakdown"),
  reroll: document.getElementById("rerollBtn"),
  clear: document.getElementById("clearBtn"),
  newRun: document.getElementById("newRunBtn"),

  modal: document.getElementById("upgradeModal"),
  upgradeGrid: document.getElementById("upgradeGrid"),
  upgradeSummary: document.getElementById("upgradeSummary"),
  perspBtn: document.getElementById("perspBtn"),
  resetCamBtn: document.getElementById("resetCamBtn")
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
els.app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101211);

let viewSize = 5.8;
let azimuth = Math.PI * 0.25;
let polar = 0.52;
const target = new THREE.Vector3(0, 0, 0);
const cameraPan = new THREE.Vector3(0, 0, 0);
const desiredCameraPan = new THREE.Vector3(0, 0, 0);
const aspect0 = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(-viewSize * aspect0, viewSize * aspect0, viewSize, -viewSize, 0.1, 200);
const perspCamera = new THREE.PerspectiveCamera(48, aspect0, 0.1, 200);
let usePerspective = false;

function updateCamera() {
  const r = 12;
  target.copy(cameraPan);
  const cx = target.x + r * Math.sin(polar) * Math.cos(azimuth);
  const cy = target.y + r * Math.cos(polar);
  const cz = target.z + r * Math.sin(polar) * Math.sin(azimuth);
  camera.position.set(cx, cy, cz);
  camera.lookAt(target);
  perspCamera.position.set(cx, cy, cz);
  perspCamera.lookAt(target);
  if (state.roll?.length) renderDiceTray();
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4f3d, 0.38));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(6, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 28;
scene.add(sun);

const M = {
  grass: new THREE.MeshLambertMaterial({ color: 0x8fbf4d }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x5b351d }),
  tile: new THREE.MeshLambertMaterial({ color: 0xf0eadb }),
  tileSide: new THREE.MeshLambertMaterial({ color: 0xcdbf9d }),
  hover: new THREE.MeshBasicMaterial({ color: 0xe4b84e, transparent: true, opacity: 0.28, depthWrite: false }),
  hoverBad: new THREE.MeshBasicMaterial({ color: 0xdc7565, transparent: true, opacity: 0.32, depthWrite: false }),
  boardLine: new THREE.MeshBasicMaterial({ color: 0x1c211d, transparent: true, opacity: 0.16 })
};

function roundedSlab(size, height, radius = 0.07) {
  const w = size / 2;
  const r = Math.min(radius, w - 0.01);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -w);
  shape.lineTo(w - r, -w);
  shape.quadraticCurveTo(w, -w, w, -w + r);
  shape.lineTo(w, w - r);
  shape.quadraticCurveTo(w, w, w - r, w);
  shape.lineTo(-w + r, w);
  shape.quadraticCurveTo(-w, w, -w, w - r);
  shape.lineTo(-w, -w + r);
  shape.quadraticCurveTo(-w, -w, -w + r, -w);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 4
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}
const boardGroup = new THREE.Group();
const tileGroup = new THREE.Group();
const pieceGroup = new THREE.Group();
const rollStageGroup = new THREE.Group();
boardGroup.add(tileGroup, pieceGroup, rollStageGroup);
scene.add(boardGroup);

function tilePos(c, r) {
  return new THREE.Vector3(c - BOARD_SIZE / 2 + 0.5, 0, r - BOARD_SIZE / 2 + 0.5);
}

function makeBoardTile(c, r) {
  const group = new THREE.Group();
  const dirt = new THREE.Mesh(roundedSlab(0.98, DIRT_H, 0.06), M.dirt);
  dirt.position.y = -DIRT_H;
  group.add(dirt);
  const top = new THREE.Mesh(roundedSlab(0.98, TOP_H, 0.06), M.grass);
  group.add(top);
  const inset = new THREE.Mesh(roundedSlab(0.78, 0.025, 0.04), M.boardLine);
  inset.position.y = TOP_H + 0.012;
  group.add(inset);
  group.position.copy(tilePos(c, r));
  group.userData = { gx: c, gz: r, kind: "board-tile" };
  return castReceive(group);
}

function buildBoard() {
  tileGroup.clear();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      tileGroup.add(makeBoardTile(c, r));
    }
  }
}

const hoverMesh = new THREE.Mesh(roundedSlab(1.02, 0.035, 0.07), M.hover);
hoverMesh.position.y = TOP_H + 0.035;
hoverMesh.visible = false;
scene.add(hoverMesh);

const dropAnims = [];
const dockAnims = [];
const easeOutBack = (t, c1 = 1.70158) => {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Pre-allocated scratch objects for tickRollStage — avoids per-frame GC pressure
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _qC = new THREE.Quaternion();
const _v3 = new THREE.Vector3();
const _vW = new THREE.Vector3();
const _vY = new THREE.Vector3(0, 1, 0);
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _dragOffset = new THREE.Vector3();
const _targetQ = new THREE.Quaternion();
const _tiltQ = new THREE.Quaternion();
const _dockQ = new THREE.Quaternion();
const _dockNormal = new THREE.Vector3();
const _idleQ = new THREE.Quaternion();
const _tiltAxisA = new THREE.Vector3(1, 0, 0);
const _tiltAxisB = new THREE.Vector3(0, 0, 1);

function animateDrop(obj, distance = 1.4, dur = 0.42) {
  const baseY = obj.position.y;
  obj.position.y = baseY + distance;
  dropAnims.push({ obj, baseY, distance, dur, t: 0 });
}

function tickDropAnims(dt) {
  for (let i = dropAnims.length - 1; i >= 0; i--) {
    const anim = dropAnims[i];
    anim.t += dt;
    const u = Math.min(1, anim.t / anim.dur);
    anim.obj.position.y = anim.baseY + anim.distance * (1 - easeOutBack(u));
    if (u >= 1) {
      anim.obj.position.y = anim.baseY;
      dropAnims.splice(i, 1);
    }
  }
}

function tickDockAnims(dt) {
  let changed = false;
  for (let i = dockAnims.length - 1; i >= 0; i--) {
    const anim = dockAnims[i];
    anim.t += dt;
    const localT = Math.max(0, anim.t - anim.delay);
    if (localT <= 0) continue;
    const u = Math.min(1, localT / anim.dur);
    const eased = 1 - Math.pow(1 - u, 3);
    anim.piece.position.lerpVectors(anim.fromPosition, anim.toPosition, eased);
    anim.piece.quaternion.copy(anim.fromQuaternion).slerp(anim.toQuaternion, eased);
    anim.piece.scale.setScalar(anim.fromScale.x + (anim.toScale.x - anim.fromScale.x) * eased);
    anim.piece.position.y += Math.sin(eased * Math.PI) * 0.36;
    changed = true;
    if (u >= 1) {
      anim.piece.position.copy(anim.toPosition);
      anim.piece.quaternion.copy(anim.toQuaternion);
      anim.piece.scale.copy(anim.toScale);
      setDockHome(anim.piece, anim.toPosition, anim.toQuaternion);
      dockAnims.splice(i, 1);
    }
  }
  if (changed) renderDiceTray();
}

function tickDockIdle(now) {
  if (state.isRolling || drag || dockAnims.length) return;
  let changed = false;
  rollStageGroup.children.forEach((piece, index) => {
    if (!piece.visible || state.roll[index]?.used || !piece.userData.dockPosition || !piece.userData.dockQuaternion) return;
    const phase = now * 0.0018 + index * 0.74;
    const bob = Math.sin(phase) * 0.055;
    const sway = Math.sin(phase * 0.72 + 1.4) * 0.024;
    piece.position.copy(piece.userData.dockPosition);
    piece.position.y += bob;
    _idleQ.setFromAxisAngle(_dockNormal.copy(piece.userData.dockPosition).sub(target).normalize(), sway);
    piece.quaternion.copy(piece.userData.dockQuaternion).premultiply(_idleQ);
    changed = true;
  });
  if (changed) renderDiceTray();
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPoint = new THREE.Vector3();
const homePoint = new THREE.Vector3();
const screenWorldPoint = new THREE.Vector3();
const screenWorldDir = new THREE.Vector3();
const screenPoint = new THREE.Vector3();

function resolvePointerBoardTarget(clientX, clientY) {
  const visualTarget = resolveScreenBoardTarget(clientX, clientY, "pointer", { maxNearestDistance: 68 });
  if (visualTarget) return visualTarget;

  const point = pointerToPlanePoint(clientX, clientY, TOP_H + 0.02, homePoint);
  if (!point) return null;
  return resolveWorldBoardTarget(point, "pointer");
}

function resolveDragBoardTarget() {
  if (!drag?.object) return null;
  const projected = projectWorldToScreen(drag.object.position, screenPoint);
  return resolveScreenBoardTarget(projected.x, projected.y, "drag", { maxNearestDistance: 92 })
    || resolveWorldBoardTarget(drag.object.position, "drag");
}

function resolveDropBoardTarget(clientX, clientY) {
  return resolveDragBoardTarget() || resolvePointerBoardTarget(clientX, clientY);
}

function resolveWorldBoardTarget(point, source) {
  const c = Math.floor(point.x + BOARD_SIZE / 2);
  const r = Math.floor(point.z + BOARD_SIZE / 2);
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
  return createBoardTarget(r, c, source);
}

function resolveScreenBoardTarget(clientX, clientY, source, options = {}) {
  const { maxNearestDistance = 68, occupiedOnly = false } = options;
  let nearest = null;
  let nearestDistance = Infinity;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const occupied = Boolean(state.board?.[r]?.[c]);
      if (occupiedOnly && !occupied) continue;

      const corners = projectedTileCorners(c, r);
      if (pointInPolygon(clientX, clientY, corners)) return createBoardTarget(r, c, source);

      const center = projectWorldToScreen(tileCenter(c, r), screenPoint);
      const distance = Math.hypot(clientX - center.x, clientY - center.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { r, c };
      }
    }
  }

  if (nearest && nearestDistance <= maxNearestDistance) {
    return createBoardTarget(nearest.r, nearest.c, source);
  }
  return null;
}

function projectedTileCorners(c, r) {
  const center = tileCenter(c, r);
  return [
    projectWorldToScreen(new THREE.Vector3(center.x - 0.5, center.y, center.z - 0.5)),
    projectWorldToScreen(new THREE.Vector3(center.x + 0.5, center.y, center.z - 0.5)),
    projectWorldToScreen(new THREE.Vector3(center.x + 0.5, center.y, center.z + 0.5)),
    projectWorldToScreen(new THREE.Vector3(center.x - 0.5, center.y, center.z + 0.5))
  ];
}

function tileCenter(c, r) {
  const center = tilePos(c, r);
  center.y = TOP_H + 0.06;
  return center;
}

function projectWorldToScreen(point, out = new THREE.Vector3()) {
  const activeCamera = usePerspective ? perspCamera : camera;
  out.copy(point).project(activeCamera);
  out.x = (out.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-out.y * 0.5 + 0.5) * window.innerHeight;
  return out;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function createBoardTarget(r, c, source) {
  return {
    c,
    r,
    source,
    occupied: Boolean(state.board?.[r]?.[c]),
    cell: state.board?.[r]?.[c] || null
  };
}

function pickPlacedPiece(clientX, clientY) {
  const occupiedTarget = resolveScreenBoardTarget(clientX, clientY, "placed", {
    maxNearestDistance: 118,
    occupiedOnly: true
  });
  if (occupiedTarget?.cell) {
    return { ...occupiedTarget.cell, r: occupiedTarget.r, c: occupiedTarget.c };
  }

  const target = resolvePointerBoardTarget(clientX, clientY);
  if (target?.cell) {
    return { ...target.cell, r: target.r, c: target.c };
  }

  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, usePerspective ? perspCamera : camera);
  const hits = raycaster.intersectObjects(pieceGroup.children, true);
  for (const hit of hits) {
    let n = hit.object;
    while (n && n.userData.rollIndex === undefined) n = n.parent;
    if (n && n.userData.rollIndex !== undefined) return n.userData;
  }
  return null;
}

function pointerToDragPoint(clientX, clientY) {
  return pointerToPlanePoint(clientX, clientY, DRAG_Y, dragPoint);
}

function pointerToPlanePoint(clientX, clientY, planeY, out) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  const activeCamera = usePerspective ? perspCamera : camera;
  activeCamera.updateMatrixWorld(true);
  screenWorldPoint.set(ndc.x, ndc.y, usePerspective ? 0.5 : 0).unproject(activeCamera);
  if (usePerspective) {
    screenWorldDir.copy(screenWorldPoint).sub(activeCamera.position).normalize();
  } else {
    activeCamera.getWorldDirection(screenWorldDir);
  }
  if (Math.abs(screenWorldDir.y) < 1e-5) return null;
  const t = (planeY - screenWorldPoint.y) / screenWorldDir.y;
  if (!Number.isFinite(t)) return null;
  out.copy(screenWorldPoint).addScaledVector(screenWorldDir, t);
  return out;
}

const baseDice = createBaseDice();

let state = {};
let drag = null;
let currentHover = null;
let rollAnimationSerial = 0;
const trayButtons = new Map();
const boardPiecesByKey = new Map();

function newRun() {
  state = createInitialState(baseDice);
  startRound();
}

function startRound() {
  state.board = emptyBoard();
  state.locked = false;
  state.isRolling = false;
  state.selectedWildIndex = null;
  state.rerolls = state.rerollsBase;
  state.roll = rollDiceForState(state);
  state.lastValidation = null;
  state.lastScore = null;
  els.modal.classList.remove("show");
  beginRollAnimation();
}

function renderAll(options = {}) {
  const { pieces = true } = options;
  els.round.textContent = state.round;
  els.score.textContent = state.score;
  els.target.textContent = state.target;
  els.reroll.textContent = `Reroll ${state.rerolls}`;
  els.reroll.disabled = state.isRolling || state.rerolls <= 0 || state.locked;
  els.clear.disabled = state.isRolling || state.locked;
  els.newRun.disabled = state.isRolling;
  renderDiceTray();
  renderWildcardPicker();
  if (pieces) renderPieces();
  renderValidation();
  if (state.isRolling) setStatus("Rolling dice", "Your letters are landing below the board.", "ready");
}

function renderDiceTray() {
  const traySettling = Date.now() < (state.traySettlingUntil || 0);
  els.tray.classList.toggle("rolling", Boolean(state.isRolling));
  els.tray.classList.toggle("settling", traySettling);
  const liveIds = new Set();
  state.roll.forEach((die, index) => {
    liveIds.add(die.id);
    const source = state.dice.find(d => d.id === die.dieId);
    const faceText = source ? source.faces.join(" ") : "";
    const isMutated = source && (source.upgrades.length > 0 || source.faces.length > 6);
    const layout = trayDieLayout(index, state.roll.length);
    const hitbox = rollStageHitbox(index, layout);
    const cardCenterX = hitbox.left + hitbox.width / 2;
    const cardCenterY = hitbox.top + hitbox.height / 2;
    const flySource = rollFlySource(index, state.roll.length);
    const btn = getTrayButton(die, index);
    btn.className = `die${die.face === "*" ? " wild" : ""}${source?.wild ? " has-wild" : ""}${isMutated ? " mutated" : ""}${die.used ? " used" : ""}${drag?.rollIndex === index ? " dragging" : ""}${state.stuckDice?.includes(index) ? " stuck" : ""}`;
    btn.disabled = state.isRolling || die.used || state.locked;
    btn.style.pointerEvents = die.used ? "none" : "";
    btn.title = `D${die.dieId}: ${faceText}`;
    btn.style.left = `${hitbox.left}px`;
    btn.style.top = `${hitbox.top}px`;
    btn.style.width = `${hitbox.width}px`;
    btn.style.height = `${hitbox.height}px`;
    btn.style.transitionDelay = state.isRolling ? "0ms" : `${80 + index * 28}ms`;
    btn.style.setProperty("--fly-x", `${flySource.x - cardCenterX}px`);
    btn.style.setProperty("--fly-y", `${flySource.y - cardCenterY}px`);
    btn.style.setProperty("--fly-r", `${[-14, 11, -8, 15, 9, -12, 13, -10][index % 8]}deg`);
    btn.style.setProperty("--settle-delay", `${index * 38}ms`);
    const content = `
      <span class="die-id">D${die.dieId}</span>
      <span class="die-current">${die.face === "*" ? (die.assigned || "*") : die.letter}</span>
      <span class="die-faces">${faceText}</span>
    `;
    if (btn.dataset.content !== content) {
      btn.innerHTML = content;
      btn.dataset.content = content;
    }
  });
  for (const [id, btn] of trayButtons) {
    if (!liveIds.has(id)) {
      btn.remove();
      trayButtons.delete(id);
    }
  }
  syncRollStageDiceVisuals();
}

function getTrayButton(die, index) {
  let btn = trayButtons.get(die.id);
  if (btn) {
    btn.dataset.index = String(index);
    return btn;
  }
  btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.index = String(index);
  btn.addEventListener("pointerdown", event => beginDieDrag(event, Number(btn.dataset.index)));
  btn.addEventListener("click", () => {
    const rollIndex = Number(btn.dataset.index);
    const selected = state.roll[rollIndex];
    if (selected?.face === "*" && !selected.used && !state.locked) {
      state.selectedWildIndex = rollIndex;
      renderWildcardPicker();
    }
  });
  trayButtons.set(die.id, btn);
  els.tray.appendChild(btn);
  return btn;
}

function rollStageHitbox(index, fallbackLayout) {
  const piece = rollStageGroup.children[index];
  if (piece) {
    const point = piece.position.clone().project(usePerspective ? perspCamera : camera);
    const x = (point.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-point.y * 0.5 + 0.5) * window.innerHeight;
    const size = Math.max(74, Math.min(118, window.innerWidth * 0.078));
    return {
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size
    };
  }
  const cols = Math.ceil(state.roll.length / 2);
  const fallbackWidth = Math.min(640, Math.max(430, window.innerWidth - 760));
  const fallbackHeight = Math.max(178, Math.min(214, window.innerWidth * 0.18));
  const left = window.innerWidth / 2 - fallbackWidth / 2 + fallbackWidth * (fallbackLayout.left / 100);
  const top = window.innerHeight - 18 - fallbackHeight + fallbackHeight * (fallbackLayout.top / 100);
  return {
    left,
    top,
    width: fallbackWidth * (fallbackLayout.width / 100),
    height: fallbackHeight * (fallbackLayout.height / 100),
    cols
  };
}

function syncRollStageDiceVisuals() {
  rollStageGroup.children.forEach((piece, index) => {
    if (drag?.object === piece) return;
    const isUnavailable = state.roll[index]?.used || state.locked;
    piece.visible = !isUnavailable || state.isRolling;
    piece.scale.setScalar(state.stuckDice?.includes(index) ? 1.02 : 0.96);
  });
}

function trayDieLayout(index, count) {
  const cols = Math.ceil(count / 2);
  const row = index >= cols ? 1 : 0;
  const col = row ? index - cols : index;
  const width = Math.min(22, 82 / cols);
  const height = count > 4 ? 40 : 62;
  const gap = (100 - width * cols) / (cols + 1);
  const rowTop = count > 4 ? [7, 53] : [19];
  const top = rowTop[row];
  return {
    left: gap + col * (width + gap),
    top,
    width,
    height,
    sceneX: -2.58 + col * (5.16 / Math.max(cols - 1, 1)),
    sceneZ: row ? 0.98 : -0.88,
    rotationY: [-0.22, 0.14, -0.08, 0.2, 0.1, -0.18, 0.16, -0.12][index % 8],
    rotationZ: 0
  };
}

function rollFlySource(index, count) {
  const cols = Math.ceil(count / 2);
  const row = index >= cols ? 1 : 0;
  const col = row ? index - cols : index;
  const span = Math.min(340, Math.max(110, (cols - 1) * 74));
  const x = window.innerWidth * 0.5 + (cols === 1 ? 0 : -span / 2 + col * (span / (cols - 1)));
  const y = window.innerHeight * 0.47 + (row ? 54 : -54);
  return { x, y };
}

function makeTrayDieCell(die, source) {
  return {
    ...die,
    assigned: die.face === "*" ? die.assigned || "*" : die.assigned,
    dieFaces: source ? [...source.faces] : [die.assigned || die.letter || "*"]
  };
}

function beginRollAnimation() {
  state.stuckDice = [];
  state.isRolling = true;
  state.traySettlingUntil = 0;
  state.rollAnimationId = ++rollAnimationSerial;
  state.rollStartedAt = performance.now();
  buildRollStage();
  renderAll();
  window.setTimeout(() => finishRollAnimation(state.rollAnimationId), ROLL_ANIMATION_MS);
}

function finishRollAnimation(animationId) {
  if (!state.isRolling || animationId !== state.rollAnimationId) return;
  tickRollStage(performance.now());
  state.isRolling = false;
  state.traySettlingUntil = Date.now() + 820;
  startDockAnimation();
  syncRollStageDiceVisuals();
  validateAndMaybeComplete();
  window.setTimeout(() => {
    if (animationId === state.rollAnimationId) renderDiceTray();
  }, 860);
}

function settleRollStageDice() {
  rollStageGroup.children.forEach((piece, index) => {
    const home = rollDockPosition(index, rollStageGroup.children.length);
    piece.position.set(home.x, DOCK_Y, home.z);
    piece.quaternion.copy(dockFaceQuaternion(piece.position, index));
    piece.scale.setScalar(DOCK_SCALE);
    setDockHome(piece, piece.position, piece.quaternion);
    piece.userData.collOffsetX = 0;
    piece.userData.collOffsetZ = 0;
  });
}

function setDockHome(piece, position, quaternion) {
  piece.userData.dockPosition = position.clone();
  piece.userData.dockQuaternion = quaternion.clone();
}

function startDockAnimation() {
  dockAnims.length = 0;
  rollStageGroup.children.forEach((piece, index) => {
    const dock = rollDockPosition(index, rollStageGroup.children.length);
    dockAnims.push({
      piece,
      fromPosition: piece.position.clone(),
      toPosition: new THREE.Vector3(dock.x, DOCK_Y, dock.z),
      fromQuaternion: piece.quaternion.clone(),
      toQuaternion: dockFaceQuaternion(new THREE.Vector3(dock.x, DOCK_Y, dock.z), index).clone(),
      fromScale: piece.scale.clone(),
      toScale: new THREE.Vector3(DOCK_SCALE, DOCK_SCALE, DOCK_SCALE),
      delay: index * 0.026,
      dur: 0.72,
      t: 0
    });
    piece.userData.collOffsetX = 0;
    piece.userData.collOffsetZ = 0;
  });
}

function dockFaceQuaternion(position, index) {
  const activeCamera = usePerspective ? perspCamera : camera;
  activeCamera.updateMatrixWorld(true);
  _dockNormal.copy(activeCamera.position).sub(position).normalize();
  _dockNormal.multiplyScalar(0.94).addScaledVector(_vY, 0.06).normalize();
  _dockQ.setFromUnitVectors(_vY, _dockNormal);
  _tiltQ.setFromAxisAngle(_dockNormal, Math.PI * 0.25 + [-0.025, 0.02, -0.015, 0.025, 0.02, -0.02, 0.015, -0.015][index % 8]);
  return _dockQ.premultiply(_tiltQ);
}

function clearRollStage() {
  while (rollStageGroup.children.length) {
    const child = rollStageGroup.children.pop();
    disposeObject(child);
  }
}

function buildRollStage() {
  clearRollStage();
  state.roll.forEach((die, index) => {
    const source = state.dice.find(d => d.id === die.dieId);
    const piece = makeLetterDie(makeTrayDieCell(die, source), true);
    // Center the die mesh at the group origin so it rotates around its own centre.
    // makeLetterDie offsets the die to y=0.41 for board placement; here we reset it
    // so the group position represents the die's centre, not its bottom face.
    piece.children[0].position.y = 0;
    const home = rollStagePosition(index, state.roll.length);
    const lane = rollLane(index, state.roll.length, home);
    const baseRotY = [-0.32, 0.26, -0.18, 0.36, 0.22, -0.28, 0.18, -0.2][index % 8];
    piece.userData = {
      homeX: home.x,
      homeZ: home.z,
      startX: lane.startX,
      startZ: lane.startZ,
      endX: lane.endX,
      endZ: lane.endZ,
      laneOffset: lane.laneOffset,
      rollDistance: lane.rollDistance,
      rollDirection: lane.rollDirection,
      baseRotationY: baseRotY,
      // Primary tumble axis: perpendicular to direction of travel so the die pitches
      // forward like a rolling wheel — this is the key to a "rolling" vs "sliding" feel.
      // For travel direction θ, the perpendicular rolling axis is (sin θ, 0, -cos θ).
      tumbleX: Math.sin(lane.rollDirection),
      tumbleZ: -Math.cos(lane.rollDirection),
      // Secondary wobble axis: along the travel direction — adds side-to-side lean
      wobbleX: Math.cos(lane.rollDirection),
      wobbleZ: Math.sin(lane.rollDirection),
      // Two clean rotations — spinCount=2 → 4π → exact identity at t=1 (cleanest math)
      spinCount: 2,
      // Stagger: each die starts 40ms after previous
      dropDelay: index * 0.040,
      // Target quaternion — face-up with per-die yaw
      targetQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, baseRotY, 0)),
      // Persistent collision offset — accumulated each frame so push-apart
      // doesn't fight the lerp (die stays where it was pushed, no oscillation)
      collOffsetX: 0,
      collOffsetZ: 0
    };
    piece.scale.setScalar(0.96);
    // Start position: group Y = die CENTRE height (since die is now centred at origin).
    // seatedY in tickRollStage is TOP_H + 0.41 (centre of die when resting on board).
    piece.position.set(piece.userData.startX, TOP_H + 0.41 + 0.55, piece.userData.startZ);
    rollStageGroup.add(piece);
  });
  tickRollStage(performance.now());
}

function rollStagePosition(index, count) {
  const cols = Math.ceil(count / 2);
  const row = index >= cols ? 1 : 0;
  const col = row ? index - cols : index;
  const span = Math.min(6.4, Math.max(1.6, (cols - 1) * 1.8));
  const x = cols === 1 ? 0 : -span / 2 + col * (span / (cols - 1));
  return { x, z: row ? 1.4 : -1.4 };
}

function rollDockPosition(index, count) {
  const cols = Math.ceil(count / 2);
  const row = index >= cols ? 1 : 0;
  const col = row ? index - cols : index;
  const span = Math.min(460, Math.max(180, (cols - 1) * 112));
  const screenX = window.innerWidth * 0.5 + (cols === 1 ? 0 : -span / 2 + col * (span / (cols - 1)));
  const screenY = window.innerHeight - (row ? 125 : 243);
  const point = pointerToPlanePoint(screenX, screenY, DOCK_Y, homePoint);
  if (point) return { x: point.x, z: point.z };
  return rollStagePosition(index, count);
}

function rollLane(index, count, home) {
  const row = index >= Math.ceil(count / 2) ? 1 : 0;
  const laneOffset = (row ? 0.32 : -0.32) + ((index % 2) ? 0.08 : -0.08);
  const startX = -3.2 - index * 0.48;
  const startZ = home.z + laneOffset;
  const endX = home.x;
  const endZ = home.z;
  const rollDistance = Math.hypot(endX - startX, endZ - startZ);
  const rollDirection = Math.atan2(endZ - startZ, endX - startX);
  return { startX, startZ, endX, endZ, laneOffset, rollDistance, rollDirection };
}

function tickRollStage(now) {
  if (!state.isRolling) return;
  // seatedY is the die GROUP centre height when resting on the board.
  // Die mesh is centred at group origin, half-height = 0.41, board top = TOP_H.
  const seatedY = TOP_H + 0.41;

  rollStageGroup.children.forEach((piece, index) => {
    const ud = piece.userData;

    // Per-die staggered local time
    const localElapsed = Math.max(0, (now - state.rollStartedAt) / 1000 - ud.dropDelay);
    const localDuration = ROLL_ANIMATION_MS / 1000 - ud.dropDelay;
    const t = Math.min(localElapsed / localDuration, 1);

    // Ease power 2.5: visible deceleration across the whole travel arc.
    // At t=0.3 (entering view) ~41% rotation done; decelerates clearly to a stop.
    const tEased = 1 - Math.pow(1 - t, 2.5);

    // XZ position — lerp gives natural trajectory, collOffset persists collision displacement
    const x = ud.startX + (ud.endX - ud.startX) * tEased + ud.collOffsetX;
    const laneCurve = Math.sin(tEased * Math.PI) * ud.laneOffset * 0.24;
    const z = ud.startZ + (ud.endZ - ud.startZ) * tEased + laneCurve + ud.collOffsetZ;

    // Y: die centre falls from seatedY+0.55 to seatedY with a gentle arc bump
    const fallY = Math.pow(1 - t, 1.5) * 0.55;
    const arcY = seatedY + fallY + Math.sin(tEased * Math.PI) * 0.08;

    // ROTATION — two full rotations (spinCount=2 → 4π), guaranteed face-up at t=1.
    // setFromAxisAngle(axis, 4π) = exact identity → identity × targetQ = targetQ.
    const primaryAngle = ud.spinCount * Math.PI * 2 * tEased;

    // Wobble: small side-lean along travel direction, fades to 0 at t=1
    const wobbleEnvelope = Math.sin(t * Math.PI) * Math.pow(1 - t, 0.8);
    const wobbleAngle = wobbleEnvelope * 0.22;

    _v3.set(ud.tumbleX, 0, ud.tumbleZ);
    _qA.setFromAxisAngle(_v3, primaryAngle);
    _vW.set(ud.wobbleX, 0, ud.wobbleZ);
    _qB.setFromAxisAngle(_vW, wobbleAngle);
    _qA.premultiply(_qB);
    piece.quaternion.copy(_qA).multiply(ud.targetQ);

    piece.scale.setScalar(0.96);
    piece.position.set(x, arcY, z);
  });

  // Push-apart: only runs once dice are 60%+ of the way to their destinations.
  // Early-flight dice are naturally spreading apart; running collision then just
  // accumulates wrong offsets that cause the landing-zone pile-up.
  const globalT = Math.min((now - state.rollStartedAt) / ROLL_ANIMATION_MS, 1);
  const N = rollStageGroup.children.length;
  if (N > 1 && globalT > 0.6) {
    const pos = rollStageGroup.children.map(p => ({
      x: p.position.x, z: p.position.z,
      ox: p.position.x, oz: p.position.z,
      p
    }));
    const MIN = 0.94;
    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pos[j].x - pos[i].x;
          const dz = pos[j].z - pos[i].z;
          const d2 = dx * dx + dz * dz;
          if (d2 < MIN * MIN && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const push = (MIN - d) * 0.5;
            const nx = dx / d, nz = dz / d;
            pos[i].x -= nx * push; pos[i].z -= nz * push;
            pos[j].x += nx * push; pos[j].z += nz * push;
          }
        }
      }
    }
    pos.forEach(({ x, z, ox, oz, p }) => {
      p.userData.collOffsetX += x - ox;
      p.userData.collOffsetZ += z - oz;
      p.position.x = x;
      p.position.z = z;
    });
  }
}

function renderWildcardPicker() {
  els.wildPicker.innerHTML = "";
  const selected = state.selectedWildIndex === null ? null : state.roll[state.selectedWildIndex];
  const show = selected && selected.face === "*" && !selected.used && !state.locked && !state.isRolling;
  els.wildPicker.classList.toggle("show", Boolean(show));
  if (!show) return;
  LETTERS.forEach(letter => {
    const btn = document.createElement("button");
    btn.className = "letter-pick";
    btn.type = "button";
    btn.textContent = letter;
    btn.addEventListener("click", () => {
      selected.assigned = letter;
      renderAll();
    });
    els.wildPicker.appendChild(btn);
  });
}

function renderPieces() {
  const liveKeys = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = state.board[r][c];
      if (!cell) continue;
      const key = cellKey(r, c);
      liveKeys.add(key);
      const signature = pieceSignature(cell);
      let piece = boardPiecesByKey.get(key);
      if (piece?.userData.signature !== signature) {
        if (piece) {
          pieceGroup.remove(piece);
          disposeObject(piece);
        }
        piece = makeLetterDie(cell);
        piece.userData.signature = signature;
        boardPiecesByKey.set(key, piece);
        pieceGroup.add(piece);
      }
      const p = tilePos(c, r);
      piece.position.set(p.x, TOP_H + 0.03, p.z);
      piece.userData.rollIndex = cell.rollIndex;
      piece.userData.r = r;
      piece.userData.c = c;
    }
  }
  for (const [key, piece] of boardPiecesByKey) {
    if (!liveKeys.has(key)) {
      pieceGroup.remove(piece);
      disposeObject(piece);
      boardPiecesByKey.delete(key);
    }
  }
}

function pieceSignature(cell) {
  return `${cell.id}|${cell.rollIndex}|${cell.assigned}|${cell.letter}|${cell.face}|${(cell.dieFaces || []).join("")}`;
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function beginDieDrag(event, index) {
  if (state.isRolling || state.locked || state.roll[index].used) return;
  const die = state.roll[index];
  if (die.face === "*" && !die.assigned) {
    state.selectedWildIndex = index;
    renderWildcardPicker();
    setStatus("Choose a wildcard letter", "Pick a letter before dragging this wildcard die.", "ready");
    return;
  }
  event.preventDefault();
  const piece = rollStageGroup.children[index];
  drag = {
    type: "tray",
    rollIndex: index,
    object: piece,
    homePosition: piece ? piece.position.clone() : null,
    homeQuaternion: piece ? piece.quaternion.clone() : null,
    homeScale: piece ? piece.scale.clone() : null,
    velocity: new THREE.Vector3(),
    targetPosition: piece ? piece.position.clone() : new THREE.Vector3(),
    targetQuaternion: piece ? piece.quaternion.clone() : new THREE.Quaternion(),
    lastClientX: event.clientX,
    lastClientY: event.clientY
  };
  renderer.domElement.classList.add("placing");
  if (piece) {
    piece.visible = true;
    piece.scale.setScalar(1.08);
  }
  updateDragTarget(event.clientX, event.clientY);
  renderDiceTray();
}

function beginBoardDieDrag(event, placed) {
  if (state.isRolling || state.locked) return;
  const cell = state.board[placed.r][placed.c];
  if (!cell) return;
  event.preventDefault();
  drag = {
    type: "board",
    rollIndex: cell.rollIndex,
    fromR: placed.r,
    fromC: placed.c,
    cell,
    object: makeLetterDie(cell),
    isPreviewObject: true,
    velocity: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
    targetQuaternion: new THREE.Quaternion(),
    lastClientX: event.clientX,
    lastClientY: event.clientY
  };
  state.board[placed.r][placed.c] = null;
  const p = tilePos(placed.c, placed.r);
  drag.object.position.set(p.x, TOP_H + 0.5, p.z);
  drag.object.scale.setScalar(1.08);
  drag.targetPosition.copy(drag.object.position);
  drag.targetQuaternion.copy(drag.object.quaternion);
  boardGroup.add(drag.object);
  renderer.domElement.classList.add("placing");
  updateDragTarget(event.clientX, event.clientY);
  renderPieces();
  updateHover(event.clientX, event.clientY);
}

function updateDragTarget(x, y) {
  if (!drag?.object) return;
  const p = pointerToDragPoint(x, y);
  if (!p) return;
  const activeCamera = usePerspective ? perspCamera : camera;
  _camRight.setFromMatrixColumn(activeCamera.matrixWorld, 0);
  _camUp.setFromMatrixColumn(activeCamera.matrixWorld, 1);
  _dragOffset
    .copy(_camRight).multiplyScalar(-0.24)
    .addScaledVector(_camUp, -0.18);
  drag.targetPosition.copy(p).add(_dragOffset);
  drag.targetPosition.y = DRAG_Y;
  const dx = x - (drag.lastClientX ?? x);
  const dy = y - (drag.lastClientY ?? y);
  drag.lastClientX = x;
  drag.lastClientY = y;
  const baseQ = drag.homeQuaternion || drag.object.quaternion;
  const tiltX = Math.max(-0.38, Math.min(0.38, dy * 0.012 - 0.14));
  const tiltZ = Math.max(-0.44, Math.min(0.44, -dx * 0.012 + 0.1));
  _targetQ.copy(baseQ);
  _tiltQ.setFromAxisAngle(_tiltAxisA, tiltX);
  _targetQ.premultiply(_tiltQ);
  _tiltQ.setFromAxisAngle(_tiltAxisB, tiltZ);
  _targetQ.premultiply(_tiltQ);
  drag.targetQuaternion.copy(_targetQ);
}

function tickDragObject(dt) {
  if (!drag?.object || !drag.targetPosition) return;
  const stiffness = 42;
  const damping = 12;
  _v3.copy(drag.targetPosition).sub(drag.object.position).multiplyScalar(stiffness);
  drag.velocity.addScaledVector(_v3, dt);
  drag.velocity.multiplyScalar(Math.max(0, 1 - damping * dt));
  drag.object.position.addScaledVector(drag.velocity, dt);
  drag.object.quaternion.slerp(drag.targetQuaternion, Math.min(1, dt * 14));
  const pulse = 1.08 + Math.min(0.07, drag.velocity.length() * 0.006);
  drag.object.scale.setScalar(pulse);
  renderDiceTray();
}

window.addEventListener("pointermove", event => {
  if (!drag) return;
  updateDragTarget(event.clientX, event.clientY);
  updateHover();
});

window.addEventListener("pointerup", event => {
  if (!drag) return;
  const target = resolveDropBoardTarget(event.clientX, event.clientY);
  const activeDrag = drag;
  if (activeDrag.type === "board") {
    endDrag({ restore: !target });
    finishBoardDieDrag(activeDrag, target);
  } else {
    if (!target) {
      endDrag({ restore: true });
      setStatus("Drop cancelled", "Release over an empty board tile to place a die.", "ready");
      return;
    }
    if (target.occupied) {
      endDrag({ restore: true });
      placeDie(activeDrag.rollIndex, target.r, target.c);
      return;
    }
    endDrag({ restore: false });
    placeDie(activeDrag.rollIndex, target.r, target.c);
  }
});

function endDrag(options = {}) {
  const { restore = true } = options;
  const activeDrag = drag;
  if (activeDrag?.object) {
    if (activeDrag.isPreviewObject) {
      boardGroup.remove(activeDrag.object);
      disposeObject(activeDrag.object);
    } else if (restore) {
      if (activeDrag.homePosition) activeDrag.object.position.copy(activeDrag.homePosition);
      if (activeDrag.homeQuaternion) activeDrag.object.quaternion.copy(activeDrag.homeQuaternion);
      if (activeDrag.homeScale) activeDrag.object.scale.copy(activeDrag.homeScale);
    }
  }
  drag = null;
  hoverMesh.visible = false;
  currentHover = null;
  renderer.domElement.classList.remove("placing");
  renderDiceTray();
}

function placeDie(rollIndex, r, c) {
  if (state.locked) return;
  if (state.board[r][c]) {
    setStatus("Tile occupied", "Use an empty 3D tile or drop a moved die off the board to return it.", "bad");
    validateAndMaybeComplete();
    return;
  }
  const die = state.roll[rollIndex];
  if (!die || die.used) return;
  const source = state.dice.find(d => d.id === die.dieId);
  state.board[r][c] = { ...die, rollIndex, dieFaces: source ? [...source.faces] : [die.assigned || die.letter] };
  die.used = true;
  renderPieces();
  const placed = pieceGroup.children.find(piece => piece.userData.r === r && piece.userData.c === c);
  if (placed) animateDrop(placed);
  validateAndMaybeComplete({ pieces: false });
}

function finishBoardDieDrag(activeDrag, cell) {
  if (state.locked) return;
  const { rollIndex, fromR, fromC, cell: movedCell } = activeDrag;
  if (!cell) {
    state.roll[rollIndex].used = false;
    validateAndMaybeComplete();
    return;
  }
  if (state.board[cell.r][cell.c]) {
    state.board[fromR][fromC] = movedCell;
    validateAndMaybeComplete();
    setStatus("Tile occupied", "Move to an empty 3D tile or drop off the board to return it.", "bad");
    return;
  }
  state.board[cell.r][cell.c] = movedCell;
  state.roll[rollIndex].used = true;
  renderPieces();
  const placed = pieceGroup.children.find(piece => piece.userData.r === cell.r && piece.userData.c === cell.c);
  if (placed) animateDrop(placed);
  validateAndMaybeComplete({ pieces: false });
}

function removePlaced(r, c) {
  if (state.locked) return;
  const cell = state.board[r][c];
  if (!cell) return;
  state.roll[cell.rollIndex].used = false;
  state.board[r][c] = null;
  validateAndMaybeComplete();
}

function validateAndMaybeComplete(options = {}) {
  const { pieces = true } = options;
  const validation = validateBoardForState(state, WORDS);
  state.lastValidation = validation;
  state.lastScore = scoreBoardForState(state, validation);
  state.stuckDice = state.isRolling ? [] : checkFeasibilityForState(state, WORDS_BY_LETTER);
  updateStatus(validation);
  renderAll({ pieces });
  if (validation.complete && !state.locked) completeRound();
}

function updateStatus(validation) {
  if (state.locked) return;
  if (state.isRolling) return setStatus("Rolling dice", "Your letters are landing below the board.", "ready");
  if (validation.complete) return setStatus("Valid board", "The crossword locks automatically. Choose an upgrade.", "good");
  if (validation.unused > 0) return setStatus(`${validation.unused} dice left`, "Same dice, new faces. Drag every rolled die onto the board.", "ready");
  if (!validation.connected) return setStatus("Disconnected", "All placed dice must touch the same crossword.", "bad");
  if (validation.fragments.length) return setStatus("Fragment found", "Two-letter runs are not words. Break or extend them.", "bad");
  if (validation.invalidWords.length) return setStatus("Unknown word", `${validation.invalidWords[0].text} is not in the dictionary.`, "bad");
  if (state.stuckDice?.length && validation.unused > 0) {
    const letters = state.stuckDice.map(i => state.roll[i].letter).join(", ");
    return setStatus("Looks stuck", `${letters} can't form any word with the letters in play.`, "bad");
  }
  setStatus("Almost", "The structure is close. Keep shaping the board.", "ready");
}

function setStatus(title, body, tone) {
  els.status.className = `status ${tone || ""}`;
  els.status.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
}

function renderValidation() {
  const validation = state.lastValidation;
  els.wordList.innerHTML = "";
  els.breakdown.innerHTML = "";
  if (!validation || validation.words.length === 0) {
    els.wordList.innerHTML = `<div class="word"><b>No words yet</b><span>Build runs of 3 or more.</span></div>`;
  } else {
    validation.words.forEach(word => {
      const row = document.createElement("div");
      row.className = `word${word.valid ? "" : " bad"}`;
      row.innerHTML = `<b>${word.text}</b><span>${word.valid ? "valid" : "unknown"}</span>`;
      els.wordList.appendChild(row);
    });
  }
  if (validation?.fragments.length) {
    validation.fragments.forEach(fragment => {
      const row = document.createElement("div");
      row.className = "word bad";
      row.innerHTML = `<b>${fragment.text}</b><span>2-letter fragment</span>`;
      els.wordList.appendChild(row);
    });
  }
  const score = state.lastScore || scoreBoardForState(state, validation);
  addBreakdown("Word points", score.wordPoints);
  addBreakdown("Intersections", score.intersectionPoints);
  addBreakdown("Rare letters", score.rarePoints);
  addBreakdown("Upgrade bonuses", score.upgradePoints);
  addBreakdown("Round total", score.total, true);
}

function addBreakdown(label, value, strong = false) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<span>${label}</span><${strong ? "strong" : "span"}>${value}</${strong ? "strong" : "span"}>`;
  els.breakdown.appendChild(row);
}

function completeRound() {
  state.locked = true;
  const gained = state.lastScore.total;
  state.score += gained;
  els.upgradeSummary.textContent = `Round score ${gained}. Pick one upgrade before round ${state.round + 1}.`;
  renderAll();
  setTimeout(showUpgrades, 450);
}

function showUpgrades() {
  els.upgradeGrid.innerHTML = "";
  getUpgradeChoices().forEach(upgrade => {
    const btn = document.createElement("button");
    btn.className = "upgrade";
    btn.type = "button";
    btn.innerHTML = `<span>${upgrade.family}</span><strong>${upgrade.name}</strong><em>${upgrade.desc}</em>`;
    btn.addEventListener("click", () => {
      upgrade.apply();
      state.round += 1;
      state.target += 6 + Math.floor(state.round * 2.2);
      startRound();
    });
    els.upgradeGrid.appendChild(btn);
  });
  els.modal.classList.add("show");
}

function getUpgradeChoices() {
  const wildTarget = randomDie();
  const vowelTarget = randomDie();
  const rolledTarget = randomFrom(state.roll);
  const duplicateTarget = state.dice.find(d => d.id === rolledTarget.dieId);
  const candidates = [
    {
      family: "Dice Mutation",
      name: `Wildcard Side: D${wildTarget.id}`,
      desc: `D${wildTarget.id} can now roll a wildcard face.`,
      apply: () => {
        wildTarget.wild = true;
        if (!wildTarget.faces.includes("*")) wildTarget.faces.push("*");
        wildTarget.upgrades.push("wild");
      }
    },
    {
      family: "Dice Mutation",
      name: `Extra Vowel: D${vowelTarget.id}`,
      desc: `Add a useful vowel face to D${vowelTarget.id}.`,
      apply: () => {
        vowelTarget.faces.push(randomFrom(["A", "E", "I", "O"]));
        vowelTarget.upgrades.push("vowel");
      }
    },
    {
      family: "Dice Mutation",
      name: `Duplicate ${rolledTarget.assigned || rolledTarget.letter}: D${duplicateTarget.id}`,
      desc: `Add another ${rolledTarget.assigned || rolledTarget.letter} face to D${duplicateTarget.id}.`,
      apply: () => {
        duplicateTarget.faces.push(rolledTarget.assigned || rolledTarget.letter);
        duplicateTarget.upgrades.push("copy");
      }
    },
    {
      family: "Utility",
      name: "Add Die",
      desc: "Add one persistent die. Future rounds require one more letter.",
      apply: () => {
        const faces = ADD_DIE_FACES[(state.nextDieId - baseDice.length - 1) % ADD_DIE_FACES.length];
        state.dice.push({ id: state.nextDieId, faces: [...faces], wild: false, upgrades: ["new"] });
        state.nextDieId += 1;
      }
    },
    {
      family: "Utility",
      name: "Extra Reroll",
      desc: "Gain one more reroll every round.",
      apply: () => { state.rerollsBase += 1; }
    },
    {
      family: "Scoring Bias",
      name: "Intersection Bonus",
      desc: "Crossing letters score 2 extra points.",
      apply: () => { state.upgrades.intersectionBonus += 2; }
    },
    {
      family: "Scoring Bias",
      name: "Five-Letter Prize",
      desc: "Each 5-letter word scores 6 extra points.",
      apply: () => { state.upgrades.fiveBonus += 6; }
    },
    {
      family: "Scoring Bias",
      name: "Rare Letter Drama",
      desc: "Rare letters score 3 extra points.",
      apply: () => { state.upgrades.rareBonus += 3; }
    }
  ];
  return shuffle(candidates).slice(0, 3);
}

function reroll() {
  if (state.isRolling || state.rerolls <= 0 || state.locked) return;
  state.rerolls -= 1;
  state.board = emptyBoard();
  state.selectedWildIndex = null;
  state.roll = rollDiceForState(state);
  state.lastValidation = null;
  state.lastScore = null;
  beginRollAnimation();
}

function clearBoard() {
  if (state.isRolling || state.locked) return;
  state.board = emptyBoard();
  state.roll.forEach(die => { die.used = false; });
  validateAndMaybeComplete();
}


function updateHover(x, y) {
  const target = drag ? resolveDragBoardTarget() : resolvePointerBoardTarget(x, y);
  currentHover = target;
  if (!target) {
    hoverMesh.visible = false;
    return;
  }
  const p = tilePos(target.c, target.r);
  hoverMesh.position.set(p.x, TOP_H + 0.035, p.z);
  hoverMesh.material = target.occupied ? M.hoverBad : M.hover;
  hoverMesh.visible = true;
}

function updateCameraPanTarget(clientX, clientY) {
  const nx = (clientX / window.innerWidth - 0.5) * 2;
  const ny = (clientY / window.innerHeight - 0.5) * 2;
  desiredCameraPan.set(nx * 0.22, 0, ny * 0.16);
}

function tickCameraPan(dt) {
  if (drag) return;
  const beforeX = cameraPan.x;
  const beforeZ = cameraPan.z;
  cameraPan.lerp(desiredCameraPan, Math.min(1, dt * 1.45));
  if (Math.abs(cameraPan.x - beforeX) > 0.0001 || Math.abs(cameraPan.z - beforeZ) > 0.0001) {
    updateCamera();
  }
}

renderer.domElement.addEventListener("pointerdown", event => {
  if (drag || state.isRolling || state.locked) return;
  if (event.button !== 0 && event.pointerType === "mouse") return;
  const placed = pickPlacedPiece(event.clientX, event.clientY);
  if (placed) {
    beginBoardDieDrag(event, placed);
    return;
  }
});

renderer.domElement.addEventListener("pointermove", event => {
  updateCameraPanTarget(event.clientX, event.clientY);
  if (drag) return;
  updateHover(event.clientX, event.clientY);
});

renderer.domElement.addEventListener("wheel", event => {
  event.preventDefault();
  viewSize = Math.max(4.4, Math.min(9.5, viewSize + event.deltaY * 0.004));
  onResize();
}, { passive: false });

window.addEventListener("keydown", event => {
  if (state.isRolling) return;
  const key = event.key.toLowerCase();
  if (key === "r") reroll();
  if (key === "c") clearBoard();
  if (key === "n") newRun();
});

els.reroll.addEventListener("click", reroll);
els.clear.addEventListener("click", clearBoard);
els.newRun.addEventListener("click", newRun);

function randomDie() {
  return state.dice[Math.floor(Math.random() * state.dice.length)];
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  perspCamera.aspect = aspect;
  perspCamera.updateProjectionMatrix();
  renderer.setSize(w, h);
  updateCamera();
  if (state.roll?.length && !state.isRolling && !drag && dockAnims.length === 0) {
    settleRollStageDice();
    renderDiceTray();
  }
}

let prevT = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const t = now / 1000;
  const dt = prevT ? Math.min(t - prevT, 0.05) : 0;
  prevT = t;
  if (dropAnims.length) tickDropAnims(dt);
  if (dockAnims.length) tickDockAnims(dt);
  if (drag) tickDragObject(dt);
  tickCameraPan(dt);
  tickDockIdle(now);
  if (state.isRolling) tickRollStage(now);
  renderer.render(scene, usePerspective ? perspCamera : camera);
}

window.addEventListener("resize", onResize);

els.perspBtn.addEventListener("click", () => {
  usePerspective = !usePerspective;
  els.perspBtn.textContent = usePerspective ? "PERSP" : "ISO";
  els.perspBtn.classList.toggle("active", !usePerspective);
});

els.resetCamBtn.addEventListener("click", () => {
  polar = DEFAULT_POLAR;
  azimuth = DEFAULT_AZIMUTH;
  viewSize = DEFAULT_VIEW_SIZE;
  cameraPan.set(0, 0, 0);
  desiredCameraPan.set(0, 0, 0);
  onResize();
});

buildBoard();
onResize();
newRun();
requestAnimationFrame(animate);
