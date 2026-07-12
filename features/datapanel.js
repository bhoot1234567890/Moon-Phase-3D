// Moon Data panel — a glass info card (top-left) showing live lunar metrics
// for the current ctx.getDate(). Self-contained: builds its own DOM + scoped
// <style> (prefix `mp-dp-`) and never touches shared files.
import { moonDay, phaseAngle, phaseIndex } from "../moonphase.js";

// Tunable: how far forward to scan for the next new / full moon (days).
const NEXT_PHASE_CAP = 45;
const SYNODIC_MONTH = 29.53059;

function initDataPanel(ctx) {
  // ---- Scoped styles -----------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
.mp-dp-card{
  position:absolute; top:12vh; left:5vw; max-width:240px;
  padding:14px 16px 16px;
  background:rgba(20,14,36,0.72);
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  border:1px solid rgba(201,184,246,0.35);
  border-radius:16px;
  color:#ece4ff;
  font-family:system-ui,-apple-system,sans-serif;
  font-size:12px; line-height:1.35;
  box-shadow:0 8px 32px rgba(0,0,0,0.45);
  z-index:5; user-select:none; pointer-events:auto;
}
.mp-dp-accent{
  position:absolute; top:0; left:14px; right:14px; height:2px;
  background:linear-gradient(135deg,#ff00c8,#7a3cff);
  border-radius:0 0 3px 3px;
}
.mp-dp-title{
  display:flex; align-items:center; gap:7px;
  font-size:11px; letter-spacing:0.14em; text-transform:uppercase;
  color:rgb(201,184,246); font-weight:600; margin-bottom:12px;
}
.mp-dp-title .mp-dp-glyph{
  font-size:14px; line-height:1;
  background:linear-gradient(135deg,#ff00c8,#7a3cff);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.mp-dp-row{
  display:flex; justify-content:space-between; align-items:baseline;
  margin:7px 0; gap:12px;
}
.mp-dp-label{ color:rgba(236,228,255,0.7); font-size:11px; }
.mp-dp-value{
  color:#ece4ff; font-weight:600;
  font-variant-numeric:tabular-nums; white-space:nowrap;
}
.mp-dp-bar{
  height:4px; border-radius:4px; margin-top:6px; overflow:hidden;
  background:rgba(201,184,246,0.15);
}
.mp-dp-bar > span{
  display:block; height:100%;
  background:linear-gradient(135deg,#ff00c8,#7a3cff);
  border-radius:4px; transition:width 0.4s ease;
}
.mp-dp-divider{ height:1px; background:rgba(201,184,246,0.18); margin:9px 0; }
.mp-dp-illum{ margin-bottom:2px; }
@media (max-width:520px){
  .mp-dp-card{ top:9vh; left:4vw; max-width:54vw; }
}`;
  document.head.appendChild(style);

  // ---- Card DOM ----------------------------------------------------------
  const card = document.createElement("div");
  card.className = "mp-dp-card";
  card.setAttribute("role", "group");
  card.setAttribute("aria-label", "Moon data");

  const accent = document.createElement("span");
  accent.className = "mp-dp-accent";
  card.appendChild(accent);

  const title = document.createElement("div");
  title.className = "mp-dp-title";
  const glyph = document.createElement("span");
  glyph.className = "mp-dp-glyph";
  glyph.textContent = "\u{1F319}"; // crescent moon
  title.appendChild(glyph);
  title.appendChild(document.createTextNode("Moon Data"));
  card.appendChild(title);

  // Illumination (value + progress bar)
  const illumValue = document.createElement("span");
  illumValue.className = "mp-dp-value";
  const illumBar = document.createElement("span");
  const illumFill = document.createElement("span");
  illumBar.className = "mp-dp-bar";
  illumBar.appendChild(illumFill);
  card.appendChild(row("Illumination", illumValue, "mp-dp-illum"));
  card.appendChild(illumBar);

  card.appendChild(divider());

  const ageValue = mkValue();
  card.appendChild(row("Age", ageValue));

  const newMoonValue = mkValue();
  card.appendChild(row("Next New Moon", newMoonValue));

  const fullMoonValue = mkValue();
  card.appendChild(row("Next Full Moon", fullMoonValue));

  document.body.appendChild(card);

  // ---- Helpers -----------------------------------------------------------
  function mkValue() {
    const el = document.createElement("span");
    el.className = "mp-dp-value";
    el.textContent = "\u2014"; // em dash placeholder
    return el;
  }

  function row(label, valueEl, extraClass = "") {
    const r = document.createElement("div");
    r.className = "mp-dp-row" + (extraClass ? " " + extraClass : "");
    const lab = document.createElement("span");
    lab.className = "mp-dp-label";
    lab.textContent = label;
    r.appendChild(lab);
    r.appendChild(valueEl);
    return r;
  }

  function divider() {
    const d = document.createElement("div");
    d.className = "mp-dp-divider";
    return d;
  }

  // Earliest future date (scanning forward day-by-day) whose phase bucket
  // matches `target`; null if none within NEXT_PHASE_CAP days.
  function nextPhaseDate(date, target) {
    for (let i = 1; i <= NEXT_PHASE_CAP; i++) {
      const d = new Date(date);
      d.setDate(d.getDate() + i);
      if (phaseIndex(d) === target) return d;
    }
    return null;
  }

  // "Jul 25" style short formatting.
  const FMT = { month: "short", day: "numeric" };
  function fmtShort(d) {
    return d ? d.toLocaleDateString("en-US", FMT) : "\u2014";
  }

  // ---- Update logic ------------------------------------------------------
  function update(date) {
    const illum = Math.round(
      ((1 - Math.cos((phaseAngle(date) * Math.PI) / 180)) / 2) * 100
    );
    illumValue.textContent = illum + "%";
    illumFill.style.width = Math.max(0, Math.min(100, illum)) + "%";

    const age = moonDay(date) * SYNODIC_MONTH;
    ageValue.textContent = age.toFixed(1) + " days";

    newMoonValue.textContent = fmtShort(nextPhaseDate(date, 0));
    fullMoonValue.textContent = fmtShort(nextPhaseDate(date, 4));
  }

  // Initial render + live updates whenever the date changes (calendar/keyboard).
  update(ctx.getDate());
  ctx.onDate(update);
}

export { initDataPanel };
