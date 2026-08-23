/* === LSU Death Valley Experience — Part 13: Learn tab (placeholder) === */
/* ===========================================================
   LEARN TAB — "coming soon" placeholder
   -----------------------------------------------------------
   NewIberiaPro's Learn mode was a browsable course catalog
   (list + curriculum detail, EON Reality launch links). LSU's
   Learn tab has no such catalog yet — it's a placeholder for
   future content (stats, the Before/During/After journey, the
   avatar-guide explanation). This file only wires the Explore/
   Learn toggle to show/hide that placeholder panel; all of the
   course-list/detail/EON logic from NewIberiaPro is dropped.
   =========================================================== */
(function initLearnMode() {
  const shell = document.getElementById("learnShell");

  window.setAppMode = function (mode) {
    const learn = mode === "learn";
    document.body.classList.toggle("mode-learn", learn);
    if (shell) shell.setAttribute("aria-hidden", learn ? "false" : "true");

    // Keep the Explore/Learn pill in sync even when the mode change came
    // from somewhere other than the pill itself (e.g. #learnBackBtn
    // below) — otherwise the pill would still read "Learn" after
    // returning to Explore.
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
  };

  /* Learn mode hides .rail (css/11-learn-mode.css), and the
     Explore/Learn pill lives inside it — so this button is the only
     way back to the tour once Learn is open. */
  const backBtn = document.getElementById("learnBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => window.setAppMode("explore"));
  }
})();
