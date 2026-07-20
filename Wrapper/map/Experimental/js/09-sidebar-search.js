/* === Locations sidebar, mobile drawer, details drag, search === */

/* -----------------------------------------------------------
   Locations sidebar
   ----------------------------------------------------------- */

/* Sync the active-row highlight in both lists with the selection. */
function syncLocationsList() {
  const rows = el.locationsList.querySelectorAll(".location-row");
  rows.forEach((r) => {
    const name = r.dataset.name || "";
    const active = selectedLayer &&
                   cleanName(selectedLayer.feature.properties.name).toLowerCase() === name;
    r.classList.toggle("is-active", !!active);
  });

  if (el.allLocationsList) {
    const allRows = el.allLocationsList.querySelectorAll(".location-row");
    allRows.forEach((r) => {
      const name = r.dataset.name || "";
      const active = selectedLayer &&
                     cleanName(selectedLayer.feature.properties.name).toLowerCase() === name;
      r.classList.toggle("is-active", !!active);
    });
  }
}

/* Build the Featured list (tour stops) with a "Recenter on Tour" row
   on top. Off-campus stops get a distance badge. */
function renderLocationsList() {
  el.locationsCount.textContent = tourStops.length;
  const rows = [];

  rows.push(`
    <li class="location-row all-row" role="option" data-all="1">
      <div>
        <div class="location-name">Recenter on Tour</div>
        <div class="location-num">${tourStops.length} STOPS</div>
      </div>
      <span class="location-chev">›</span>
    </li>
  `);

  tourStops.forEach((stop, i) => {
    const name = cleanName(stop.feature.properties.name);
    const cat = getCategory(name);
    const props = stop.feature.properties || {};
    const offCampus = !!props.off_campus;
    const distance = props.off_campus_distance || "";
    const offCampusBadge = offCampus && distance
      ? `<span class="location-offcampus-badge" title="This location is not on the campus map">📍 ${distance}</span>`
      : "";
    const rowClass = offCampus ? "location-row is-offcampus" : "location-row";
    rows.push(`
      <li class="${rowClass}" role="option" data-name="${name.toLowerCase()}">
        <div>
          <div class="location-name">
            <span class="location-index">${i + 1}.</span>${name}
          </div>
          <div class="location-cat">${cat}</div>
          ${offCampusBadge}
        </div>
        <span class="location-chev">›</span>
      </li>
    `);
  });

  el.locationsList.innerHTML = rows.join("");

  el.locationsList.querySelectorAll(".location-row").forEach((row) => {
    row.addEventListener("click", () => {
      // "Recenter on Tour" — clear selection and fit the full route.
      if (row.dataset.all) {
        clearSelection();
        if (imageBounds) resetCampusView(true);

        closeMobileLocations();
        return;
      }
      const name = row.dataset.name;
      const stop = tourStops.find(
        (s) => cleanName(s.feature.properties.name).toLowerCase() === name
      );
      if (!stop) return;

      const locationName = cleanName(stop.feature.properties.name);

      closeMobileLocations({ silent: true });

      // Two paths depending on the current mode:
      //   Street view — drive the 3D viewer to the location's sweep
      //     without leaving street view, and silently sync the map
      //     selection so closing street view lands on the right
      //     building. Locations without a sweep fall back to map view.
      //   Map — select the feature, fly the map, open the details.
      if (streetViewActive) {
        const entry = getTreedisEntry(locationName);
        const sweepId = entry && entry.sweepId;
        if (sweepId) {
          openStreetView(sweepId, locationName, getCategory(locationName), {
            rotation:       (entry && entry.rotation)       || null,
            transitionTime: (entry && entry.transitionTime) || null
          });
        } else {

          console.warn(
            "[locations] no Treedis sweep for", locationName,
            "— falling back to map view"
          );
          closeStreetView();
          selectFeature(stop.layer, "tour", { focus: true });
        }

        // Silent sync: keeps tour-bar index, pin highlight, and details
        // correct for when street view is closed later.
        selectFeature(stop.layer, "tour", { focus: false });
        return;
      }

      selectFeature(stop.layer, "tour", { focus: true });
    });
  });
}

/* -----------------------------------------------------------
   "All" tab — every building on campus
   -----------------------------------------------------------
   Populates #allLocationsList from the buildings layer, deduped by
   name. Rows select the feature exactly like Featured rows do. Sort
   mode comes from the radio inputs: a flat A–Z list, or grouped by
   department (a building with N departments appears in N groups;
   buildings with none are bucketed under "Other" at the bottom). */
function renderAllLocationsList() {
  if (!el.allLocationsList || !buildingsLayer) return;

  const seen = new Map();
  buildingsLayer.eachLayer((layer) => {
    const f = layer.feature;
    if (!f || !f.properties) return;
    const raw = f.properties.name;
    if (!raw) return;
    const name = cleanName(raw);
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, { name, layer });
  });

  if (!seen.size) {
    el.allLocationsList.innerHTML =
      `<li class="locations-empty">No buildings loaded.</li>`;
    return;
  }

  // Active sort mode; defaults to alphabetical (radio default in
  // map.html).
  const byDept = !!(el.locSortDept && el.locSortDept.checked);

  const items = Array.from(seen.values())
                     .sort((a, b) => a.name.localeCompare(b.name));

  // Shared row template for both sort modes.
  const rowHTML = (it) => {
    const cat = getCategory(it.name);
    return `
      <li class="location-row" role="option"
          data-name="${it.name.toLowerCase()}">
        <div>
          <div class="location-name">${it.name}</div>
          <div class="location-cat">${cat}</div>
        </div>
        <span class="location-chev">›</span>
      </li>
    `;
  };

  let html;

  if (!byDept) {
    html = items.map(rowHTML).join("");
  } else {

    const groups = new Map();
    const ensure = (g) => {
      if (!groups.has(g)) groups.set(g, []);
      return groups.get(g);
    };

    items.forEach((it) => {
      const depts = getDepartments(it.name);
      if (!depts.length) {
        ensure("Other").push(it);
      } else {
        depts.forEach((d) => ensure(d).push(it));
      }
    });

    const groupNames = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Other") return  1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    html = groupNames.map((g) => {
      const headerHTML =
        `<li class="locations-group-h" role="presentation">` +
        `${g.toUpperCase()}</li>`;
      const rows = groups.get(g)
                         .sort((a, b) => a.name.localeCompare(b.name))
                         .map(rowHTML).join("");
      return headerHTML + rows;
    }).join("");
  }

  el.allLocationsList.innerHTML = html;

  el.allLocationsList.querySelectorAll(".location-row").forEach((row) => {
    row.addEventListener("click", () => {
      const name = row.dataset.name;
      const item = items.find(
        (i) => i.name.toLowerCase() === name
      );
      if (!item) return;

      closeMobileLocations({ silent: true });

      selectFeature(item.layer, "building", { focus: true });
    });
  });
}

/* Re-render the All list when the sort radio changes. */
if (el.locSortAlpha) {
  el.locSortAlpha.addEventListener("change", renderAllLocationsList);
}
if (el.locSortDept) {
  el.locSortDept.addEventListener("change", renderAllLocationsList);
}

/* -----------------------------------------------------------
   Mobile locations drawer
   -----------------------------------------------------------
   Slides in from the left over the map; a backdrop dims the rest and
   tap-closes it. Drawer and details sheet are mutually exclusive.
   ----------------------------------------------------------- */
   function openMobileLocations() {
     drawerOpen = true;
     el.locations.classList.add("is-open");
     el.locationsBackdrop.classList.add("is-open");
     el.shell.classList.add("drawer-open");

     // Clear the details selection only in map mode. In street view the
     // panel may still be flagged open in the background, and clearing
     // the selection there would also close the street view — the user
     // just wants the menu on top of the current view.
     if (!streetViewActive && el.details.classList.contains("is-open")) {
       clearSelection();
     }

     scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
   }

function closeMobileLocations(opts = {}) {
  // On desktop the list is permanent; nothing to do.
  if (!isMobile() && !opts.force) {

    return;
  }
  drawerOpen = false;
  el.locations.classList.remove("is-open");
  el.locationsBackdrop.classList.remove("is-open");
  el.shell.classList.remove("drawer-open");

  scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
}

el.locationsToggle.addEventListener("click", () => {
  if (drawerOpen) closeMobileLocations();
  else openMobileLocations();
});
el.locationsClose.addEventListener("click", () => closeMobileLocations());
el.locationsBackdrop.addEventListener("click", () => closeMobileLocations());

let dragging  = false;
let dragStartY = 0;
let dragCurrY  = 0;
let dragStartMode = "half";

/* -----------------------------------------------------------
   Mobile details drag
   -----------------------------------------------------------
   The bottom sheet has two snapped states ("half", "full") plus a
   transient dragging state with a live transform. On release, drag
   direction and distance decide which state to snap to.
   ----------------------------------------------------------- */
function onDetailsPointerDown(e) {
  if (!isMobile()) return;
  if (detailsMode !== "half" && detailsMode !== "full") return;

  dragging = true;
  dragStartY = e.clientY;
  dragCurrY  = e.clientY;
  dragStartMode = detailsMode;

  el.details.classList.add("is-dragging");
  try { el.detailsHandle.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
}

function onDetailsPointerMove(e) {
  if (!dragging || !isMobile()) return;
  dragCurrY = e.clientY;
  const delta = dragCurrY - dragStartY;

  // Only allow the meaningful direction per starting state: from
  // "full" pull down only; from "half" pull up (capped preview) or
  // pull down to dismiss.
  if (dragStartMode === "full") {
    el.details.style.transform = `translateY(${Math.max(0, delta)}px)`;
  } else if (dragStartMode === "half") {

    el.details.style.transform = `translateY(${Math.max(-140, delta)}px)`;
  }
}

function onDetailsPointerUp() {
  if (!dragging || !isMobile()) return;
  dragging = false;
  el.details.classList.remove("is-dragging");
  el.details.style.transform = "";

  const delta = dragCurrY - dragStartY;
  // Pixels of drag before committing to a state change.
  const THRESH = 40;

  if (dragStartMode === "half") {
    if (delta < -THRESH) {
      setDetailsMode("full");
    } else if (delta > THRESH) {

      // Pulled down from half — dismiss entirely.
      clearSelection();
    } else {
      setDetailsMode("half");
    }
  } else if (dragStartMode === "full") {
    if (delta > THRESH) {
      setDetailsMode("half");
    } else {
      setDetailsMode("full");
    }
  }
}

el.detailsHandle.addEventListener("pointerdown", onDetailsPointerDown);
window.addEventListener("pointermove", onDetailsPointerMove);
window.addEventListener("pointerup",   onDetailsPointerUp);
window.addEventListener("pointercancel", onDetailsPointerUp);

/* Reset panel state when crossing the mobile/desktop breakpoint so the
   right CSS rules win. */
function handleViewportChange() {
  if (!isMobile()) {

    drawerOpen = false;
    el.locations.classList.remove("is-open");
    el.locationsBackdrop.classList.remove("is-open");
    el.shell.classList.remove("drawer-open", "details-full");
    el.details.classList.remove("is-full", "is-hidden", "is-dragging");
    el.details.style.transform = "";
  } else {

    if (el.shell.classList.contains("has-details")) {
      setDetailsMode("half");
    }
  }

  scheduleMapRefresh({ delay: 80 });
}
mqMobile.addEventListener?.("change", handleViewportChange);

/* -----------------------------------------------------------
   Mobile search toggle
   -----------------------------------------------------------
   On desktop the search field is always visible and the SEARCH button
   just focuses it. On mobile the button slides the panel in; the "x"
   clears text when present, otherwise closes the panel.
   ----------------------------------------------------------- */
function updateSearchBtnState() {
  if (!el.searchBtn) return;
  const open = el.metabarSearch.classList.contains("is-open");
  el.searchBtn.classList.toggle("is-active", open);
  el.searchBtn.setAttribute("aria-expanded", String(open));
}

function openSearchPanel() {
  el.metabarSearch.classList.add("is-open");

  // Let the DOM settle before focusing (avoids iOS keyboard flash).
  requestAnimationFrame(() => el.searchInput && el.searchInput.focus());
  updateSearchBtnState();
}

function closeSearchPanel() {
  el.metabarSearch.classList.remove("is-open");
  el.searchInput.value = "";
  el.searchResults.hidden = true;
  el.searchResults.innerHTML = "";
  refreshSearchClear();
  updateSearchBtnState();
}

/* Clear button: hidden on desktop, visible on mobile. */
function refreshSearchClear() {
  if (!el.searchClear) return;

  if (isMobile()) {
    el.searchClear.hidden = false;
  } else {
    el.searchClear.hidden = true;
  }
}

if (el.searchBtn) {
  el.searchBtn.addEventListener("click", () => {
    if (isMobile()) {
      if (el.metabarSearch.classList.contains("is-open")) {
        closeSearchPanel();
      } else {
        openSearchPanel();
      }
    } else {

      el.searchInput.focus();
      el.searchInput.select();
    }
  });
}

if (el.searchClear) {
  el.searchClear.addEventListener("click", () => {
    // With text: clear it. Empty: close the panel (mobile only).
    if (el.searchInput.value) {

      el.searchInput.value = "";
      el.searchResults.hidden = true;
      el.searchResults.innerHTML = "";
      el.searchInput.focus();
    } else {

      if (isMobile()) {
        closeSearchPanel();
      }
    }
  });
}

// Keep clear-button visibility in sync with the viewport.
mqMobile.addEventListener?.("change", refreshSearchClear);
refreshSearchClear();

/* -----------------------------------------------------------
   Search
   -----------------------------------------------------------
   Two-pass filter: name matches rank above department matches, so
   "moss" surfaces Moss Hall before buildings whose department text
   happens to contain it. Department hits are recorded so the result
   row can show why it matched. Duplicates collapse by name — a name
   match beats a department match, and a tour feature beats a building
   when names collide.
   ----------------------------------------------------------- */
   function renderSearch(q) {
     const term = q.trim().toLowerCase();
     if (!term) { el.searchResults.hidden = true; el.searchResults.innerHTML = ""; return; }

     const filtered = [];
     for (const x of allFeatures) {
       const n = cleanName(x.props.name).toLowerCase();
       if (!n) continue;

       if (n.includes(term)) {
         filtered.push({ ...x, matchKind: "name", matchedDept: null });
         continue;
       }

       const depts = getDepartments(cleanName(x.props.name));
       const hit = depts.find((d) => d.toLowerCase().includes(term));
       if (hit) {
         filtered.push({ ...x, matchKind: "dept", matchedDept: hit });
       }
     }

     filtered.sort((a, b) => {
       if (a.matchKind === b.matchKind) return 0;
       return a.matchKind === "name" ? -1 : 1;
     });

     const byName = new Map();
     for (const m of filtered) {
       const key = cleanName(m.props.name).toLowerCase();
       const existing = byName.get(key);
       if (!existing) {
         byName.set(key, m);
         continue;
       }

       if (existing.matchKind === "dept" && m.matchKind === "name") {
         byName.set(key, m);
         continue;
       }

       if (existing.kind !== "tour" && m.kind === "tour" &&
           existing.matchKind === m.matchKind) {
         byName.set(key, m);
       }
     }

     const matches = Array.from(byName.values()).slice(0, 12);

     if (!matches.length) {
       el.searchResults.hidden = false;
       el.searchResults.innerHTML =
         `<div class="search-empty">No matches for "${q}".</div>`;
       return;
     }

     el.searchResults.hidden = false;
     el.searchResults.innerHTML = matches.map((m, i) => {

       // Department hits show the matched department as a subtitle.
       const subtitle = m.matchKind === "dept" && m.matchedDept
         ? `<div class="search-result-sub">${escapeHTML(m.matchedDept)}</div>`
         : "";
       return `
         <div class="search-result" data-i="${i}" role="option">
           <div class="search-result-main">
             <span>${cleanName(m.props.name)}</span>
             ${subtitle}
           </div>
           <span class="tag ${m.kind}">${m.kind}</span>
         </div>
       `;
     }).join("");

     el.searchResults.querySelectorAll(".search-result").forEach((node) => {
       node.addEventListener("click", () => {
         const m = matches[Number(node.dataset.i)];
         if (!m) return;
         selectFeature(m.layer, m.kind, { focus: true });
         el.searchInput.value = cleanName(m.props.name);
         el.searchResults.hidden = true;

         if (isMobile()) closeSearchPanel();
       });
     });
   }
