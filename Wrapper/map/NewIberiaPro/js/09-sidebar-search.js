/* === SCSU app — Part 9: Sidebar, mobile drawer, search === */
/* Includes sections 13, 13b, 14, 14a, 14b, 15. */
/* -----------------------------------------------------------
   13. Locations sidebar (Figma-style list)
   ----------------------------------------------------------- */
function syncLocationsList() {
  const rows = el.locationsList.querySelectorAll(".location-row");
  rows.forEach((r) => {
    const name = r.dataset.name || "";
    const active = selectedLayer &&
                   cleanName(selectedLayer.feature.properties.name).toLowerCase() === name;
    r.classList.toggle("is-active", !!active);
  });

  // Also sync the All-tab list (added for the Featured/All redesign)
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

function renderLocationsList() {
  el.locationsCount.textContent = tourStops.length;
  const rows = [];

  /* Redesign: the "Recenter on Tour" row moved out of the list to
     the pinned #railRecenter row at the bottom of the rail (wired
     in js/14-redesign.js). The list holds only place cards now:
     70×50 photo thumb, serif name, one-line sub, chevron. Each
     card carries data-category so the filter chips can hide/show
     rows without re-rendering. */
  tourStops.forEach((stop, i) => {
    const name = cleanName(stop.feature.properties.name);
    const cat = getCategory(name);
    const img = getImage(name);
    const props = stop.feature.properties || {};
    const offCampus = !!props.off_campus;
    const distance = props.off_campus_distance || "";
    const offCampusBadge = offCampus && distance
      ? `<span class="location-offcampus-badge" title="This location is not on this map">📍 ${distance}</span>`
      : "";
    const rowClass = offCampus ? "location-row is-offcampus" : "location-row";
    const desc = getDescription(name) || "";
    const sub = [cat, desc.split(/[,.]/)[0]].filter(Boolean).join(" · ");
    const thumb = img
      ? `<span class="location-thumb"><img src="${escapeHTML(img)}" alt="" loading="lazy"
           onerror="this.remove()"></span>`
      : `<span class="location-thumb"></span>`;
    rows.push(`
      <li class="${rowClass}" role="option"
          data-name="${name.toLowerCase()}"
          data-category="${escapeHTML(cat || "")}">
        ${thumb}
        <div class="location-text">
          <div class="location-name">
            <span class="location-index">${i + 1}.</span>${name}
          </div>
          <div class="location-cat">${sub}</div>
          ${offCampusBadge}
        </div>
        <span class="location-chev">›</span>
      </li>
    `);
  });

  el.locationsList.innerHTML = rows.join("");

  el.locationsList.querySelectorAll(".location-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.dataset.all) {
        clearSelection();
        if (imageBounds) resetCampusView(true);
        // On mobile, close the drawer after action
        closeMobileLocations();
        return;
      }
      const name = row.dataset.name;
      const stop = tourStops.find(
        (s) => cleanName(s.feature.properties.name).toLowerCase() === name
      );
      if (!stop) return;

      const locationName = cleanName(stop.feature.properties.name);

      // Two paths depending on which "mode" the user is in
      // (street view vs. map) — unchanged from the original.
      closeMobileLocations({ silent: true });

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
        selectFeature(stop.layer, "tour", { focus: false });
        return;
      }

      selectFeature(stop.layer, "tour", { focus: true });
    });
  });

  // Let the redesign layer (chips, peek cards, counts) refresh.
  if (typeof window.__niOnListRendered === "function") {
    try { window.__niOnListRendered(); } catch (_) {}
  }
}

/* -----------------------------------------------------------
   13b. "All" tab — every building on the campus
   -----------------------------------------------------------
   Populates #allLocationsList from buildingsLayer (the full
   building polygon set). Clicking a row selects that feature
   on the map and opens the details panel, exactly like the
   Featured rows do for tour stops.
   ----------------------------------------------------------- */
function renderAllLocationsList() {
  if (!el.allLocationsList || !buildingsLayer) return;

  // Collect (name, layer) pairs from the building features. We
  // dedupe by lower-cased clean name so duplicate features don't
  // each get their own row.
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

  // Which sort mode is currently active? Defaults to alphabetical
  // — matches the radio's `checked` default in map.html and
  // mirrors the Figma reference where Alphabetical is the active
  // option on first paint.
  const byDept = !!(el.locSortDept && el.locSortDept.checked);

  // Alphabetical: a single flat list, A→Z by name. The Featured
  // tab is intentionally ordered by tour sequence; "All" reads
  // better as a reference index here.
  const items = Array.from(seen.values())
                     .sort((a, b) => a.name.localeCompare(b.name));

  // Shared row template — used by both sort modes.
  const rowHTML = (it) => {
    const cat = getCategory(it.name);
    const img = getImage(it.name);
    const thumb = img
      ? `<span class="location-thumb"><img src="${escapeHTML(img)}" alt="" loading="lazy"
           onerror="this.remove()"></span>`
      : `<span class="location-thumb"></span>`;
    return `
      <li class="location-row" role="option"
          data-name="${it.name.toLowerCase()}"
          data-category="${escapeHTML(cat || "")}">
        ${thumb}
        <div class="location-text">
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
    // Department mode: group each building under every
    // department it belongs to. A building with N departments
    // appears in N groups (e.g. Nance Hall under both
    // "Mathematics & Science" and "College of Agriculture") —
    // this matches user expectation when scanning by program.
    //
    // Buildings with NO departments configured are bucketed
    // under "OTHER" at the bottom so they remain reachable from
    // this view rather than disappearing entirely.
    const groups = new Map();           // groupName -> [items]
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

    // Sort group names alphabetically, then pin "Other" last so
    // department groups read in a predictable order.
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

      // Mobile: close the drawer after the user picks something.
      closeMobileLocations({ silent: true });

      // Same flow as the Featured rows — but kind:"building"
      // because these come from the buildings layer, not tours.
      selectFeature(item.layer, "building", { focus: true });
    });
  });
}

/* Re-render the All list when the user toggles the sort radio.
   Bound once at module load — the inputs may not exist on very
   old saved DOM but the optional-chaining guard keeps this
   harmless if so. */
if (el.locSortAlpha) {
  el.locSortAlpha.addEventListener("change", renderAllLocationsList);
}
if (el.locSortDept) {
  el.locSortDept.addEventListener("change", renderAllLocationsList);
}

/* -----------------------------------------------------------
   14. Mobile locations drawer
   -----------------------------------------------------------
   The drawer slides in from the left, covering ~82% of the
   shell width. The remaining sliver of map behind it is dimmed
   by a backdrop that also tap-closes the drawer.

   Drawer and details are mutually exclusive.
   ----------------------------------------------------------- */
   function openMobileLocations() {
     drawerOpen = true;
     el.locations.classList.add("is-open");
     el.locationsBackdrop.classList.add("is-open");
     el.shell.classList.add("drawer-open");

     // Mutually exclusive with the details bottom sheet, but only
     // when we're in map mode. When the user is in street view, the
     // details panel may still have `is-open` set in the background
     // even though it's not visible — clearing the selection there
     // would also close the street view, which is not what the user
     // intended by tapping the Locations pill. They just want the
     // menu open *on top of* the current view (map or street view).
     if (!streetViewActive && el.details.classList.contains("is-open")) {
       clearSelection();
     }

     scheduleMapRefresh({ recenterIfNeeded: false, delay: 260 });
   }

function closeMobileLocations(opts = {}) {
  if (!isMobile() && !opts.force) {
    // On desktop the list is permanent; nothing to do.
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

/* -----------------------------------------------------------
   14a. Mobile details drag/slide
   -----------------------------------------------------------
   Ported from drag.html. The bottom sheet has two "snapped"
   states, "half" and "full", plus a transient "dragging" state
   where JS writes a live transform on the element. On release,
   the direction & distance of the drag decide which state to
   snap back to.
   ----------------------------------------------------------- */
let dragging  = false;
let dragStartY = 0;
let dragCurrY  = 0;
let dragStartMode = "half";

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

  // We only let the user drag in the "meaningful" direction for the
  // starting state. From "full", you can only pull down (delta>0).
  // From "half", you can either pull up to expand or down to dismiss.
  if (dragStartMode === "full") {
    el.details.style.transform = `translateY(${Math.max(0, delta)}px)`;
  } else if (dragStartMode === "half") {
    // Allow pull-up by up to 140px preview, pull-down unlimited.
    el.details.style.transform = `translateY(${Math.max(-140, delta)}px)`;
  }
}

function onDetailsPointerUp() {
  if (!dragging || !isMobile()) return;
  dragging = false;
  el.details.classList.remove("is-dragging");
  el.details.style.transform = "";

  const delta = dragCurrY - dragStartY;
  const THRESH = 40; // px of drag before we commit to a state change

  if (dragStartMode === "half") {
    if (delta < -THRESH) {
      setDetailsMode("full");
    } else if (delta > THRESH) {
      // Pulled down from half → dismiss entirely.
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

/* Handle viewport changes. Switching from mobile → desktop (or vice
   versa) needs to reset panel state so the right CSS rules win. */
function handleViewportChange() {
  if (!isMobile()) {
    // On desktop: clear mobile-only state.
    drawerOpen = false;
    el.locations.classList.remove("is-open");
    el.locationsBackdrop.classList.remove("is-open");
    el.shell.classList.remove("drawer-open", "details-full");
    el.details.classList.remove("is-full", "is-hidden", "is-dragging");
    el.details.style.transform = "";
  } else {
    // On mobile: if details is open, restore the half state.
    if (el.shell.classList.contains("has-details")) {
      setDetailsMode("half");
    }
  }

  scheduleMapRefresh({ delay: 80 });
}
mqMobile.addEventListener?.("change", handleViewportChange);

/* -----------------------------------------------------------
   14b. Mobile search toggle
   ------------------------------------------------------------
   On desktop the search field lives permanently in the header,
   so the SEARCH button just focuses it. On mobile the search
   panel is hidden by default and the SEARCH button slides it
   in from under the header. The "x" button on the right of the
   field has two states:
     • if the input has text → clear the text
     • if empty              → close the whole panel
   ----------------------------------------------------------- */
function updateSearchBtnState() {
  if (!el.searchBtn) return;
  const open = el.metabarSearch.classList.contains("is-open");
  el.searchBtn.classList.toggle("is-active", open);
  el.searchBtn.setAttribute("aria-expanded", String(open));
}

function openSearchPanel() {
  el.metabarSearch.classList.add("is-open");
  // Let the DOM settle before focusing (avoids iOS keyboard flash)
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

function refreshSearchClear() {
  if (!el.searchClear) return;
  // Desktop: always hidden (the input behaves like a normal field).
  // Mobile : visible so the user can clear text or close the panel.
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
      // Desktop: just focus the field
      el.searchInput.focus();
      el.searchInput.select();
    }
  });
}

if (el.searchClear) {
  el.searchClear.addEventListener("click", () => {
    if (el.searchInput.value) {
      // First click with text → clear it
      el.searchInput.value = "";
      el.searchResults.hidden = true;
      el.searchResults.innerHTML = "";
      el.searchInput.focus();
    } else {
      // Second click with empty input → close the panel (mobile only)
      if (isMobile()) {
        closeSearchPanel();
      }
    }
  });
}

// Keep the clear-button visibility in sync with the viewport
mqMobile.addEventListener?.("change", refreshSearchClear);
refreshSearchClear();

/* -----------------------------------------------------------
   15. Search
   ----------------------------------------------------------- */
   function renderSearch(q) {
     const term = q.trim().toLowerCase();
     if (!term) { el.searchResults.hidden = true; el.searchResults.innerHTML = ""; return; }

     // Two-pass filter: name matches rank above department matches
     // (unchanged matching logic from the original implementation).
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

     const matches = Array.from(byName.values()).slice(0, 8);

     /* CATEGORIES group — categories whose name contains the term,
        with a place count. Clicking one applies the matching filter
        chip (handled by js/14-redesign.js when present). */
     const catCounts = new Map();
     tourStops.forEach((stop) => {
       const cat = getCategory(cleanName(stop.feature.properties.name));
       if (!cat) return;
       catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
     });
     const catMatches = Array.from(catCounts.entries())
       .filter(([cat]) => cat.toLowerCase().includes(term))
       .slice(0, 4);

     if (!matches.length && !catMatches.length) {
       el.searchResults.hidden = false;
       el.searchResults.innerHTML =
         `<div class="search-empty">No matches for "${escapeHTML(q)}".</div>`;
       return;
     }

     const pinSvg =
       `<svg class="search-result-pin" viewBox="0 0 24 24" fill="none" ` +
       `stroke="currentColor" stroke-width="2" aria-hidden="true">` +
       `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/>` +
       `<circle cx="12" cy="10" r="3"/></svg>`;
     const layersSvg =
       `<svg class="search-result-pin" viewBox="0 0 24 24" fill="none" ` +
       `stroke="currentColor" stroke-width="1.8" aria-hidden="true">` +
       `<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>`;

     let html = "";

     if (matches.length) {
       html += `<div class="search-group-h">PLACES</div>`;
       html += matches.map((m, i) => {
         const name = cleanName(m.props.name);
         const cat = getCategory(name);
         const subtitle = m.matchKind === "dept" && m.matchedDept
           ? `<div class="search-result-sub">${escapeHTML(m.matchedDept)}</div>`
           : (cat ? `<div class="search-result-sub">${escapeHTML(cat)}</div>` : "");
         return `
           <div class="search-result" data-i="${i}" role="option">
             ${pinSvg}
             <div class="search-result-main">
               <span>${escapeHTML(name)}</span>
               ${subtitle}
             </div>
           </div>
         `;
       }).join("");
     }

     if (catMatches.length) {
       html += `<div class="search-group-h">CATEGORIES</div>`;
       html += catMatches.map(([cat, count], i) => `
         <div class="search-result search-result-cat" data-cat="${escapeHTML(cat)}"
              role="option">
           ${layersSvg}
           <div class="search-result-main">
             <span>${escapeHTML(cat)} (${count} place${count === 1 ? "" : "s"})</span>
           </div>
         </div>
       `).join("");
     }

     html += `<div class="search-hint">Press Enter to open the first result</div>`;

     el.searchResults.hidden = false;
     el.searchResults.innerHTML = html;

     el.searchResults.querySelectorAll(".search-result[data-i]").forEach((node) => {
       node.addEventListener("click", () => {
         const m = matches[Number(node.dataset.i)];
         if (!m) return;
         selectFeature(m.layer, m.kind, { focus: true });
         el.searchInput.value = cleanName(m.props.name);
         el.searchResults.hidden = true;
         if (isMobile()) closeSearchPanel();
       });
     });

     el.searchResults.querySelectorAll(".search-result-cat").forEach((node) => {
       node.addEventListener("click", () => {
         const cat = node.dataset.cat || "";
         el.searchResults.hidden = true;
         el.searchInput.value = "";
         if (typeof window.__niApplyCategoryFilter === "function") {
           window.__niApplyCategoryFilter(cat);
         }
       });
     });
   }

/* Enter in the search field opens the first place result. */
if (el.searchInput) {
  el.searchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const first = el.searchResults &&
      el.searchResults.querySelector('.search-result[data-i]');
    if (first) { e.preventDefault(); first.click(); }
  });
}
