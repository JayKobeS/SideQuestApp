'use dom';

import type { DOMProps } from 'expo/dom';
import * as MapLibreModule from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

const maplibregl = ((MapLibreModule as any).default || MapLibreModule) as typeof import('maplibre-gl');

interface AdminPointPickerDomProps {
  valueLat: number | null;
  valueLon: number | null;
  onPointChange: (lat: number, lon: number) => Promise<void>;
  dom?: DOMProps;
}

const MAP_STYLE = {
  version: 8,
  sources: {
    satellite: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Esri, Maxar' },
    boundaries: { type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
  },
  layers: [
    { id: 'satellite-layer', type: 'raster', source: 'satellite', minzoom: 0, maxzoom: 19 },
    { id: 'boundaries-layer', type: 'raster', source: 'boundaries', minzoom: 0, maxzoom: 19, paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 } },
  ],
  projection: { type: 'globe' },
} as any;

export default function AdminPointPickerDom({ valueLat, valueLon, onPointChange }: AdminPointPickerDomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPointChangeRef = useRef(onPointChange);
  onPointChangeRef.current = onPointChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [15, 20],
      zoom: window.innerHeight > window.innerWidth * 1.3 ? 1.55 : 2.2,
      minZoom: 1.15,
      maxZoom: 17,
      attributionControl: false,
      dragRotate: true,
      touchZoomRotate: true,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    map.on('load', () => { try { map.setProjection({ type: 'globe' }); } catch {} });
    map.on('click', (event: any) => {
      const lat = Number(event.lngLat.lat.toFixed(6));
      const lon = Number(event.lngLat.lng.toFixed(6));
      markerRef.current?.remove();
      markerRef.current = new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([lon, lat]).addTo(map);
      void onPointChangeRef.current(lat, lon);
    });
    return () => { markerRef.current?.remove(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || valueLat === null || valueLon === null) return;
    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([valueLon, valueLat]).addTo(mapRef.current);
  }, [valueLat, valueLon]);

  return <><div ref={containerRef} className="sq-admin-globe" /><div className="sq-admin-hint">Dotknij mapy, aby wskazać punkt misji</div><style>{`html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#020617}.sq-admin-globe{position:fixed;inset:0;background:#020617;touch-action:none}.sq-admin-hint{position:fixed;z-index:2;left:12px;right:12px;bottom:12px;text-align:center;color:#e0f2fe;background:rgba(2,6,23,.78);border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:8px;font:700 12px system-ui,sans-serif;pointer-events:none}.maplibregl-canvas{outline:none!important}`}</style></>;
}
