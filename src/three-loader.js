const THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

export async function ensureThree() {
  if (globalThis.THREE) return globalThis.THREE;

  const existing = [...document.scripts].find(script => script.src === THREE_CDN);
  if (existing) {
    await waitForScript(existing);
    if (globalThis.THREE) return globalThis.THREE;
  }

  await loadScript(THREE_CDN);
  if (!globalThis.THREE) throw new Error("Three.js loaded but did not expose window.THREE.");
  return globalThis.THREE;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function waitForScript(script) {
  return new Promise(resolve => {
    if (globalThis.THREE) {
      resolve();
      return;
    }
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", resolve, { once: true });
    window.setTimeout(resolve, 1500);
  });
}
