/**
 * Optional runtime configuration template.
 *
 * Copy this file to `config/runtime.js` and fill in what applies. That copy is
 * gitignored: the repository root is published, so a committed credential would
 * be publicly fetchable.
 *
 * Every value here is optional. Without it, SLiVR runs with its supported
 * fallbacks and says so in the session capability list, rather than failing.
 *
 * Load it before the application entry point:
 *   <script src="config/runtime.js"></script>
 */

window.SLIVR_RUNTIME = {
  /**
   * Key for the optional photorealistic 3D exterior context.
   *
   * Use a key created for this deployment and restricted by HTTP referrer to
   * the SLiVR path, not a key shared with another application. Without it the
   * aerial, imported-plan and blank-grid workspaces remain fully usable and
   * authored objects are unaffected.
   */
  googleMapsApiKey: "",
};
