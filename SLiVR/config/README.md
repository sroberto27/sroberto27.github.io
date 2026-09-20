# Browser configuration

`deployment.js` is loaded before the application. On 2026-09-20 the owner
explicitly requested reuse of the existing reference-application Google Maps browser key on the
shared GitHub Pages origin and publication of the SLiVR fix. That browser key is
therefore included in this file; it is visible in the served JavaScript.

This is a specific exception to the previous requirement to supply an ignored
`runtime.js`. GitHub Pages publishing from a branch never received that ignored
file, which caused the deployed script's 404. Other credentials and private
configuration remain excluded. No reference-project file is modified.

The configuration enables the Google Photorealistic 3D Tiles integration, which
loads only after selecting 3D. Missing configuration, provider rejection and
loading failure leave the aerial map usable with an explicit status message.

The owner will manually verify the deployed build. A shared website origin does
not establish that the key's API restrictions, referrer restrictions, billing,
quota or Lafayette coverage permit the requests. No live request using the key
was made during this change.

Manual check: zoom to downtown street scale and select 3D. Expect loading,
then building geometry and Google Maps/data attribution. Rotate the view,
toggle 2D/3D, leave/re-enter Explore, and confirm the aerial map returns on
failure. Provider setup: https://developers.google.com/maps/documentation/tile/cloud-setup
