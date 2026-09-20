/** ECEF to local ENU and separate draw/LOD cameras for streamed tiles. */
export function buildGoogleTilesGroupTransform(THREE, WGS84_ELLIPSOID, maplibregl, lng, lat) {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;

  const enuFrame = new THREE.Matrix4();
  WGS84_ELLIPSOID.getEastNorthUpFrame(latRad, lonRad, 0, enuFrame);
  const ecefToEnuRotation = new THREE.Matrix4().extractRotation(enuFrame).transpose();

  const anchorEcef = new THREE.Vector3();
  WGS84_ELLIPSOID.getCartographicToPosition(latRad, lonRad, 0, anchorEcef);
  const moveToOrigin = new THREE.Matrix4().makeTranslation(-anchorEcef.x, -anchorEcef.y, -anchorEcef.z);

  const groupMatrix = new THREE.Matrix4().multiplyMatrices(ecefToEnuRotation, moveToOrigin);

  const anchorMercator = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  const meterScale = anchorMercator.meterInMercatorCoordinateUnits();
  const localTransform = new THREE.Matrix4()
    .makeTranslation(anchorMercator.x, anchorMercator.y, anchorMercator.z)
    .scale(new THREE.Vector3(meterScale, -meterScale, meterScale));
  return { groupMatrix, localTransform, anchorMercator, meterScale };
}

export function updateTilesCameraProjection(mapInstance, tilesCamera) {
  const canvas = mapInstance.getCanvas();
  const width = canvas.clientWidth || canvas.width || 1;
  const height = canvas.clientHeight || canvas.height || 1;
  const t = mapInstance.transform;
  const fovDeg = (t && typeof t.fov === "number" && isFinite(t.fov) && t.fov > 0)
    ? t.fov
    : 36.87; // MapLibre's fixed default (_fov = 0.6435011087932844 rad)
  const aspect = width / height;

  if (tilesCamera.fov !== fovDeg || tilesCamera.aspect !== aspect) {
    tilesCamera.fov = fovDeg;
    tilesCamera.aspect = aspect;
    tilesCamera.updateProjectionMatrix();
  }
}

export function updateTilesCameraPose(maplibregl, mapInstance, tilesCamera, anchorMercator, meterScale, axes) {
  const t = mapInstance.transform;
  const pitchRad = (t.pitch * Math.PI) / 180;
  const bearingRad = (t.bearing * Math.PI) / 180;

  // Map center, as ENU meters relative to the anchor. Mercator Y grows
  // SOUTHWARD while ENU north grows northward, hence the negation —
  // the same sign flip localTransform applies for rendering.
  const centerMercator = maplibregl.MercatorCoordinate.fromLngLat(t.center, t.elevation || 0);
  const centerEast = (centerMercator.x - anchorMercator.x) / meterScale;
  const centerNorth = -(centerMercator.y - anchorMercator.y) / meterScale;
  const centerUp = (centerMercator.z - anchorMercator.z) / meterScale;

  const worldSize = 512 * Math.pow(2, mapInstance.getZoom());
  const pixelPerMeter = centerMercator.meterInMercatorCoordinateUnits() * worldSize;
  const distanceMeters = pixelPerMeter > 0 ? t.cameraToCenterDistance / pixelPerMeter : 0;

  const sinP = Math.sin(pitchRad), cosP = Math.cos(pitchRad);
  const sinB = Math.sin(bearingRad), cosB = Math.cos(bearingRad);

  axes.x.set(cosB, -sinB, 0);
  axes.y.set(cosP * sinB, cosP * cosB, sinP);
  axes.z.set(-sinB * sinP, -cosB * sinP, cosP);

  const cameraEast = centerEast + distanceMeters * axes.z.x;
  const cameraNorth = centerNorth + distanceMeters * axes.z.y;
  const cameraUp = centerUp + distanceMeters * axes.z.z;

  tilesCamera.matrix.makeBasis(axes.x, axes.y, axes.z);
  tilesCamera.matrix.setPosition(cameraEast, cameraNorth, cameraUp);
  tilesCamera.matrixWorldNeedsUpdate = true;
  // Camera.updateMatrixWorld() also refreshes matrixWorldInverse, which
  // is the half 3d-tiles-renderer actually reads.
  tilesCamera.updateMatrixWorld(true);

  return {
    centerEnuMeters: { east: centerEast, north: centerNorth, up: centerUp },
    cameraEnuMeters: { east: cameraEast, north: cameraNorth, up: cameraUp },
    cameraDistanceMeters: distanceMeters,
    cameraAltitudeMeters: cameraUp
  };
}

