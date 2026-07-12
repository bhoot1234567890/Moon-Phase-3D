import "./style.css";
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  SphereGeometry,
  MeshStandardMaterial,
  Mesh,
  MathUtils,
  TextureLoader,
  LoadingManager,
  PointsMaterial,
  Points,
  BufferGeometry,
  BufferAttribute,
  SRGBColorSpace,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { phaseAngle, phaseIndex } from "./moonphase.js";

// Importing assets as modules lets Vite hash + emit them in production builds
// (referencing them as bare string paths to a non-public/ dir 404s in `vite build`).
import moonColorUrl from "./assets/lroc_color_poles_2k.webp";
import moonNormalUrl from "./assets/NormalMap.webp";
import moonHeightUrl from "./assets/ldem_4_uint.webp";

const moon_phases_en = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];
const moon_phases_hi = [
  "अमावस्या (नया चाँद)",
  "शुक्ल पक्ष का हंसिया चाँद (वर्धमान चाँद)",
  "प्रथम तिमाही (अर्धचंद्र)",
  "शुक्ल पक्ष का कुबड़ा चाँद",
  "पूर्णिमा (पूर्ण चंद्र)",
  "कृष्ण पक्ष का कुबड़ा चाँद",
  "अंतिम (तृतीय) तिमाही (अर्धचंद्र)",
  "कृष्ण पक्ष का हंसिया चाँद (क्षीणमान चाँद)",
];
const moon_phases_emoji = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

// --- Scene / camera / renderer ---
const scene = new Scene();
const camera = new PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const antialias = window.devicePixelRatio < 3;
const renderer = new WebGLRenderer({
  canvas: document.querySelector("#bg"),
  antialias,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 0, 80);

const canvas = renderer.domElement;
canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
canvas.addEventListener("webglcontextrestored", () => renderer.render(scene, camera));

// Phase is conveyed entirely by where the sun sits around the moon.
const directionalLight = new DirectionalLight(0xffffff, 2);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);

// --- Starfield: one THREE.Points (1 draw call) instead of 200 individual meshes ---
// Kept as a faint background layer; the skymap feature adds bright named stars
// and constellations on top.
function makeStars(count = 200) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = MathUtils.randFloatSpread(200);
    positions[i * 3 + 1] = MathUtils.randFloatSpread(200);
    positions[i * 3 + 2] = MathUtils.randFloatSpread(200);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xf0ff99,
    size: 0.6,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new Points(geometry, material);
}
scene.add(makeStars(200));

// --- Textures via a single LoadingManager (progress + real error reporting) ---
const manager = new LoadingManager();
manager.onError = (url) => console.error("Texture failed to load:", url);
manager.onLoad = () => render();
const loader = new TextureLoader(manager);

const moonColorTex = loader.load(moonColorUrl);
moonColorTex.colorSpace = SRGBColorSpace;
moonColorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const moonNormalTex = loader.load(moonNormalUrl);
const moonHeightTex = loader.load(moonHeightUrl);

// --- Moon globe: real DEM displacement; normal map carries the surface relief ---
const moon = new Mesh(
  new SphereGeometry(20, 64, 64),
  new MeshStandardMaterial({
    map: moonColorTex,
    normalMap: moonNormalTex,
    displacementMap: moonHeightTex,
    displacementScale: 0.4,
  })
);
scene.add(moon);
moon.rotateY((270 * Math.PI) / 180);
directionalLight.target = moon;

// =====================================================================
// App context: the single integration point feature modules build against.
// Features must NEVER touch the scene/date directly — only through `ctx`.
// =====================================================================
const listeners = Object.create(null);
function on(evt, cb) {
  (listeners[evt] ||= []).push(cb);
  return () => off(evt, cb);
}
function once(evt, cb) {
  const u = on(evt, (p) => {
    u();
    cb(p);
  });
  return u;
}
function off(evt, cb) {
  const arr = listeners[evt];
  if (arr) listeners[evt] = arr.filter((f) => f !== cb);
}
function emit(evt, payload) {
  (listeners[evt] || []).slice().forEach((cb) => cb(payload));
}

const renderCallbacks = [];
function onRender(cb) {
  renderCallbacks.push(cb);
  return () => {
    const i = renderCallbacks.indexOf(cb);
    if (i >= 0) renderCallbacks.splice(i, 1);
  };
}

let currentDate = new Date();
function render() {
  renderer.render(scene, camera);
  for (const cb of renderCallbacks.slice()) cb();
}

// Set the moon phase for a date: repositions the sun, updates labels, renders,
// and notifies all date listeners. Single source of truth for the current date.
function setDate(date) {
  currentDate = date;
  const a = phaseAngle(date);
  const idx = phaseIndex(date);
  const sunangle = (a + 270) % 360;
  const rad = (sunangle * Math.PI) / 180;
  directionalLight.position.set(80 * Math.cos(rad), 0, 80 * Math.sin(rad));

  document.getElementById("curr_phase_name").innerHTML =
    '<span id="english">' +
    moon_phases_en[idx] +
    "</span><br>" +
    '<span id="hindi">' +
    moon_phases_hi[idx] +
    "</span>";
  document.title = "Lunar Phases " + moon_phases_emoji[idx];

  render();
  emit("date", date);
}

function resetView() {
  controls.reset();
  render();
  emit("reset");
}

const ctx = {
  scene,
  camera,
  renderer,
  moon,
  controls,
  directionalLight,
  constants: { moonRadius: 20, lightRadius: 80, cameraZ: 80 },
  THREE_USING: true, // (features import three themselves)
  getDate: () => currentDate,
  setDate,
  onDate: (cb) => on("date", cb),
  on,
  once,
  off,
  emit,
  render,
  resetView,
  onRender,
};
window.__moon = ctx;

// --- Render on demand ---
controls.addEventListener("change", render);
render();

// --- Keep the canvas correct on resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
});

// --- Reset view button ---
document.getElementById("btn").addEventListener("click", resetView);

// --- Feature modules (each exports init(ctx)) ---
import { initCalendar } from "./calendar.js";
import { initDataPanel } from "./features/datapanel.js";
import { initTimeControls } from "./features/timecontrols.js";
import { initViewControls } from "./features/viewcontrols.js";
import { initLunarFeatures } from "./features/lunarfeatures.js";
import { initSkyMap } from "./features/skymap.js";
import { initSystemView } from "./features/systemview.js";

const features = [
  initCalendar,
  initDataPanel,
  initTimeControls,
  initViewControls,
  initLunarFeatures,
  initSkyMap,
  initSystemView,
];
// Snapshot core scene/moon children so feature-added 3D objects can be toggled.
const coreScene = new Set(scene.children);
const coreMoon = new Set(moon.children);

for (const init of features) {
  try {
    init(ctx);
  } catch (err) {
    console.error("Feature init failed:", init.name, err);
  }
}

// Feature-added 3D objects (pins, bright stars, constellations) live in the
// scene or as children of the moon. Toggle their .visible while remembering each
// object's own visibility, so per-feature sub-toggles (Locations/Constellations)
// survive a hide/show cycle.
const featureObjects = [
  ...scene.children.filter((o) => !coreScene.has(o)),
  ...moon.children.filter((o) => !coreMoon.has(o)),
];

let featuresVisible = true;
function setFeaturesVisible(visible) {
  if (visible === featuresVisible) return;
  featuresVisible = visible;
  document.body.classList.toggle("features-hidden", !visible);
  if (visible) {
    for (const o of featureObjects) o.visible = o._savedVisible ?? true;
  } else {
    for (const o of featureObjects) {
      o._savedVisible = o.visible;
      o.visible = false;
    }
    // System View adds meshes lazily (not in the snapshot); turn it off if on.
    const svBtn = [...document.querySelectorAll("#toolbar button")].find((b) =>
      b.textContent.includes("System View")
    );
    if (svBtn && svBtn.getAttribute("aria-pressed") === "true") svBtn.click();
  }
  render();
}
ctx.setFeaturesVisible = setFeaturesVisible;

const featureToggle = document.getElementById("featureToggle");
if (featureToggle) {
  featureToggle.addEventListener("click", () => {
    const on = featureToggle.getAttribute("aria-pressed") !== "true";
    featureToggle.setAttribute("aria-pressed", on ? "true" : "false");
    setFeaturesVisible(on);
  });
}

// Default: clean (only the original UI). The toggle reveals the new features.
setFeaturesVisible(false);

// --- Initial phase: today (emits 'date' so all features render initial state) ---
setDate(new Date());
