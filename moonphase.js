// Pure lunar-phase astronomy. No DOM, no Three.js — safe to unit-test in Node.

// Julian Day Number from a Date (host-timezone aware).
export function getJulian(date) {
  return date / 86400000 - date.getTimezoneOffset() / 1440 + 2440587.5;
}

// Synodic age of the moon in [0, 1): 0 = new, ~0.5 = full.
// Classic iterative solver: walk lunations forward from the reference epoch
// until the projected new-moon date passes the target, applying standard
// perturbation corrections (M5/M6/B6) at each step.
export function moonDay(today) {
  const getFrac = (fr) => fr - Math.floor(fr);
  const thisJD = getJulian(today);
  const year = today.getFullYear();
  const degToRad = 3.14159265 / 180;

  const K0 = Math.floor((year - 1900) * 12.3685);
  const T = (year - 1899.5) / 100;
  const T2 = T * T;
  const T3 = T * T * T;
  const J0 = 2415020 + 29 * K0;
  const F0 =
    0.0001178 * T2 -
    0.000000155 * T3 +
    (0.75933 + 0.53058868 * K0) -
    (0.000837 * T + 0.000335 * T2);
  const M0 =
    360 * getFrac(K0 * 0.08084821133) +
    359.2242 -
    0.0000333 * T2 -
    0.00000347 * T3;
  const M1 =
    360 * getFrac(K0 * 0.07171366128) +
    306.0253 +
    0.0107306 * T2 +
    0.00001236 * T3;
  const B1 =
    360 * getFrac(K0 * 0.08519585128) +
    21.2964 -
    0.0016528 * T2 -
    0.00000239 * T3;

  let phase = 0;
  let jday = 0;
  let oldJ = 0;
  // Defensive cap — real dates converge in ~30 iterations.
  while (jday < thisJD && phase < 1e6) {
    let F = F0 + 1.530588 * phase;
    const M5 = (M0 + phase * 29.10535608) * degToRad;
    const M6 = (M1 + phase * 385.81691806) * degToRad;
    const B6 = (B1 + phase * 390.67050646) * degToRad;
    F -= 0.4068 * Math.sin(M6) + (0.1734 - 0.000393 * T) * Math.sin(M5);
    F += 0.0161 * Math.sin(2 * M6) + 0.0104 * Math.sin(2 * B6);
    F -= 0.0074 * Math.sin(M5 - M6) - 0.0051 * Math.sin(M5 + M6);
    F += 0.0021 * Math.sin(2 * M5) + 0.001 * Math.sin(2 * B6 - M6);
    F += 0.5 / 1440;
    oldJ = jday;
    jday = J0 + 28 * phase + Math.floor(F);
    phase++;
  }

  // 29.53059 days per synodic month.
  return (thisJD - oldJ) / 29.53059;
}

// Phase angle in degrees, [0, 360).
export function phaseAngle(date) {
  return moonDay(date) * 360;
}

// Phase bucket 0..7: 0 New, 1 Waxing Crescent, 2 First Quarter, 3 Waxing Gibbous,
// 4 Full, 5 Waning Gibbous, 6 Last Quarter, 7 Waning Crescent.
export function phaseIndex(date) {
  return ((Math.round(phaseAngle(date) / 45) % 8) + 8) % 8;
}
