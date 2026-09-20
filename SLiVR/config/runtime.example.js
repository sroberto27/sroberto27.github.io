/**
 * Optional runtime configuration template for alternate deployments.
 *
 * The GitHub Pages build loads deployment.js instead. See README.md for the
 * owner-approved public browser configuration. For an alternate deployment,
 * supply runtime.js in the artifact and change its script reference explicitly.
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
   * Use a key created for this deployment, restricted to the Map Tiles API
   * and authorized website referrers (see README.md). Without it the
   * aerial, imported-plan and blank-grid workspaces remain fully usable and
   * authored objects are unaffected.
   */
  googleMapsApiKey: "",
};
