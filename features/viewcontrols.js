// ViewControls — three behaviors, all self-contained:
//   1. Hemisphere toggle (toolbar button + bus event)
//   2. Shareable URL (#date=YYYY-MM-DD round-trips the current date)
//   3. Keyboard shortcuts (step days / reset / flip / play)
//
// Builds only against the documented `ctx` contract. The only visible UI is a
// single .tool-btn appended to the shared #toolbar — its styling lives in
// style.css, so no CSS injection is required.

// Format a Date's LOCAL calendar components as YYYY-MM-DD (NOT UTC — avoids
// off-by-one when the local day differs from the UTC day).
function localISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Return a NEW Date offset by n days (leaves the original untouched).
function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

export function initViewControls(ctx) {
  // ---------------------------------------------------------------------
  // (2) Shareable URL
  // ---------------------------------------------------------------------
  // Capture any date encoded in the URL on load. main.js seeds "today" via
  // setDate() AFTER all features init, which would clobber a synchronous
  // apply — so we stash the URL date and re-assert it on the first `date`
  // emission, letting it win over the today-seed.
  let pendingUrlDate = null;
  {
    const m = /^#date=(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    if (m) {
      const d = new Date(m[1] + "T12:00:00"); // noon avoids DST edge cases
      if (!Number.isNaN(d.getTime())) pendingUrlDate = d;
    }
  }

  ctx.onDate((date) => {
    if (pendingUrlDate) {
      // First emit (the today-seed): override with the URL date. setDate
      // re-emits synchronously; pendingUrlDate is already cleared so the
      // re-entry takes the normal hash-update path below.
      const pd = pendingUrlDate;
      pendingUrlDate = null;
      ctx.setDate(pd);
      return;
    }
    const iso = localISODate(date);
    const hash = "#date=" + iso;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  });

  // ---------------------------------------------------------------------
  // (1) Hemisphere toggle
  // ---------------------------------------------------------------------
  let flipped = false;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tool-btn";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "Toggle lunar hemisphere");
  btn.textContent = "Northern ◑";
  document.getElementById("toolbar").appendChild(btn);

  function toggle() {
    ctx.moon.rotateZ(Math.PI); // 180° flip; two toggles restore identity
    flipped = !flipped;
    btn.setAttribute("aria-pressed", flipped ? "true" : "false");
    btn.textContent = (flipped ? "Southern" : "Northern") + " ◑";
    ctx.render();
  }
  btn.addEventListener("click", toggle);
  // Bus hook so the keyboard shortcut (and anything else) can trigger it.
  ctx.on("toggleHemisphere", toggle);

  // ---------------------------------------------------------------------
  // (3) Keyboard shortcuts
  // ---------------------------------------------------------------------
  function shouldSkip(e) {
    const el = document.activeElement;
    if (
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable)
    ) {
      return true;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return true;
    // Date panel open — let it own the keyboard.
    if (!document.getElementById("datePanel")?.hidden) return true;
    return false;
  }

  document.addEventListener("keydown", (e) => {
    if (shouldSkip(e)) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault(); // stop horizontal page scroll
        ctx.setDate(addDays(ctx.getDate(), -1));
        break;
      case "ArrowRight":
        e.preventDefault(); // stop horizontal page scroll
        ctx.setDate(addDays(ctx.getDate(), 1));
        break;
      case "r":
      case "R":
        ctx.resetView();
        break;
      case "h":
      case "H":
        toggle();
        break;
      case " ": // modern
      case "Spacebar": // legacy
        e.preventDefault(); // stop page scroll
        ctx.emit("togglePlay");
        break;
      default:
        break;
    }
  });
}
