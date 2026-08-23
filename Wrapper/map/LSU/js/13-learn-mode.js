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
  };
})();
