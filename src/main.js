import { ensureThree } from "./three-loader.js";

ensureThree().then(() => import("./app.js")).catch(error => {
  document.documentElement.dataset.lexiconStartupError = error?.message || String(error);
  console.error(error);
});
