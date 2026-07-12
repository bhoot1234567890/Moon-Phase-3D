// features/timecontrols.js
// Bottom-center time control bar: play/pause, speed, reverse, and a ±365-day scrubber.
// Self-contained: builds its own DOM + scoped <style> (prefix `mp-tc-`). Talks only to `ctx`.
export function initTimeControls(ctx) {
  const MS_DAY = 86_400_000;

  // ---- Speed presets: ms of simulated time advanced per real second ----
  const SPEEDS = [
    { id: "hr", label: "1 hr/s", msPerSec: 3_600_000 },
    { id: "day", label: "1 day/s", msPerSec: MS_DAY },
    { id: "wk", label: "1 wk/s", msPerSec: 7 * MS_DAY },
  ];
  let speed = SPEEDS[1]; // default 1 day/s
  let dir = 1; // +1 forward, -1 reverse

  // ---- Scrubber window: today ± 365 days, snapped to local noon ----
  const base = ctx.getDate();
  const noon = new Date(base);
  noon.setHours(12, 0, 0, 0);
  const minMs = noon.getTime() - 365 * MS_DAY;
  const maxMs = noon.getTime() + 365 * MS_DAY;

  let epoch = base.getTime();
  let playing = false;
  let rafId = null;
  let lastTs = null;
  let dragging = false;

  // ============================ styles ============================
  const style = document.createElement("style");
  style.textContent = `
.mp-tc-bar{
  position:absolute; bottom:6vh; left:50%; transform:translateX(-50%);
  z-index:120;
  display:flex; align-items:center; gap:10px;
  max-width:min(92vw,560px);
  padding:8px 12px;
  border-radius:14px;
  border:1px solid rgba(201,184,246,0.35);
  background:rgba(20,14,36,0.72);
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
  box-shadow:0 8px 30px rgba(0,0,0,0.45);
  color:#ece4ff;
  font:600 13px/1 system-ui,sans-serif;
  user-select:none;
}
.mp-tc-btn{
  display:inline-flex; align-items:center; justify-content:center;
  min-height:34px; padding:0 12px;
  border-radius:9px;
  border:1px solid rgba(201,184,246,0.35);
  background:rgba(40,28,66,0.55);
  color:#ece4ff;
  font:600 13px/1 system-ui,sans-serif;
  cursor:pointer;
  transition:border-color .18s ease, box-shadow .18s ease, transform .12s ease, background .18s ease;
}
.mp-tc-btn:hover{
  border-color:rgba(201,184,246,0.8);
  box-shadow:0 0 0 1px rgba(201,184,246,0.2),0 6px 18px rgba(120,60,220,0.35);
  transform:translateY(-1px);
}
.mp-tc-btn:focus-visible{ outline:2px solid rgb(201,184,246); outline-offset:2px; }
.mp-tc-btn[aria-pressed="true"]{
  background:linear-gradient(135deg,#ff00c8,#7a3cff);
  border-color:transparent; color:#fff;
}
.mp-tc-play{ min-width:44px; font-size:15px; }
.mp-tc-speed{ display:flex; gap:6px; }
.mp-tc-speed-btn{ padding:0 10px; min-width:60px; }
.mp-tc-rev{ min-width:40px; font-size:13px; letter-spacing:-1px; }

.mp-tc-slider{
  -webkit-appearance:none; appearance:none;
  flex:1 1 auto; min-width:120px;
  height:6px; border-radius:999px;
  background:linear-gradient(90deg,rgba(201,184,246,0.25),rgba(201,184,246,0.6));
  cursor:pointer; outline:none;
}
.mp-tc-slider::-webkit-slider-thumb{
  -webkit-appearance:none; appearance:none;
  width:18px; height:18px; border-radius:50%;
  background:linear-gradient(135deg,#ff00c8,#7a3cff);
  border:2px solid #ece4ff;
  box-shadow:0 0 10px rgba(122,60,255,0.7);
  cursor:grab;
}
.mp-tc-slider::-webkit-slider-thumb:active{ cursor:grabbing; transform:scale(1.12); }
.mp-tc-slider::-moz-range-thumb{
  width:18px; height:18px; border-radius:50%;
  background:linear-gradient(135deg,#ff00c8,#7a3cff);
  border:2px solid #ece4ff; box-shadow:0 0 10px rgba(122,60,255,0.7);
  cursor:grab;
}
.mp-tc-slider:focus-visible{ outline:2px solid rgba(201,184,246,0.8); outline-offset:6px; border-radius:999px; }

.mp-tc-readout{
  flex:0 0 auto; min-width:96px; text-align:center;
  font:600 12px/1 system-ui,sans-serif;
  color:rgb(201,184,246);
  letter-spacing:.02em;
}

@media (max-width:560px){
  .mp-tc-bar{ gap:7px; padding:7px 9px; max-width:94vw; }
  .mp-tc-speed-btn{ min-width:0; padding:0 7px; }
  .mp-tc-readout{ display:none; }
}
@media (prefers-reduced-motion: reduce){
  .mp-tc-btn{ transition:none; }
}`;
  document.head.appendChild(style);

  // ============================ DOM ============================
  const bar = document.createElement("div");
  bar.className = "mp-tc-bar";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "mp-tc-btn mp-tc-play";
  playBtn.setAttribute("aria-label", "Play");
  playBtn.setAttribute("aria-pressed", "false");
  playBtn.textContent = "▶";

  const speedGrp = document.createElement("div");
  speedGrp.className = "mp-tc-speed";
  speedGrp.setAttribute("role", "group");
  speedGrp.setAttribute("aria-label", "Playback speed");
  const speedBtns = SPEEDS.map((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mp-tc-btn mp-tc-speed-btn";
    b.textContent = s.label;
    b.setAttribute("aria-pressed", String(s.id === speed.id));
    b.addEventListener("click", () => selectSpeed(s));
    speedGrp.appendChild(b);
    return b;
  });

  const revBtn = document.createElement("button");
  revBtn.type = "button";
  revBtn.className = "mp-tc-btn mp-tc-rev";
  revBtn.textContent = "\u25B6\u25B6"; // ▶▶ forward
  revBtn.setAttribute("aria-label", "Reverse direction");
  revBtn.setAttribute("aria-pressed", "false");
  revBtn.title = "Reverse direction";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "mp-tc-slider";
  slider.min = String(minMs);
  slider.max = String(maxMs);
  slider.step = String(MS_DAY);
  slider.value = String(snap(epoch));
  slider.setAttribute("aria-label", "Date scrubber");

  const readout = document.createElement("span");
  readout.className = "mp-tc-readout";

  bar.append(playBtn, speedGrp, revBtn, slider, readout);
  document.body.appendChild(bar);

  // ============================ helpers ============================
  function snap(ms) {
    let v = ms;
    if (v < minMs) v = minMs;
    if (v > maxMs) v = maxMs;
    return Math.round((v - minMs) / MS_DAY) * MS_DAY + minMs;
  }
  function fmt(d) {
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function selectSpeed(s) {
    speed = s;
    SPEEDS.forEach((sp, i) =>
      speedBtns[i].setAttribute("aria-pressed", String(sp.id === s.id))
    );
  }
  function setDir(rev) {
    dir = rev ? -1 : 1;
    revBtn.setAttribute("aria-pressed", String(rev));
    revBtn.textContent = rev ? "\u25C0\u25C0" : "\u25B6\u25B6"; // ◀◀ / ▶▶
    revBtn.title = rev ? "Forward direction" : "Reverse direction";
    revBtn.setAttribute("aria-label", rev ? "Forward direction" : "Reverse direction");
  }
  function updatePlayBtn() {
    playBtn.textContent = playing ? "\u23F8" : "\u25B6"; // ⏸ / ▶
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function paintReadout(d) {
    readout.textContent = fmt(d);
  }
  function syncSliderFromDate(date) {
    slider.value = String(snap(date.getTime()));
    paintReadout(date);
  }

  // ============================ play loop ============================
  function frame(ts) {
    if (!playing) return;
    if (lastTs == null) lastTs = ts;
    const dt = (ts - lastTs) / 1000; // seconds since last frame
    lastTs = ts;
    epoch += speed.msPerSec * dt * dir;
    // clamp to the scrubber window; pause at either edge
    if (epoch >= maxMs) {
      epoch = maxMs;
      ctx.setDate(new Date(epoch));
      pause();
      return;
    }
    if (epoch <= minMs) {
      epoch = minMs;
      ctx.setDate(new Date(epoch));
      pause();
      return;
    }
    ctx.setDate(new Date(epoch));
    rafId = requestAnimationFrame(frame);
  }
  function play() {
    if (playing) return;
    // nudge off a boundary so playback can actually move in this direction
    if (dir > 0 && epoch >= maxMs) epoch = maxMs - MS_DAY;
    if (dir < 0 && epoch <= minMs) epoch = minMs + MS_DAY;
    playing = true;
    lastTs = null;
    updatePlayBtn();
    rafId = requestAnimationFrame(frame);
  }
  function pause() {
    playing = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    updatePlayBtn();
  }
  function togglePlay() {
    if (playing) pause();
    else play();
  }

  // ============================ wiring ============================
  // Play button routes through the bus so any "togglePlay" emitter agrees.
  playBtn.addEventListener("click", () => ctx.emit("togglePlay"));
  revBtn.addEventListener("click", () => setDir(dir > 0));

  // Scrubber: while the pointer is down we hold a drag flag so external
  // date syncs (incl. our own play loop) can't fight the thumb.
  slider.addEventListener("pointerdown", () => {
    dragging = true;
  });
  slider.addEventListener("input", () => {
    epoch = Number(slider.value); // value is grid-aligned (local noon)
    const d = new Date(epoch);
    paintReadout(d);
    ctx.setDate(d);
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });
  window.addEventListener("pointercancel", () => {
    dragging = false;
  });

  // Bus: togglePlay (keyboard space etc.)
  ctx.on("togglePlay", togglePlay);

  // Keep the thumb + internal epoch synced to the single source of truth.
  ctx.onDate((date) => {
    epoch = date.getTime();
    if (!dragging) syncSliderFromDate(date);
  });

  // Spacebar toggles play, but only when the page/canvas itself has focus so we
  // never double-trigger a focused button or hijack form fields.
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag !== "BODY" && tag !== "CANVAS") return;
    e.preventDefault();
    ctx.emit("togglePlay");
  });

  // initial paint
  syncSliderFromDate(ctx.getDate());
  updatePlayBtn();
}
