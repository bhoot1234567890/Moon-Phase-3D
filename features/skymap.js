// SkyMap — bright named stars + constellation lines on a celestial sphere.
// ADDITIVE to the procedural starfield in main.js: we only ever add objects
// to ctx.scene, never remove or modify anything else.
import {
  Points,
  PointsMaterial,
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial,
} from "three";

// Celestial sphere radius: large enough to enclose the camera (z=80) and the
// procedural starfield (~±100), so named stars read as a far backdrop.
const SPHERE_R = 400;

// --- Bright-star catalog -------------------------------------------------
// { name, ra (deg 0..360), dec (deg -90..90), mag (visual) }
// RA/Dec are J2000 equatorial coordinates; values are public astronomical
// constants rounded to 2 dp. Hand-picked to include the brightest real stars
// plus every star referenced by the constellation lines below.
const STARS = [
  // Brightest of the sky (independent of any drawn constellation)
  { name: "Sirius", ra: 101.29, dec: -16.72, mag: -1.46 },
  { name: "Canopus", ra: 95.99, dec: -52.7, mag: -0.74 },
  { name: "Arcturus", ra: 213.92, dec: 19.18, mag: -0.05 },
  { name: "Vega", ra: 279.23, dec: 38.78, mag: 0.03 },
  { name: "Capella", ra: 79.17, dec: 45.99, mag: 0.08 },
  { name: "Rigel", ra: 78.63, dec: -8.2, mag: 0.13 },
  { name: "Procyon", ra: 114.83, dec: 5.22, mag: 0.34 },
  { name: "Achernar", ra: 24.43, dec: -57.24, mag: 0.46 },
  { name: "Betelgeuse", ra: 88.79, dec: 7.41, mag: 0.42 },
  { name: "Hadar", ra: 210.96, dec: -60.37, mag: 0.61 },
  { name: "Altair", ra: 297.7, dec: 8.87, mag: 0.77 },
  { name: "Acrux", ra: 186.65, dec: -63.1, mag: 0.77 },
  { name: "Aldebaran", ra: 68.98, dec: 16.51, mag: 0.85 },
  { name: "Antares", ra: 247.35, dec: -26.43, mag: 1.09 },
  { name: "Spica", ra: 201.3, dec: -11.16, mag: 1.04 },
  { name: "Pollux", ra: 116.33, dec: 28.03, mag: 1.14 },
  { name: "Fomalhaut", ra: 344.41, dec: -29.62, mag: 1.16 },
  { name: "Deneb", ra: 310.36, dec: 45.28, mag: 1.25 },
  { name: "Regulus", ra: 152.09, dec: 11.97, mag: 1.4 },
  { name: "Castor", ra: 113.65, dec: 31.89, mag: 1.58 },
  { name: "Bellatrix", ra: 81.28, dec: 6.35, mag: 1.64 },
  { name: "Polaris", ra: 37.95, dec: 89.26, mag: 1.97 },
  { name: "Alphard", ra: 141.9, dec: -8.66, mag: 1.98 },
  { name: "Hamal", ra: 31.79, dec: 23.46, mag: 2.0 },
  { name: "Algol", ra: 47.04, dec: 40.96, mag: 2.12 },
  { name: "Mira", ra: 34.84, dec: -2.98, mag: 3.0 },

  // Orion
  { name: "Mintaka", ra: 83.0, dec: -0.3, mag: 2.23 },
  { name: "Alnilam", ra: 84.05, dec: -1.2, mag: 1.69 },
  { name: "Alnitak", ra: 85.19, dec: -1.94, mag: 1.74 },
  { name: "Saiph", ra: 86.94, dec: -9.67, mag: 2.07 },
  { name: "Meissa", ra: 83.78, dec: 9.93, mag: 3.39 },

  // Ursa Major — Big Dipper
  { name: "Dubhe", ra: 165.93, dec: 61.75, mag: 1.79 },
  { name: "Merak", ra: 165.46, dec: 56.38, mag: 2.37 },
  { name: "Phecda", ra: 178.46, dec: 53.69, mag: 2.44 },
  { name: "Megrez", ra: 183.86, dec: 57.03, mag: 3.31 },
  { name: "Alioth", ra: 193.51, dec: 55.96, mag: 1.77 },
  { name: "Mizar", ra: 200.98, dec: 54.93, mag: 2.27 },
  { name: "Alkaid", ra: 206.89, dec: 49.31, mag: 1.86 },

  // Cassiopeia
  { name: "Schedar", ra: 10.13, dec: 56.54, mag: 2.24 },
  { name: "Caph", ra: 2.29, dec: 59.15, mag: 2.28 },
  { name: "GammaCas", ra: 14.18, dec: 60.72, mag: 2.47 },
  { name: "Ruchbah", ra: 21.45, dec: 60.24, mag: 2.68 },
  { name: "Segin", ra: 28.6, dec: 63.67, mag: 3.38 },

  // Cygnus
  { name: "Sadr", ra: 305.56, dec: 40.26, mag: 2.2 },
  { name: "Albireo", ra: 292.68, dec: 27.96, mag: 3.18 },
  { name: "Gienah", ra: 311.52, dec: 33.97, mag: 2.48 },
  { name: "DeltaCyg", ra: 296.24, dec: 45.13, mag: 2.87 },

  // Leo
  { name: "Denebola", ra: 177.26, dec: 14.57, mag: 2.13 },
  { name: "Algieba", ra: 154.99, dec: 19.84, mag: 2.01 },
  { name: "Zosma", ra: 168.53, dec: 20.52, mag: 2.56 },
  { name: "Chertan", ra: 168.56, dec: 15.43, mag: 3.34 },
  { name: "Adhafera", ra: 154.17, dec: 23.42, mag: 3.43 },
  { name: "EpsLeo", ra: 146.46, dec: 23.77, mag: 2.98 },
];

// --- Constellation line definitions --------------------------------------
// Each entry is a list of [starA, starB] segments; coordinates come from the
// catalog above (looked up by name at build time).
const CONSTELLATIONS = {
  Orion: [
    ["Betelgeuse", "Bellatrix"], // shoulders
    ["Betelgeuse", "Alnitak"], // shoulder -> belt
    ["Bellatrix", "Mintaka"], // shoulder -> belt
    ["Mintaka", "Alnilam"], // belt
    ["Alnilam", "Alnitak"], // belt
    ["Rigel", "Mintaka"], // leg -> belt
    ["Saiph", "Alnitak"], // leg -> belt
    ["Rigel", "Saiph"], // legs
  ],
  "Big Dipper": [
    ["Dubhe", "Merak"], // bowl
    ["Merak", "Phecda"],
    ["Phecda", "Megrez"],
    ["Megrez", "Dubhe"],
    ["Megrez", "Alioth"], // handle
    ["Alioth", "Mizar"],
    ["Mizar", "Alkaid"],
  ],
  Cassiopeia: [
    ["Segin", "Ruchbah"],
    ["Ruchbah", "GammaCas"],
    ["GammaCas", "Schedar"],
    ["Schedar", "Caph"],
  ],
  Cygnus: [
    ["Deneb", "Sadr"], // long axis (top)
    ["Sadr", "Albireo"], // long axis (bottom)
    ["DeltaCyg", "Sadr"], // crossbar
    ["Sadr", "Gienah"],
  ],
  Leo: [
    ["Regulus", "Algieba"], // sickle
    ["Algieba", "Adhafera"],
    ["Adhafera", "EpsLeo"], // sickle tip
    ["Algieba", "Zosma"], // back
    ["Zosma", "Denebola"], // hindquarters
    ["Zosma", "Chertan"],
    ["Chertan", "Denebola"],
    ["Regulus", "Chertan"], // under-body
  ],
};

// Equatorial -> Cartesian on the celestial sphere (RA/Dec given in degrees).
//   x = R cos(dec) cos(ra)
//   y = R sin(dec)
//   z = R cos(dec) sin(ra)
function equatorialToCartesian(raDeg, decDeg, radius) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const cd = Math.cos(dec);
  return {
    x: radius * cd * Math.cos(ra),
    y: radius * Math.sin(dec),
    z: radius * cd * Math.sin(ra),
  };
}

// Split catalog into two magnitude bins so the brightest stars read larger.
// mag < BRIGHT_MAG  -> big white points
// else              -> smaller pale-blue points
const BRIGHT_MAG = 1.3;
const BRIGHT_COLOR = 0xffffff;
const BRIGHT_SIZE = 2.4;
const NORMAL_COLOR = 0xcfe0ff;
const NORMAL_SIZE = 1.4;

function buildPoints(stars) {
  const bright = [];
  const normal = [];
  for (const s of stars) {
    const p = equatorialToCartesian(s.ra, s.dec, SPHERE_R);
    const arr = s.mag < BRIGHT_MAG ? bright : normal;
    arr.push(p.x, p.y, p.z);
  }
  const meshes = [];
  for (const [pos, color, size] of [
    [bright, BRIGHT_COLOR, BRIGHT_SIZE],
    [normal, NORMAL_COLOR, NORMAL_SIZE],
  ]) {
    if (pos.length === 0) continue;
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    const mat = new PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      depthWrite: false,
      transparent: true,
    });
    meshes.push(new Points(geom, mat));
  }
  return meshes;
}

function buildLines(starsByName, constellations) {
  const coords = [];
  let missing = 0;
  for (const segments of Object.values(constellations)) {
    for (const [a, b] of segments) {
      const pa = starsByName.get(a);
      const pb = starsByName.get(b);
      if (!pa || !pb) {
        missing++;
        continue;
      }
      coords.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
  }
  if (missing) console.warn("[skymap] dropped", missing, "segments referencing unknown stars");
  if (coords.length === 0) return null;
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(new Float32Array(coords), 3));
  const mat = new LineBasicMaterial({
    color: 0xc9b8f6, // lavender — matches app accent
    transparent: true,
    opacity: 0.35,
  });
  return new LineSegments(geom, mat);
}

export function initSkyMap(ctx) {
  // name -> cartesian coordinate lookup (reused for line endpoints)
  const starsByName = new Map();
  for (const s of STARS) {
    starsByName.set(s.name, equatorialToCartesian(s.ra, s.dec, SPHERE_R));
  }

  // Stars live in world space — never parented to the moon.
  const starMeshes = buildPoints(STARS);
  for (const m of starMeshes) ctx.scene.add(m);

  const lines = buildLines(starsByName, CONSTELLATIONS);
  let constellationsOn = true;
  if (lines) {
    lines.visible = constellationsOn;
    ctx.scene.add(lines);
  }

  // --- Toolbar toggle for constellation lines (stars always on) ---
  const toolbar = document.getElementById("toolbar");
  if (toolbar) {
    const btn = document.createElement("button");
    btn.className = "tool-btn";
    btn.type = "button";
    btn.textContent = "Constellations";
    btn.title = "Show / hide constellation lines";
    btn.setAttribute("aria-pressed", String(constellationsOn));
    btn.addEventListener("click", () => {
      constellationsOn = !constellationsOn;
      btn.setAttribute("aria-pressed", String(constellationsOn));
      if (lines) lines.visible = constellationsOn;
      ctx.render();
    });
    toolbar.appendChild(btn);
  }

  // Render once so the new objects appear (setDate() at boot re-renders too).
  ctx.render();
}
