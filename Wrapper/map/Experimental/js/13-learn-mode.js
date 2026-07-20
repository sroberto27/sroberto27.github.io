/* === Learn mode ===
   The Explore/Learn pill in the header swaps which shell is visible.
   Learn shows a course catalog (list left, detail right) rendered from
   window.SCSU_DATA.courses. Self-contained by design: its only contact
   with the map module is exposing setAppMode(). If course data fails
   to load, the page degrades to an empty list with a message. */
(function initLearnMode() {
  const courses = (window.SCSU_DATA && window.SCSU_DATA.courses) || [];

  // Learn-mode DOM cache. None of these are required for Explore to
  // function; if markup is missing, everything below no-ops.
  const L = {
    shell:        document.getElementById("learnShell"),
    list:         document.getElementById("courseList"),
    count:        document.getElementById("coursesCount"),
    empty:        document.getElementById("courseEmpty"),
    body:         document.getElementById("courseBody"),
    actions:      document.getElementById("courseActions"),
    heroStamp:    document.getElementById("courseHeroStamp"),
    hero:      document.getElementById("courseHero"),
    code:         document.getElementById("courseCode"),
    credits:      document.getElementById("courseCredits"),
    updated:      document.getElementById("courseUpdated"),
    title:        document.getElementById("courseTitle"),
    lede:         document.getElementById("courseLede"),
    overview:     document.getElementById("courseOverview"),
    curriculum:   document.getElementById("courseCurriculum"),
    beginBtn:     document.getElementById("courseBeginBtn"),
    back:         document.getElementById("courseBack"),
    vr:           document.getElementById("courseVr"),
    vrHelp:       document.getElementById("courseVrHelp"),
    vrTooltip:    document.getElementById("courseVrTooltip"),
    vrNote:       document.getElementById("courseVrNote")
  };

  // No Learn shell in the DOM — still expose setAppMode so the mode
  // buttons don't error; it just toggles the body class.
  if (!L.shell) {
    window.setAppMode = function (mode) {
      document.body.classList.toggle("mode-learn", mode === "learn");
    };
    return;
  }

  /* UA-only headset check, kept local so Learn mode stays
     self-contained. Deliberately synchronous: the Begin Course handler
     must open the URL inside the user-gesture frame or popup blockers
     will kill it, so the async WebXR probe can't be awaited here. */
  function isQuestUA() {
    try {
      const ua = (navigator.userAgent || "").toString();
      return /OculusBrowser|Quest\s|Quest\)| VR |Mobile VR|Pico/i.test(ua);
    } catch (_) {
      return false;
    }
  }

  /* Pick the EON launch URL for the current device. Quest prefers
     vrUrl with desktopUrl as fallback; everything else gets desktopUrl.
     Returns null when the course has no EON target, which callers use
     to disable the button. */
  function pickEonUrl(course) {
    const eon = course && course.eon;
    if (!eon) return null;
    if (isQuestUA() && eon.vrUrl) return eon.vrUrl;
    return eon.desktopUrl || eon.vrUrl || null;
  }

  let activeCourseId = null;

  /* ---- Render: course list ---- */
  function renderCourseList() {
    if (!L.list) return;
    L.list.innerHTML = "";
    if (L.count) L.count.textContent = String(courses.length);

    if (!courses.length) {
      const empty = document.createElement("li");
      empty.className = "locations-empty";
      empty.textContent = "No courses available yet.";
      L.list.appendChild(empty);
      return;
    }

    courses.forEach((c) => {
      const li = document.createElement("li");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "course-row";
      btn.dataset.courseId = c.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", "false");

      const text = document.createElement("div");
      text.className = "course-row-text";
      const name = document.createElement("div");
      name.className = "course-row-name";
      name.textContent = c.title || "(untitled)";
      const code = document.createElement("div");
      code.className = "course-row-code";
      code.textContent = c.code || "";
      text.appendChild(name);
      text.appendChild(code);

      const chev = document.createElement("span");
      chev.className = "course-row-chev";
      chev.setAttribute("aria-hidden", "true");
      chev.textContent = "›";

      btn.appendChild(text);
      btn.appendChild(chev);
      btn.addEventListener("click", () => selectCourse(c.id));

      li.appendChild(btn);
      L.list.appendChild(li);
    });
  }

  /* ---- Render: course detail panel ---- */
  function renderCourseDetail(course) {
      // No selection — show the empty state, hide the article and the
      // action bar.
    if (!course) {

      if (L.empty)   L.empty.style.display = "";
      if (L.body)    L.body.hidden = true;
      if (L.actions) L.actions.hidden = true;
      return;
    }

    if (L.empty)   L.empty.style.display = "none";
    if (L.body)    L.body.hidden = false;
    if (L.actions) L.actions.hidden = false;

    if (L.code)     L.code.textContent     = course.code || "";
    if (L.credits)  L.credits.textContent  = course.credits || "";
    if (L.updated)  L.updated.textContent  = course.lastUpdated || "—";
    if (L.title)    L.title.textContent    = course.title || "";
    if (L.lede)     L.lede.textContent     = course.lede || "";
    if (L.overview) L.overview.textContent = course.overview || "";

    // Hero: bind real artwork when the course has an image; otherwise
    // keep the watermarked placeholder. Reset first so switching
    // courses doesn't leave a stale <img>; a 404 falls back to the
    // placeholder.
    if (L.hero) {

      L.hero.classList.remove("has-image");
      const oldImg = L.hero.querySelector("img");
      if (oldImg) oldImg.remove();

      if (course.image) {
        const img = document.createElement("img");
        img.src = course.image;
        img.alt = course.title || "";

        img.onerror = () => {
          L.hero.classList.remove("has-image");
          img.remove();
        };
        L.hero.appendChild(img);
        L.hero.classList.add("has-image");
      }
    }

    // Watermark is set even when an image is bound, so the placeholder
    // is correct if the image fails to load.
    if (L.heroStamp) {
      const stamp = (course.code || "").replace(/\s+/g, "");
      L.heroStamp.textContent = stamp;
    }

    if (L.curriculum) {
      L.curriculum.innerHTML = "";
      (course.curriculum || []).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        L.curriculum.appendChild(li);
      });
    }

    // VR-Enabled chip + tooltip. Shown when the course has an EON VR
    // URL or an explicit `immersive` block; tooltip text comes from
    // immersive.note with a generic fallback.
    const imm        = course.immersive;
    const hasEonVr   = !!(course.eon && course.eon.vrUrl);
    const isImmersive = hasEonVr || !!imm;
    if (L.vr) {
      if (isImmersive) {
        L.vr.hidden = false;
        if (L.vrNote) {
          L.vrNote.textContent =
            (imm && imm.note) ||
            "Sign in to EON Reality in your headset to enter the " +
            "immersive version of this course.";
        }
      } else {
        L.vr.hidden = true;
        hideVrTooltip();
      }
    }

    // Begin Course hands off to EON Reality; their login wall redirects
    // to the course after auth. No EON target — disabled with an
    // explanatory title.
    if (L.beginBtn) {
      const targetUrl = pickEonUrl(course);
      const canLaunch = !!targetUrl;

      L.beginBtn.disabled = !canLaunch;
      L.beginBtn.setAttribute("aria-disabled", canLaunch ? "false" : "true");
      L.beginBtn.title = canLaunch
        ? "Sign in to EON Reality to begin this course"
        : "Course launch coming soon";

      // Navigation must run synchronously inside the click handler;
      // any await/setTimeout in front would trip popup blockers.
      L.beginBtn.onclick = () => {
        if (!canLaunch) return;

        window.location.href = targetUrl;
      };
    }
  }

  /* ---- Selection ---- */
  function selectCourse(id) {
    const course = courses.find((c) => c.id === id);
    activeCourseId = course ? course.id : null;

    if (L.list) {
      L.list.querySelectorAll(".course-row").forEach((row) => {
        const isActive = row.dataset.courseId === activeCourseId;
        row.classList.toggle("is-active", isActive);
        row.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    renderCourseDetail(course);

    // Mobile: slide the detail pane in over the list.
    L.shell.classList.toggle("has-detail", !!course);

    // Move focus to the detail title for screen-reader users on small
    // screens; on desktop the list keeps focus so arrow-keying through
    // courses stays smooth.
    if (course && isMobile() && L.title) {
      L.title.setAttribute("tabindex", "-1");
      L.title.focus({ preventScroll: false });
    }
  }

  /* ---- VR tooltip ---- */
  function showVrTooltip() {
    if (!L.vrTooltip) return;
    L.vrTooltip.classList.add("is-open");
    L.vrTooltip.setAttribute("aria-hidden", "false");
    if (L.vrHelp) L.vrHelp.setAttribute("aria-expanded", "true");
  }
  function hideVrTooltip() {
    if (!L.vrTooltip) return;
    L.vrTooltip.classList.remove("is-open");
    L.vrTooltip.setAttribute("aria-hidden", "true");
    if (L.vrHelp) L.vrHelp.setAttribute("aria-expanded", "false");
  }

  if (L.vrHelp) {
    L.vrHelp.setAttribute("aria-expanded", "false");
    L.vrHelp.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = L.vrTooltip && L.vrTooltip.classList.contains("is-open");
      if (open) hideVrTooltip(); else showVrTooltip();
    });

    // Click-away and Escape both dismiss.
    document.addEventListener("click", (e) => {
      if (!L.vrTooltip || !L.vrTooltip.classList.contains("is-open")) return;
      if (e.target === L.vrHelp || L.vrTooltip.contains(e.target)) return;
      hideVrTooltip();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && L.vrTooltip &&
          L.vrTooltip.classList.contains("is-open")) {
        hideVrTooltip();
      }
    });
  }

  /* ---- Mobile back button — return to list view ---- */
  if (L.back) {
    L.back.addEventListener("click", () => {
      L.shell.classList.remove("has-detail");
      hideVrTooltip();
    });
  }

  /* ---- App-mode switcher (called by the .mode-btn handler) ----
     Entering Learn on desktop auto-selects the first course so the
     right pane isn't empty; mobile keeps the list view. Leaving Learn
     collapses any open detail and dismisses the tooltip. */
  window.setAppMode = function (mode) {
    const learn = mode === "learn";
    document.body.classList.toggle("mode-learn", learn);

    L.shell.setAttribute("aria-hidden", learn ? "false" : "true");

    if (learn) {

      if (!activeCourseId && !isMobile() && courses.length) {
        selectCourse(courses[0].id);
      }
    } else {

      L.shell.classList.remove("has-detail");
      hideVrTooltip();
    }
  };

  // Initial render: the list is built once at boot; the detail stays
  // empty until a course is picked.
  renderCourseList();
})();
