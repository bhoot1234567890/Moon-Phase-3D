// Custom on-brand date picker, wired to the shared app context (ctx).
// Selecting a date calls ctx.setDate (the single source of truth); external date
// changes (time-scrub, keyboard) sync back via ctx.onDate.

export function initCalendar(ctx) {
  const trigger = document.getElementById("dateTrigger");
  const label = document.getElementById("dateLabel");
  const panel = document.getElementById("datePanel");
  const titleEl = document.getElementById("dpTitle");
  const grid = document.getElementById("dpGrid");
  const prevBtn = document.getElementById("dpPrev");
  const nextBtn = document.getElementById("dpNext");
  const todayBtn = document.getElementById("dpToday");
  if (!trigger || !panel) return;

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const toISO = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  const fmt = (d) => MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let selected = ctx.getDate();
  let view = new Date(selected.getFullYear(), selected.getMonth(), 1);

  function buildCell(date, muted) {
    const today = new Date();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dp-day" + (muted ? " muted" : "");
    btn.textContent = date.getDate();
    if (sameDay(date, today)) btn.classList.add("today");
    if (sameDay(date, selected)) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      selected = date;
      if (muted) view = new Date(date.getFullYear(), date.getMonth(), 1);
      ctx.setDate(selected);
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
    const startDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--)
      grid.appendChild(buildCell(new Date(year, month - 1, daysInPrev - i), true));
    for (let d = 1; d <= daysInMonth; d++)
      grid.appendChild(buildCell(new Date(year, month, d), false));
    const target = grid.children.length <= 35 ? 35 : 42;
    let next = 1;
    while (grid.children.length < target)
      grid.appendChild(buildCell(new Date(year, month + 1, next++), true));
  }

  const open = () => {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const toggle = () => (panel.hidden ? open() : close());

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
    ctx.setDate(new Date());
    render();
    close();
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== trigger) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });

  // Sync from external date changes (time-scrub, keyboard, URL).
  ctx.onDate((d) => {
    selected = d;
    view = new Date(d.getFullYear(), d.getMonth(), 1);
    label.textContent = fmt(d);
    render();
  });

  label.textContent = fmt(selected);
  render();
}
