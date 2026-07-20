/* === Tour bar (shared by desktop sidebar footer and mobile bar) === */
function setText(node, value) { if (node) node.textContent = value; }

/* Sync labels, counters, and arrow disabled states with tourIndex.
   Off-campus stops get an appended arrow glyph and explanatory title. */
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
    return;
  }
  const stop = tourStops[tourIndex];
  const name = cleanName(stop.feature.properties.name);
  const offCampus = !!(stop.feature.properties && stop.feature.properties.off_campus);

  const labelText = offCampus ? `${name} ↗` : name;
  const titleText = offCampus
    ? `${name} — off-campus location (not on this map)`
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
}

/* Jump to a stop by index (clamped) and select its feature. */
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

