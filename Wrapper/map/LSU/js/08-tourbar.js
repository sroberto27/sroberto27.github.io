/* === App — Part 8: Tourbar (sec 12) — redesigned render targets ===
   Same state machine (tourIndex / tourStops / goToStop) as before.
   updateTourbar() now ALSO renders:
     • the bottom-center guided-tour pill (progress dots + status)
     • the rail tour card (Stop X of Y, gold progress bar, checklist)
   All original ids (#tourName/#tourCurrent/#tourTotal + mobile
   equivalents) keep receiving the same text as before, so nothing
   else in the app needed to change. */

function setText(node, value) { if (node) node.textContent = value; }

/* ---- Redesign DOM refs (resolved lazily; all optional) ---- */
const tourUI = {
  get dots()     { return document.getElementById("tourDots"); },
  get railTour() { return document.getElementById("railTour"); },
  get railTitle(){ return document.getElementById("railTourTitle"); },
  get railSub()  { return document.getElementById("railTourSub"); },
  get railFill() { return document.getElementById("railTourProgress"); },
  get railStops(){ return document.getElementById("railTourStops"); }
};

/* Render the progress dots inside the guided-tour pill.
   done/current = gold, upcoming = faint. */
function renderTourDots() {
  const wrap = tourUI.dots;
  if (!wrap) return;
  const total = tourStops.length;
  let html = "";
  for (let i = 0; i < total; i++) {
    const cls = i < tourIndex ? "dot is-done"
              : i === tourIndex ? "dot is-current"
              : "dot";
    html += `<span class="${cls}"></span>`;
  }
  wrap.innerHTML = html;
}

/* Render the rail tour card: navy header (Stop X of Y + gold
   progress bar) and the stop checklist (done = gold check,
   current = blue badge, upcoming = gray badge). */
function renderRailTourCard() {
  if (!tourUI.railTour) return;

  const total = tourStops.length;
  const cur   = Math.max(0, tourIndex);

  if (tourIndex >= 0 && tourStops[tourIndex]) {
    const name = cleanName(tourStops[tourIndex].feature.properties.name);
    setText(tourUI.railTitle, `Stop ${tourIndex + 1} of ${total}`);
    setText(tourUI.railSub, name);
  } else {
    setText(tourUI.railTitle, total ? "Start your tour" : "No stops configured");
    setText(tourUI.railSub, total ? `${total} stops on the gameday journey` : "");
  }

  if (tourUI.railFill) {
    const pct = total && tourIndex >= 0
      ? Math.round(((tourIndex + 1) / total) * 100)
      : 0;
    tourUI.railFill.style.width = pct + "%";
  }

  if (tourUI.railStops) {
    tourUI.railStops.innerHTML = tourStops.map((stop, i) => {
      const name = cleanName(stop.feature.properties.name);
      const state = i < cur && tourIndex >= 0 ? "is-done"
                  : i === tourIndex ? "is-current"
                  : "";
      const badge = (i < cur && tourIndex >= 0) ? "✓" : String(i + 1);
      return `<li class="rail-tour-stop ${state}" role="button" tabindex="0"
                  data-stop-index="${i}">
                <span class="stop-badge">${badge}</span>
                <span class="stop-name">${escapeHTML(name)}</span>
              </li>`;
    }).join("");

    tourUI.railStops.querySelectorAll(".rail-tour-stop").forEach((li) => {
      const go = () => goToStop(Number(li.dataset.stopIndex));
      li.addEventListener("click", go);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    });
  }
}

function updateTourbar() {
  if (tourIndex < 0 || !tourStops[tourIndex]) {
    const label = tourStops.length ? "Start your tour" : "No stops configured";
    setText(el.tourName,       label);
    setText(el.tourNameMobile, label);
    const cur = tourIndex < 0 ? 0 : tourIndex + 1;
    setText(el.tourCurrent,       cur);
    setText(el.tourCurrentMobile, cur);

    const prevDisabled = true;
    const nextDisabled = !tourStops.length;
    if (el.tourPrev)       el.tourPrev.disabled       = prevDisabled;
    if (el.tourNext)       el.tourNext.disabled       = nextDisabled;
    if (el.tourPrevMobile) el.tourPrevMobile.disabled = prevDisabled;
    if (el.tourNextMobile) el.tourNextMobile.disabled = nextDisabled;
    if (el.tourName)       el.tourName.classList.remove("is-offcampus");
    if (el.tourNameMobile) el.tourNameMobile.classList.remove("is-offcampus");

    renderTourDots();
    renderRailTourCard();
    return;
  }
  const stop = tourStops[tourIndex];
  const name = cleanName(stop.feature.properties.name);
  const offCampus = !!(stop.feature.properties && stop.feature.properties.off_campus);
  /* ↗ suffix on off-map stops, as before. */
  const labelText = offCampus ? `${name} ↗` : name;
  const titleText = offCampus
    ? `${name} — off-map location (not on this map)`
    : name;
  setText(el.tourName,       labelText);
  setText(el.tourNameMobile, labelText);
  if (el.tourName) {
    el.tourName.title = titleText;
    el.tourName.classList.toggle("is-offcampus", offCampus);
  }
  if (el.tourNameMobile) {
    el.tourNameMobile.title = titleText;
    el.tourNameMobile.classList.toggle("is-offcampus", offCampus);
  }
  setText(el.tourCurrent,       tourIndex + 1);
  setText(el.tourCurrentMobile, tourIndex + 1);

  const prevDisabled = tourIndex === 0;
  const nextDisabled = tourIndex === tourStops.length - 1;
  if (el.tourPrev)       el.tourPrev.disabled       = prevDisabled;
  if (el.tourNext)       el.tourNext.disabled       = nextDisabled;
  if (el.tourPrevMobile) el.tourPrevMobile.disabled = prevDisabled;
  if (el.tourNextMobile) el.tourNextMobile.disabled = nextDisabled;

  renderTourDots();
  renderRailTourCard();
}

function goToStop(i) {
  if (!tourStops.length) return;
  tourIndex = Math.max(0, Math.min(i, tourStops.length - 1));
  const stop = tourStops[tourIndex];
  selectFeature(stop.layer, "tour", { focus: true });
}

function tourPrevAction() { goToStop(Math.max(0, tourIndex - 1)); }
function tourNextAction() {
  if (tourIndex < 0) return goToStop(0);
  goToStop(tourIndex + 1);
}
