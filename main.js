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
  "नया चाँद/अमावस्या",
  "शुक्ल पक्ष हंसिया चांद/वर्धमान चांद",
  "पहली तिमाही/अर्द्ध चंद्र",
  "शुक्ल पक्ष कुबड़ा चांद",
  "पूर्णचंद/पूर्णिमा",
  "कृष्ण पक्ष कुबड़ा चांद",
  "अंतिम तिमाही/अर्द्ध चंद्र",
  "कृष्ण पक्ष हंसिया चांद/वर्धमान चांद",
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
// MSAA only on low-density displays: at dpr >= 3 the physical pixels are small
// enough to hide edge aliasing, so skip the fill-cost multiplier there.
const antialias = window.devicePixelRatio < 3;
const renderer = new WebGLRenderer({
  canvas: document.querySelector("#bg"),
  antialias,
});
// Cap at 2: above dpr=2 the extra sharpness is imperceptible but fill cost scales with dpr².
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 0, 80);

// Survive GPU context loss (long backgrounding, driver reset): keep the context
// restorable, then re-render on restore — three re-uploads textures lazily.
const canvas = renderer.domElement;
canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
canvas.addEventListener("webglcontextrestored", () =>
  renderer.render(scene, camera)
);

// Phase is conveyed entirely by where the sun sits around the moon.
const directionalLight = new DirectionalLight(0xffffff, 2);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);

// --- Starfield: one THREE.Points (1 draw call) instead of 200 individual meshes ---
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
manager.onLoad = () => renderer.render(scene, camera); // first clean frame once decoded
const loader = new TextureLoader(manager);

const moonColorTex = loader.load(moonColorUrl);
moonColorTex.colorSpace = SRGBColorSpace; // albedo is sRGB; without this the moon looks washed out
moonColorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const moonNormalTex = loader.load(moonNormalUrl); // stays linear (correct for normals)
const moonHeightTex = loader.load(moonHeightUrl); // LOLA DEM, drives displacement

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

// --- Set the moon phase for a date: repositions the sun + updates the labels ---
function applyPhase(date) {
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

  renderer.render(scene, camera);
}

// --- Render on demand: the scene is static once a phase is set ---
controls.addEventListener("change", () => renderer.render(scene, camera));
renderer.render(scene, camera);

// --- Date picker: recompute the phase without reloading the page ---
const dateInput = document.getElementById("dateInput");
if (dateInput) {
  const now = new Date();
  dateInput.value =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  dateInput.addEventListener("change", (e) => {
    if (e.target.value) applyPhase(new Date(e.target.value + "T12:00:00"));
  });
}

// --- Keep the canvas correct on resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
});

// --- Reset view ---
document.getElementById("btn").addEventListener("click", () => {
  controls.reset();
  renderer.render(scene, camera);
});

// --- Initial phase: today ---
applyPhase(new Date());
