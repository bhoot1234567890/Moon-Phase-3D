// System View — a toggle that makes the phase GEOMETRY obvious by revealing
// the Sun and Earth in the scene. The Sun mesh rides along the same direction
// as ctx.directionalLight (which setDate repositions each date), so you can
// literally see the moon's lit hemisphere face the Sun. Pulls the camera back
// to an overview while ON; restores the close-up when OFF.
import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  AdditiveBlending,
} from "three";

// --- Tunables -------------------------------------------------------------
const SUN_DISTANCE = 160; // push the sun outward along the light dir for visibility
const SUN_RADIUS = 6;
const EARTH_RADIUS = 5;
const EARTH_POS = [-40, 0, 0]; // "opposite-ish" marker so Sun–Moon–Earth reads
const OVERVIEW_POS = [0, 60, 200]; // camera pose while system view is ON

export function initSystemView(ctx) {
  const toolbar = document.getElementById("toolbar");
  if (!toolbar) return;

  // --- Toggle button (shared .tool-btn style) -----------------------------
  const button = document.createElement("button");
  button.className = "tool-btn";
  button.type = "button";
  button.textContent = "System View";
  button.setAttribute("aria-pressed", "false");
  button.title = "Reveal the Sun and Earth to show the phase geometry";
  toolbar.appendChild(button);

  let on = false;

  // Kept as module-scope references so OFF can remove + dispose them.
  let sun = null; // bright unlit sphere
  let glow = null; // child of sun: subtle additive corona
  let earth = null; // blue-green reference sphere

  // Same heading as the phase light, pushed outward for visibility.
  function sunTargetPosition() {
    return ctx.directionalLight.position.clone().setLength(SUN_DISTANCE);
  }

  function buildBodies() {
    if (sun) return; // guard against double-add

    // Sun: MeshBasicMaterial is unlit, so it reads as a light source.
    sun = new Mesh(
      new SphereGeometry(SUN_RADIUS, 32, 32),
      new MeshBasicMaterial({ color: 0xfff6c0 })
    );
    sun.position.copy(sunTargetPosition());

    // Subtle corona — a larger transparent additive sphere. No extra light is
    // added, so the moon's phase (driven solely by ctx.directionalLight) is
    // never washed out.
    glow = new Mesh(
      new SphereGeometry(SUN_RADIUS * 2.4, 32, 32),
      new MeshBasicMaterial({
        color: 0xfff2a0,
        transparent: true,
        opacity: 0.18,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    );
    sun.add(glow); // glow follows the sun automatically
    ctx.scene.add(sun);

    // Earth: standard blue-green material. It picks up the phase light, so its
    // own lit hemisphere also faces the Sun — a nice secondary cue. A faint
    // emissive keeps the night side barely readable from any angle without
    // adding scene light (which would distort the moon's phase).
    earth = new Mesh(
      new SphereGeometry(EARTH_RADIUS, 32, 32),
      new MeshStandardMaterial({
        color: 0x2b6cc4,
        emissive: 0x0a1830,
        emissiveIntensity: 0.35,
        roughness: 0.85,
        metalness: 0.0,
      })
    );
    earth.position.set(...EARTH_POS);
    ctx.scene.add(earth);
  }

  function disposeBodies() {
    if (sun) {
      ctx.scene.remove(sun); // removing parent also drops the glow child
      sun.geometry.dispose();
      sun.material.dispose();
    }
    if (glow) {
      glow.geometry.dispose();
      glow.material.dispose();
    }
    if (earth) {
      ctx.scene.remove(earth);
      earth.geometry.dispose();
      earth.material.dispose();
    }
    sun = glow = earth = null;
  }

  function enterOverview() {
    ctx.camera.position.set(...OVERVIEW_POS);
    ctx.camera.lookAt(0, 0, 0);
    ctx.controls.target.set(0, 0, 0);
    ctx.controls.update();
    ctx.render();
  }

  function restoreCloseup() {
    ctx.camera.position.set(0, 0, ctx.constants.cameraZ);
    ctx.controls.target.set(0, 0, 0);
    ctx.controls.update();
    ctx.render();
  }

  // --- Keep the Sun aligned with the phase light as the date changes -------
  // setDate() repositions ctx.directionalLight, renders, THEN emits "date", so
  // the just-rendered frame still shows the Sun in its old spot. We reposition
  // the Sun here and render once more so it never lags a frame behind the light.
  const offDate = ctx.onDate(() => {
    if (!on || !sun) return;
    sun.position.copy(sunTargetPosition()); // glow rides along as a child
    ctx.render();
  });

  function toggle() {
    on = !on;
    button.setAttribute("aria-pressed", String(on));
    if (on) {
      buildBodies();
      enterOverview();
    } else {
      disposeBodies();
      restoreCloseup();
    }
  }

  button.addEventListener("click", toggle);

  // Defensive teardown (not currently invoked by main.js, but keeps the
  // references honest if the feature is ever hot-removed).
  return () => {
    button.removeEventListener("click", toggle);
    offDate();
    disposeBodies();
  };
}
