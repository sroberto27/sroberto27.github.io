Drop your QGIS XYZ tile render of the Mandeville / Fontainebleau
basemap here ({z}/{x}/{y}.jpg folders).

In QGIS: Processing > "Generate XYZ tiles (Directory)", zooms 12-17
(match config.js -> tiles.minZoom / maxNativeZoom), output into this
folder. Then paste the layer extent (EPSG:4326) into config.js ->
tiles.bounds and the canvas center into tiles.initialCenter.

Until tiles are present the map background is blank cream — the five
polygons, list, details cards, guided tour and Treedis street view
all still work.
