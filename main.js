import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

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
  "पूर्णचंद/पूर्णिमा💗",
  "कृष्ण पक्ष कुबड़ा चांद",
  "अंतिम तिमाही/अर्द्ध चंद्र",
  "कृष्ण पक्ष हंसिया चांद/वर्धमान चांद",
];
const moon_phases_emoji = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

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
var angle = moon_day(new Date()) * 360;
const degrees = [0, 45, 90, 135, 180, 225, 270, 315];
var index_moon_phase_curr = Math.trunc(angle / 45) % degrees.length;
document.title =
  document.title + " " + moon_phases_emoji[index_moon_phase_curr];
// console.log(index_moon_phase_curr);
let div_curr_phase = document.getElementById("curr_phase_name");
div_curr_phase.innerHTML =
  "<span id='english'>" +
  moon_phases_en[index_moon_phase_curr] +
  "</span>" +
  "<br>" +
  "<span id='hindi'>" +
  moon_phases_hi[index_moon_phase_curr] +
  "</span>";
console.log(div_curr_phase);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#bg"),
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
// camera.position.setZ(90)
camera.position.set(0, 0, 80);
renderer.render(scene, camera);
// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
scene.add(directionalLight);
// const ambientLight = new THREE.AmbientLight(0xffffff);
// scene.add(ambientLight)

// Grid Helper
// const gridhelper= new THREE.GridHelper(1000,100)
// scene.add(gridhelper)

const controls = new OrbitControls(camera, renderer.domElement);
// renderer.render(scene,camera)

//Geometry and Material for Stars
const stargeo = new THREE.SphereGeometry(0.25, 24, 24);
const starmat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xf0ff99,
});
// console.log([x,y,z])
function addStar() {
  const star = new THREE.Mesh(stargeo, starmat);
  const [x, y, z] = Array(3)
    .fill()
    .map(() => THREE.MathUtils.randFloatSpread(200));
  star.position.set(x, y, z);
  scene.add(star);
}
Array(200).fill().forEach(addStar);

// Moon

const moonTexture = new THREE.TextureLoader().load(
  "./assets/lroc_color_poles_2k.png"
);
const displacementTexture = new THREE.TextureLoader().load(
  "./assets/lroc_color_poles_2k.png"
);
const normalTexture = new THREE.TextureLoader().load("assets/NormalMap.png");

const moon = new THREE.Mesh(
  new THREE.SphereGeometry(20, 64, 64),
  new THREE.MeshStandardMaterial({
    map: moonTexture,
    displacementMap: displacementTexture,
    normalMap: normalTexture,
  })
);

//
// VVV IMPORTANT, Setting angle of sun for phase of the moon
//
function pol2rect(r, θ) {
  return [r * Math.cos(θ), r * Math.sin(θ)];
}
const sunangle = (angle + 270) % 360;
const radians = (sunangle * Math.PI) / 180;
const xz = pol2rect(80, radians);
directionalLight.target = moon;
directionalLight.position.set(xz[0], 0, xz[1]);
scene.add(moon);
moon.rotateY((270 * Math.PI) / 180);
// const spacetexture = new THREE.TextureLoader().load('./assets/space.jpg')
// scene.background=spacetexture
// console.log(moon_phases_en, moon_phases_hi);
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
// controls.reset()
animate();
function resetctrl() {
  controls.reset();
}
// resetctrl()
var mybtn = document.getElementById("btn");
mybtn.addEventListener("click", resetctrl);
