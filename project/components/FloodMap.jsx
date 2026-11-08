'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';

export default function FloodMap({ records }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const fittedPoints = useRef('');
  const [error, setError] = useState('');

  useEffect(() => {
    let map;
    try {
      maplibregl.setWorkerUrl(`/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
      map = new maplibregl.Map({
        container: container.current,
        style: { version: 8, sources: { osm: {
          type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256, attribution: '© OpenStreetMap contributors',
        } }, layers: [{ id: 'basemap', type: 'raster', source: 'osm' }] },
        center: [-95.37, 29.76], zoom: 9,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl());
      map.on('error', event => setError(`Map error: ${event.error?.message || 'An unknown error occurred.'} Flood records remain available in the table.`));
    } catch (error) {
      setError(`Map could not start: ${error.message} Flood records remain available in the table.`);
    }
    return () => { map?.remove(); mapRef.current = null; fittedPoints.current = ''; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function update() {
      const data = { type: 'FeatureCollection', features: records.map(row => ({
        type: 'Feature', properties: { id: row.id },
        geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
      })) };
      const source = map.getSource('floods');
      if (source) source.setData(data);
      else {
        map.addSource('floods', { type: 'geojson', data });
        map.addLayer({ id: 'flood-points', type: 'circle', source: 'floods', paint: {
          'circle-radius': 5, 'circle-color': '#175a9c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1,
        } });
      }
      const signature = records.map(row => `${row.id}:${row.latitude}:${row.longitude}`).join('|');
      if (records.length && fittedPoints.current !== signature) {
        const bounds = new maplibregl.LngLatBounds();
        records.forEach(row => bounds.extend([row.longitude, row.latitude]));
        map.fitBounds(bounds, { padding: 35, maxZoom: 13, duration: 0 });
        fittedPoints.current = signature;
      }
    }
    if (map.isStyleLoaded()) update();
    else map.once('load', update);
    return () => map.off('load', update);
  }, [records]);

  return <section aria-label="Flood observation map">
    <div ref={container} className="flood-map" />
    {error && <p role="status">{error}</p>}
  </section>;
}
