import { test } from "node:test";
import assert from "node:assert/strict";
import { moonDay, phaseAngle, phaseIndex } from "./moonphase.js";

const at = (iso) => new Date(iso);

test("moonDay returns a synodic age in [0, 1)", () => {
  for (const d of ["2026-01-01", "2026-07-12", "2030-12-31", "1999-03-15"]) {
    const m = moonDay(at(d + "T12:00:00"));
    assert.ok(m >= 0 && m < 1, `${d} -> ${m}`);
  }
});

test("phaseAngle is in [0, 360)", () => {
  for (const d of ["2026-07-12", "2026-07-27", "2000-06-15"]) {
    const a = phaseAngle(at(d + "T12:00:00"));
    assert.ok(a >= 0 && a < 360, `${d} -> ${a}`);
  }
});

test("phaseIndex is an integer in [0, 7]", () => {
  for (const d of ["2026-07-12", "2026-07-27", "2010-10-10"]) {
    const idx = phaseIndex(at(d + "T12:00:00"));
    assert.equal(Number.isInteger(idx), true);
    assert.ok(idx >= 0 && idx <= 7, `${d} -> ${idx}`);
  }
});

test("known phase anchors (observed in-browser)", () => {
  assert.equal(phaseIndex(at("2026-07-12T12:00:00")), 0, "2026-07-12 is New Moon");
  assert.equal(phaseIndex(at("2026-07-27T12:00:00")), 4, "2026-07-27 is Full Moon");
});

test("deterministic: same date yields the same result", () => {
  const a = phaseIndex(at("2026-07-12T12:00:00"));
  const b = phaseIndex(new Date("2026-07-12T12:00:00"));
  assert.equal(a, b);
});

test("phase advances each day, modulo the cycle wrap", () => {
  // The moon moves ~12°/day on average; each consecutive day must advance by a
  // sane, positive amount even when crossing the 360° -> 0° new-moon boundary.
  for (let day = 14; day <= 20; day++) {
    const a = phaseAngle(at(`2026-07-${String(day).padStart(2, "0")}T12:00:00`));
    const b = phaseAngle(at(`2026-07-${String(day + 1).padStart(2, "0")}T12:00:00`));
    const advance = (b - a + 360) % 360;
    assert.ok(advance > 0 && advance < 30, `07-${day}->07-${day + 1}: ${advance}°`);
  }
});
