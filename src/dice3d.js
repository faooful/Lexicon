const THREE = globalThis.THREE;

const dieGeometry = new THREE.BoxGeometry(0.82, 0.82, 0.82);
markShared(dieGeometry);

const faceTextureCache = new Map();
const faceMaterialCache = new Map();

export function makeDieFaceTexture(letter, isWild, role = "side") {
  const key = `${letter || ""}|${isWild ? 1 : 0}|${role}`;
  if (faceTextureCache.has(key)) return faceTextureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const isTop = role === "top";
  const isBottom = role === "bottom";
  const bg = isWild ? "#f0c84e" : "#f5f1e8";
  const inner = isWild ? "#ffdc73" : "#fffdf7";
  const ink = isTop
    ? (isWild ? "#5d4200" : "#111510")
    : (isWild ? "rgba(93,66,0,0.52)" : "rgba(17,21,16,0.46)");
  const mutedInk = isWild ? "rgba(93,66,0,0.3)" : "rgba(17,21,16,0.24)";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = inner;
  roundRect(ctx, 18, 18, 220, 220, 30);
  ctx.fill();
  ctx.strokeStyle = isWild ? "rgba(93,66,0,0.34)" : "rgba(17,21,16,0.18)";
  ctx.lineWidth = isTop ? 13 : 10;
  ctx.stroke();

  ctx.fillStyle = mutedInk;
  const pipRadius = isTop ? 10 : 8;
  drawPip2d(ctx, 46, 46, pipRadius);
  drawPip2d(ctx, 210, 46, pipRadius);
  drawPip2d(ctx, 46, 210, pipRadius);
  drawPip2d(ctx, 210, 210, pipRadius);

  if (!isBottom) {
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = isTop
      ? (isWild ? "rgba(255,248,205,0.55)" : "rgba(255,255,255,0.75)")
      : "rgba(255,255,255,0.28)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = isTop ? 3 : 1;
    ctx.font = isTop ? "900 154px Inter, Arial, sans-serif" : "850 112px Inter, Arial, sans-serif";
    ctx.fillText(letter || "*", 128, isTop ? 132 : 128);
  } else {
    ctx.fillStyle = mutedInk;
    ctx.font = "800 34px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LEXICON", 128, 132);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  markShared(texture);
  faceTextureCache.set(key, texture);
  return texture;
}

export function makeDieFaceMaterial(letter, isWild, role) {
  const key = `${letter || ""}|${isWild ? 1 : 0}|${role}`;
  if (faceMaterialCache.has(key)) return faceMaterialCache.get(key);
  const texture = makeDieFaceTexture(letter, isWild, role);
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    color: isWild ? 0xffdf70 : 0xffffff
  });
  markShared(material);
  faceMaterialCache.set(key, material);
  return material;
}

export function makeLetterDie(cell, uniformFaces = false) {
  const isWild = cell.face === "*";
  const visible = visualDieFaces(cell);
  const group = new THREE.Group();
  const die = new THREE.Mesh(
    dieGeometry,
    [
      makeDieFaceMaterial(visible.right, isWild, uniformFaces ? "top" : "side"),
      makeDieFaceMaterial(visible.left, isWild, uniformFaces ? "top" : "side"),
      makeDieFaceMaterial(visible.top, isWild, "top"),
      makeDieFaceMaterial("", isWild, "bottom"),
      makeDieFaceMaterial(visible.front, isWild, uniformFaces ? "top" : "side"),
      makeDieFaceMaterial(visible.back, isWild, uniformFaces ? "top" : "side")
    ]
  );
  die.position.y = 0.41;
  group.add(die);

  castReceive(group);
  return group;
}

export function visualDieFaces(cell) {
  const topLetter = cell.assigned || cell.letter || "*";
  const faces = (cell.dieFaces || []).filter(face => face && face !== "*");
  const rotated = [topLetter, ...faces.filter(face => face !== topLetter), ...faces];
  return {
    top: topLetter,
    front: rotated[1] || topLetter,
    right: rotated[2] || topLetter,
    left: rotated[3] || topLetter,
    back: rotated[4] || topLetter
  };
}

export function castReceive(obj) {
  obj.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

export function disposeObject(obj) {
  obj.traverse(child => {
    if (child.geometry && !child.geometry.userData?.shared) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        if (material.userData?.shared) return;
        if (material.map && !material.map.userData?.shared) material.map.dispose();
        material.dispose();
      });
    }
  });
}

function markShared(resource) {
  resource.userData = resource.userData || {};
  resource.userData.shared = true;
  return resource;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPip2d(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
