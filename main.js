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

// --- Lunar-phase solver: Julian day → synodic age (0..1) ---
Date.prototype.getJulian = function () {
  return this / 86400000 - this.getTimezoneOffset() / 1440 + 2440587.5;
};
function moon_day(today) {
  var GetFrac = function (fr) {
    return fr - Math.floor(fr);
  };
  var thisJD = today.getJulian();
  var year = today.getFullYear();
  var degToRad = 3.14159265 / 180;
  var K0, T, T2, T3, J0, F0, M0, M1, B1, oldJ;
  K0 = Math.floor((year - 1900) * 12.3685);
  T = (year - 1899.5) / 100;
  T2 = T * T;
  T3 = T * T * T;
  J0 = 2415020 + 29 * K0;
  F0 =
    0.0001178 * T2 -
    0.000000155 * T3 +
    (0.75933 + 0.53058868 * K0) -
    (0.000837 * T + 0.000335 * T2);
  M0 =
    360 * GetFrac(K0 * 0.08084821133) +
    359.2242 -
    0.0000333 * T2 -
    0.00000347 * T3;
  M1 =
    360 * GetFrac(K0 * 0.07171366128) +
    306.0253 +
    0.0107306 * T2 +
    0.00001236 * T3;
  B1 =
    360 * GetFrac(K0 * 0.08519585128) +
    21.2964 -
    0.0016528 * T2 -
    0.00000239 * T3;
  var phase = 0;
  var jday = 0;
  while (jday < thisJD) {
    var F = F0 + 1.530588 * phase;
    var M5 = (M0 + phase * 29.10535608) * degToRad;
    var M6 = (M1 + phase * 385.81691806) * degToRad;
    var B6 = (B1 + phase * 390.67050646) * degToRad;
    F -= 0.4068 * Math.sin(M6) + (0.1734 - 0.000393 * T) * Math.sin(M5);
    F += 0.0161 * Math.sin(2 * M6) + 0.0104 * Math.sin(2 * B6);
    F -= 0.0074 * Math.sin(M5 - M6) - 0.0051 * Math.sin(M5 + M6);
    F += 0.0021 * Math.sin(2 * M5) + 0.001 * Math.sin(2 * B6 - M6);
    F += 0.5 / 1440;
    oldJ = jday;
    jday = J0 + 28 * phase + Math.floor(F);
    phase++;
  }

  // 29.53059 days per lunar month
  return (thisJD - oldJ) / 29.53059;
}

// --- Scene / camera / renderer ---
const scene = new Scene();
const camera = new PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new WebGLRenderer({
  canvas: document.querySelector("#bg"),
  antialias: true,
});
// Cap at 2: above dpr=2 the extra sharpness is imperceptible but fill cost scales with dpr².
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 0, 80);

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
  new SphereGeometry(20, 96, 96),
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
  const a = moon_day(date) * 360;
  const idx = ((Math.round(a / 45) % 8) + 8) % 8;
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
