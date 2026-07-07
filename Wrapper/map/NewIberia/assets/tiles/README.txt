Put your QGIS "Generate XYZ tiles (Directory)" output here so the
structure is assets/tiles/{z}/{x}/{y}.png  (e.g. assets/tiles/12/952/1687.png).
Render zooms 10-16 from the Iberia CarteBaseMap2025 raster with the
"areas" layer turned OFF, then make sure config.js -> tiles.minZoom/
maxZoom/maxNativeZoom and tiles.bounds match what you rendered.
Until tiles exist, the site still boots and shows the three polygons
on a blank background.
