/**
 * Backgrounds for the 3D workspace, and the optional photorealistic tiles.
 *
 * The 3D exterior context is optional in the strongest sense: it needs a
 * credential this project does not ship, it is a paid third-party service, and
 * it can be slow, refused or withdrawn. Authored objects are never stored in
 * its frame of reference and never depend on it, so every failure here reduces
 * to choosing a different background.
 *
 * Four backgrounds, in descending order of context and ascending order of
 * certainty: photorealistic tiles, aerial imagery, an imported plan, a blank
 * grid. The blank grid always works, which is what makes the rest optional.
 *
 * No credential is read from anywhere but the gitignored runtime configuration,
 * and no credential is ever written to an export, a research log or a URL the
 * application constructs for display.
 */

export const BACKGROUND_KINDS = Object.freeze(["google3d", "aerial", "plan", "grid"]);

export const TILES_STATES = Object.freeze({
  disabled: "disabled",
  absent: "absent",
  configured: "configured",
  denied: "denied",
  slow: "slow",
  unreachable: "unreachable",
  available: "available",
});

/** Default: the tiles have not been attempted. */
export function initialTilesStatus(runtimeConfig, optional3d) {
  if (optional3d?.enabled === false) {
    return { state: TILES_STATES.disabled, reason: "The optional 3D context is switched off in configuration." };
  }
  if (!runtimeConfig?.googleMapsApiKey) {
    return {
      state: TILES_STATES.absent,
      reason:
        "No credential is configured, so the photorealistic 3D context is unavailable. " +
        "Aerial, imported-plan and blank-grid workspaces are unaffected.",
    };
  }
  return { state: TILES_STATES.configured, reason: "A credential is configured but has not been used yet." };
}

/**
 * Which backgrounds may be offered, and why each is or is not available.
 *
 * Every entry carries a reason, so a missing option is explained rather than
 * silently absent from a menu.
 */
export function availableBackgrounds({ tilesStatus, imageryState, hasPlanAsset, webgl }) {
  const webglReady = webgl === true;
  return [
    {
      kind: "google3d",
      label: "Photorealistic 3D context",
      available: webglReady && tilesStatus.state === TILES_STATES.available,
      reason: !webglReady ? "This browser reports no WebGL support." : tilesStatus.reason,
    },
    {
      kind: "aerial",
      label: "Aerial imagery",
      available: imageryState === "active",
      reason:
        imageryState === "active"
          ? "Aerial imagery is rendering."
          : "No aerial imagery is currently available.",
    },
    {
      kind: "plan",
      label: "Imported floor plan",
      available: Boolean(hasPlanAsset),
      reason: hasPlanAsset ? "A plan has been imported." : "No plan has been imported for this scene.",
    },
    {
      kind: "grid",
      label: "Blank grid",
      available: true,
      reason: "Always available. Authored objects do not depend on any provider.",
    },
  ];
}

/** The best background that is actually available, never a failed one. */
export function chooseBackground(preferred, options) {
  const usable = options.filter((option) => option.available);
  return usable.find((option) => option.kind === preferred) ?? usable.at(-1) ?? null;
}

/**
 * Attempts the photorealistic tiles root document.
 *
 * Classifies rather than throws. Every outcome leaves the workspace usable,
 * and each one is distinguishable in the record: a denied key is a
 * configuration problem, a timeout is a service problem, and neither is the
 * same as having no key at all.
 *
 * @param {object} options
 * @param {string} options.rootTileset
 * @param {string} options.apiKey
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {{setTimeout: Function, clearTimeout: Function}} [options.timers]
 */
export async function probeTiles({
  rootTileset,
  apiKey,
  timeoutMs = 8000,
  fetchImpl = globalThis.fetch,
  timers = globalThis,
}) {
  if (!apiKey) {
    return {
      state: TILES_STATES.absent,
      reason: "No credential is configured, so no request was made.",
    };
  }
  if (typeof fetchImpl !== "function") {
    return { state: TILES_STATES.unreachable, reason: "This runtime cannot make the request." };
  }

  const controller = new AbortController();
  const timer = timers.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(`${rootTileset}?key=${encodeURIComponent(apiKey)}`, {
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - startedAt;

    if (response.status === 401 || response.status === 403) {
      return {
        state: TILES_STATES.denied,
        elapsedMs,
        reason:
          "The service refused the credential. Check that the key is enabled for 3D Tiles and that its " +
          "referrer restriction includes this address. Aerial, plan and grid workspaces are unaffected.",
      };
    }
    if (!response.ok) {
      return {
        state: TILES_STATES.unreachable,
        elapsedMs,
        reason: `The service answered ${response.status}. The 3D context is unavailable for now.`,
      };
    }
    return {
      state: TILES_STATES.available,
      elapsedMs,
      reason: "The tileset answered. Photorealistic 3D context is available.",
    };
  } catch (cause) {
    const elapsedMs = Date.now() - startedAt;
    if (cause?.name === "AbortError") {
      return {
        state: TILES_STATES.slow,
        elapsedMs,
        reason: `The service did not answer within ${timeoutMs} ms, so the 3D context was left off.`,
      };
    }
    return {
      state: TILES_STATES.unreachable,
      elapsedMs,
      reason: `The service could not be reached: ${cause?.message ?? cause}.`,
    };
  } finally {
    timers.clearTimeout(timer);
  }
}

/**
 * Removes a credential from any text that is about to be shown or stored.
 *
 * The status strings above never contain one, but a provider error message
 * might echo the request, and those reach the diagnostics record.
 */
export function redactCredentials(text) {
  if (typeof text !== "string") return text;
  return text.replace(/([?&](?:key|api[_-]?key|token)=)[^&\s"']+/gi, "$1REDACTED");
}
