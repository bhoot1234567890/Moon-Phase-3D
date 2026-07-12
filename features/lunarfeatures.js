// LunarFeatures — Apollo landing sites + named surface features.
//
// Pins are CHILDREN of ctx.moon, so they inherit the moon's rotation and stay
// glued to the surface as the phase (and thus the moon's spin) changes. Each
// pin also gets an HTML label projected onto the screen every frame; labels
// hide when the pin is on the far side of the moon or behind the camera.
//
// Self-contained: creates its own DOM + scoped <style> (prefix `mp-lf-`).
// Never edits shared files (main.js / index.html / style.css).

import { Vector3, Group, Mesh, MeshBasicMaterial, SphereGeometry } from "three";

// ----------------------------------------------------------------------
// Feature data: 6 Apollo landing sites + 4 named features (10 total).
// Selenographic latitude/longitude in degrees. Lat +90 = north pole.
// ----------------------------------------------------------------------
const FEATURES = [
  // Apollo landing sites (lime)
  { name: "Apollo 11", lat: 0.674, lon: 23.473, kind: "apollo" },
  { name: "Apollo 12", lat: -3.014, lon: -23.419, kind: "apollo" },
  { name: "Apollo 14", lat: -3.645, lon: -17.479, kind: "apollo" },
  { name: "Apollo 15", lat: 26.132, lon: 3.634, kind: "apollo" },
  { name: "Apollo 16", lat: -8.973, lon: 15.501, kind: "apollo" },
  { name: "Apollo 17", lat: 20.19, lon: 30.772, kind: "apollo" },
  // Named features (magenta)
  { name: "Mare Tranquillitatis", lat: 8.5, lon: 31.4, kind: "named" },
  { name: "Mare Imbrium", lat: 32.8, lon: -15.6, kind: "named" },
  { name: "Tycho", lat: -43.4, lon: -11.0, kind: "named" },
  { name: "Copernicus", lat: 9.6, lon: -20.1, kind: "named" },
];

// ----------------------------------------------------------------------
// LON_OFFSET_DEG — integrator-tunable longitude offset (degrees), added to
// EVERY feature's longitude before the lat/lon -> 3D conversion below.
//
// CAVEAT: the LROC equirectangular texture has its own embedded longitude
// origin, and ctx.moon is pre-rotated by rotateY(270deg). Whether the formula
// below places a pin exactly on its real-world feature depends on that
// texture registration, which this module cannot inspect. If pins appear
// shifted east/west of their features, nudge LON_OFFSET_DEG (try ±90, ±180)
// until a landmark lines up (e.g. Apollo 11 should sit on the western edge of
// Mare Tranquillitatis). 0 = trust selenographic longitude as-is.
// ----------------------------------------------------------------------
const LON_OFFSET_DEG = 0;

// Surface offset so pins hover just above the mesh (avoids z-fighting with
// the displaced DEM surface and keeps the dot visible).
const RADIUS_FACTOR = 1.02;

const APOLLO_COLOR = 0xbef800; // lime
const NAMED_COLOR = 0xff00c8; // magenta
const APOLLO_RADIUS = 0.6; // Apollo pins slightly larger
const NAMED_RADIUS = 0.5;

// Convert selenographic lat/lon (degrees) to a 3D point on/just above the
// sphere surface, in the MOON's local frame (pins are moon children).
//   x = R cos(lat) cos(lon)
//   y = R sin(lat)
//   z = R cos(lat) sin(lon)
function surfacePosition(ctx, latDeg, lonDeg) {
  const R = ctx.constants.moonRadius * RADIUS_FACTOR;
  const lat = (latDeg * Math.PI) / 180;
  const lon = ((lonDeg + LON_OFFSET_DEG) * Math.PI) / 180;
  const cl = Math.cos(lat);
  return new Vector3(R * cl * Math.cos(lon), R * Math.sin(lat), R * cl * Math.sin(lon));
}

export function initLunarFeatures(ctx) {
  // --- Scoped styles (unique prefix mp-lf-) ---
  const style = document.createElement("style");
  style.textContent = `
.mp-lf-label{
  position:absolute; top:0; left:0;
  transform:translate(-50%, calc(-50% - 14px));
  padding:2px 7px;
  border-radius:8px;
  background:rgba(20,14,36,0.72);
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
  border:1px solid rgba(201,184,246,0.35);
  color:#ece4ff;
  font:600 11px/1.2 system-ui,sans-serif;
  letter-spacing:.2px;
  white-space:nowrap;
  pointer-events:none;
  z-index:120;
  opacity:0;
  will-change:left,top,opacity;
  transition:opacity .18s ease;
  user-select:none;
}
.mp-lf-label.mp-lf-apollo{ color:#bef800; border-color:rgba(190,248,0,.55); }
.mp-lf-label.mp-lf-named{ color:#ff00c8; border-color:rgba(255,0,200,.55); }
`;
  document.head.appendChild(style);

  // --- Pin group: child of ctx.moon so it rotates with the globe ---
  const pinGroup = new Group();
  pinGroup.name = "mp-lf-pins";
  ctx.moon.add(pinGroup);

  // Two shared sphere geometries (Apollo = larger). MeshBasicMaterial is
  // unlit, so the pins stay bright against both lit and dark surface.
  const apolloGeo = new SphereGeometry(APOLLO_RADIUS, 16, 16);
  const namedGeo = new SphereGeometry(NAMED_RADIUS, 16, 16);
  const apolloMat = new MeshBasicMaterial({ color: APOLLO_COLOR });
  const namedMat = new MeshBasicMaterial({ color: NAMED_COLOR });

  // --- Build pins + labels ---
  const items = FEATURES.map((f) => {
    const mesh = new Mesh(f.kind === "apollo" ? apolloGeo : namedGeo, f.kind === "apollo" ? apolloMat : namedMat);
    mesh.position.copy(surfacePosition(ctx, f.lat, f.lon));
    pinGroup.add(mesh);

    const label = document.createElement("div");
    label.className = `mp-lf-label mp-lf-${f.kind}`;
    label.textContent = f.name;
    document.body.appendChild(label);

    return { mesh, label };
  });

  // --- Visibility state ---
  let visible = true;
  pinGroup.visible = visible;

  // --- Per-frame: project each pin's WORLD position to a screen label ---
  const worldPos = new Vector3(); // reusable temporaries (no per-frame alloc)
  const ndc = new Vector3();
  const normal = new Vector3();
  const moonCenter = new Vector3();
  const camDir = new Vector3();

  ctx.onRender(() => {
    ctx.moon.getWorldPosition(moonCenter);
    camDir.copy(ctx.camera.position).sub(moonCenter); // moon center -> camera

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const { mesh, label } of items) {
      // Global toggle off -> hide everything, skip the math.
      if (!visible) {
        if (label.style.display !== "none") label.style.display = "none";
        continue;
      }
      label.style.display = "";

      mesh.getWorldPosition(worldPos);

      // Project to normalized device coords.
      ndc.copy(worldPos).project(ctx.camera);

      // Behind the camera? (projected z>1 means outside/behind the frustum)
      if (ndc.z > 1) {
        label.style.opacity = "0";
        continue;
      }

      // Occlusion: the pin is on the far side of the moon when its outward
      // radial normal points away from the camera. normal = worldPos - center.
      normal.copy(worldPos).sub(moonCenter);
      if (normal.dot(camDir) < 0) {
        label.style.opacity = "0";
        continue;
      }

      // Visible -> place the label at the projected screen point.
      const x = (ndc.x * 0.5 + 0.5) * w;
      const y = (-ndc.y * 0.5 + 0.5) * h;
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      label.style.opacity = "1";
    }
  });

  // --- Toolbar toggle: Locations ---
  const btn = document.createElement("button");
  btn.className = "tool-btn";
  btn.type = "button";
  btn.textContent = "Locations";
  btn.setAttribute("aria-pressed", String(visible));
  btn.title = "Show/hide Apollo landing sites & named features";
  btn.addEventListener("click", () => {
    visible = !visible;
    pinGroup.visible = visible;
    btn.setAttribute("aria-pressed", String(visible));
    ctx.render(); // re-run onRender so labels update immediately
  });
  const toolbar = document.getElementById("toolbar");
  if (toolbar) toolbar.appendChild(btn);
}
