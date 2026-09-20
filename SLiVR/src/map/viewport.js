/** Tight inventory bounds, independent of the padded region planning envelope. */
export function locationBounds(locations) {
  const points = locations.map(location => location.position).filter(point =>
    Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite));
  if (!points.length) return null;
  return [
    [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))],
    [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))],
  ];
}

/** Reserve marker tips, the control rail and the visible imagery provenance. */
export function inventoryFitOptions(width, height, plateHeight = 0) {
  const horizontal = Math.min(56, Math.max(20, width * .08));
  return {
    padding: {
      left: horizontal,
      right: Math.min(80, width * .23),
      top: Math.min(64, height * .18),
      bottom: Math.min(Math.max(80, plateHeight + 96), height * .35),
    },
    maxZoom: 18,
    duration: 0,
  };
}
