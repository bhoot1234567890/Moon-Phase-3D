// Custom on-brand date picker.
// It is a presentational layer over the hidden native #dateInput: picking a
// date writes the ISO value to that input and dispatches `change`, which
// main.js already listens for to recompute the moon phase. main.js sets the
// input's initial value (today) before this module runs (document order).

const input = document.getElementById("dateInput");
const trigger = document.getElementById("dateTrigger");
const label = document.getElementById("dateLabel");
const panel = document.getElementById("datePanel");
const titleEl = document.getElementById("dpTitle");
const grid = document.getElementById("dpGrid");
const prevBtn = document.getElementById("dpPrev");
const nextBtn = document.getElementById("dpNext");
const todayBtn = document.getElementById("dpToday");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function toISO(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function fmt(d) {
  return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

let selected = parseISO(input && input.value) || new Date();
let view = new Date(selected.getFullYear(), selected.getMonth(), 1);

function buildCell(date, muted) {
  const today = new Date();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dp-day" + (muted ? " muted" : "");
  btn.textContent = date.getDate();
  if (isSameDay(date, today)) btn.classList.add("today");
  if (isSameDay(date, selected)) btn.classList.add("selected");
  btn.addEventListener("click", () => {
    selected = date;
    if (muted) view = new Date(date.getFullYear(), date.getMonth(), 1);
    label.textContent = fmt(selected);
    input.value = toISO(selected);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    render();
    close();
  });
  return btn;
}

function render() {
  titleEl.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
  grid.innerHTML = "";

  const year = view.getFullYear();
  const month = view.getMonth();
  const startDow = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  for (let i = startDow - 1; i >= 0; i--) {
    grid.appendChild(buildCell(new Date(year, month - 1, daysInPrev - i), true));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(buildCell(new Date(year, month, d), false));
  }
  // Trailing days fill the grid to a stable 6-row block.
  const filled = grid.children.length;
  const target = filled <= 35 ? 35 : 42;
  let next = 1;
  while (grid.children.length < target) {
    grid.appendChild(buildCell(new Date(year, month + 1, next++), true));
  }
}

function open() {
  panel.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
}
function close() {
  panel.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
}
function toggle() {
  panel.hidden ? open() : close();
}

trigger.addEventListener("click", (e) => {
  e.stopPropagation();
  toggle();
});
prevBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
  render();
});
nextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  render();
});
todayBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const t = new Date();
  selected = t;
  view = new Date(t.getFullYear(), t.getMonth(), 1);
  label.textContent = fmt(selected);
  input.value = toISO(selected);
  input.dispatchEvent(new Event("change", { bubbles: true }));
  render();
  close();
});
document.addEventListener("click", (e) => {
  if (!panel.hidden && !panel.contains(e.target) && e.target !== trigger) {
    close();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) close();
});

label.textContent = fmt(selected);
render();
