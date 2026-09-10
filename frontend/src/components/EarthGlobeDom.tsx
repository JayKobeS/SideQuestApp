'use dom';

import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from 'expo/dom';
import * as MapLibreModule from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Ref, useEffect, useRef } from 'react';
import { type LocationItem } from './globeData';

const maplibregl = ((MapLibreModule as any).default || MapLibreModule) as typeof import('maplibre-gl');
const DEFAULT_CENTER: [number, number] = [15, 20];
const FINAL_TARGET_ZOOM = 9.3;

function getDefaultZoom() {
  return window.innerHeight > window.innerWidth * 1.3 ? 1.55 : 2.2;
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

export interface EarthGlobeDomRef extends DOMImperativeFactory {
  roll: (...args: any[]) => void;
  locate: () => void;
  resume: () => void;
  zoom: (...args: any[]) => void;
}

interface EarthGlobeDomProps {
  ref: Ref<EarthGlobeDomRef>;
  onReady: () => Promise<void>;
  onError: () => Promise<void>;
  onRollFinished: (item: LocationItem) => Promise<void>;
  onResetFinished: () => Promise<void>;
  userLocation?: { latitude: number; longitude: number } | null;
  avatarLabel?: string;
  dom?: DOMProps;
}

function addGlobeStyles() {
  const style = document.createElement('style');
  style.textContent = `
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #020617; }
    * { box-sizing: border-box; }
    .sq-stars { position: fixed; inset: -28%; z-index: 0; overflow: hidden; pointer-events: none; background-color: #020617; background-image: radial-gradient(1px 1px at 7% 13%, rgba(255,255,255,.75) 50%, transparent 55%), radial-gradient(1.4px 1.4px at 19% 31%, rgba(186,230,253,.85) 50%, transparent 55%), radial-gradient(1px 1px at 31% 8%, rgba(255,255,255,.65) 50%, transparent 55%), radial-gradient(1px 1px at 44% 23%, rgba(255,255,255,.8) 50%, transparent 55%), radial-gradient(1.5px 1.5px at 56% 11%, rgba(186,230,253,.75) 50%, transparent 55%), radial-gradient(1px 1px at 69% 29%, rgba(255,255,255,.7) 50%, transparent 55%), radial-gradient(1px 1px at 84% 16%, rgba(255,255,255,.75) 50%, transparent 55%), radial-gradient(1px 1px at 93% 43%, rgba(186,230,253,.65) 50%, transparent 55%), radial-gradient(1px 1px at 12% 68%, rgba(255,255,255,.72) 50%, transparent 55%), radial-gradient(1.4px 1.4px at 77% 71%, rgba(255,255,255,.75) 50%, transparent 55%), radial-gradient(1px 1px at 39% 88%, rgba(186,230,253,.65) 50%, transparent 55%), radial-gradient(1px 1px at 91% 91%, rgba(255,255,255,.7) 50%, transparent 55%), radial-gradient(1px 1px at 4% 49%, rgba(255,255,255,.8) 50%, transparent 55%), radial-gradient(1.3px 1.3px at 16% 81%, rgba(186,230,253,.7) 50%, transparent 55%), radial-gradient(1px 1px at 27% 57%, rgba(255,255,255,.8) 50%, transparent 55%), radial-gradient(1.2px 1.2px at 36% 42%, rgba(255,255,255,.75) 50%, transparent 55%), radial-gradient(1px 1px at 48% 73%, rgba(186,230,253,.8) 50%, transparent 55%), radial-gradient(1.4px 1.4px at 61% 51%, rgba(255,255,255,.8) 50%, transparent 55%), radial-gradient(1px 1px at 73% 91%, rgba(255,255,255,.72) 50%, transparent 55%), radial-gradient(1.3px 1.3px at 87% 62%, rgba(186,230,253,.8) 50%, transparent 55%), radial-gradient(1px 1px at 97% 76%, rgba(255,255,255,.7) 50%, transparent 55%), radial-gradient(1px 1px at 9% 37%, rgba(255,255,255,.75) 50%, transparent 55%), radial-gradient(1px 1px at 22% 94%, rgba(186,230,253,.72) 50%, transparent 55%), radial-gradient(1.4px 1.4px at 34% 65%, rgba(255,255,255,.8) 50%, transparent 55%), radial-gradient(1px 1px at 42% 54%, rgba(255,255,255,.72) 50%, transparent 55%), radial-gradient(1.2px 1.2px at 53% 35%, rgba(186,230,253,.8) 50%, transparent 55%), radial-gradient(1px 1px at 65% 83%, rgba(255,255,255,.8) 50%, transparent 55%), radial-gradient(1px 1px at 76% 47%, rgba(255,255,255,.74) 50%, transparent 55%), radial-gradient(1.3px 1.3px at 82% 6%, rgba(186,230,253,.72) 50%, transparent 55%), radial-gradient(1px 1px at 95% 25%, rgba(255,255,255,.78) 50%, transparent 55%); animation: sq-star-rotation 180s linear infinite; transform-origin: center; }
    @keyframes sq-star-rotation { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .sq-globe { position: fixed; inset: 0; z-index: 1; background: transparent; touch-action: none; }
    .sq-attribution { position: fixed; right: 10px; bottom: 6px; z-index: 2; color: rgba(148,163,184,.58); font: 9px system-ui,sans-serif; pointer-events: none; }
    .sq-pin-anchor { position: relative; width: 0; height: 0; pointer-events: none; }
    .sq-pin-wrapper { position: absolute; bottom: 0; left: 0; transform: translate(-50%,0) rotate(22deg); transform-origin: bottom center; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,.6)); }
    .sq-pin-head { width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 30%,#fca5a5,#ef4444 60%,#7f1d1d 100%); box-shadow: 0 0 12px rgba(239,68,68,.95); border: 1.5px solid #fee2e2; }
    .sq-pin-needle { width: 3px; height: 38px; background: linear-gradient(180deg,#d1d5db 0%,#9ca3af 70%,#4b5563 100%); clip-path: polygon(30% 0%,70% 0%,100% 100%,0% 100%); margin-top: -3px; }
    .sq-pin-ring { position: absolute; bottom: -6px; left: 50%; width: 32px; height: 14px; transform: translate(-50%,0); border-radius: 50%; border: 2px solid #f87171; animation: sq-pulse 1.8s ease-out infinite; }
    @keyframes sq-pulse { from { transform: translate(-50%,0) scale(.4); opacity: 1; } to { transform: translate(-50%,0) scale(2); opacity: 0; } }
    .sq-user-location { width: 42px; height: 42px; padding: 3px; border-radius: 50%; background: rgba(56,189,248,.32); border: 2px solid rgba(186,230,253,.95); box-shadow: 0 0 0 7px rgba(56,189,248,.18), 0 0 18px rgba(56,189,248,.95); animation: sq-user-pulse 2.2s ease-out infinite; }
    .sq-user-avatar { width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg,#38bdf8,#2563eb); color: white; font: 800 12px system-ui,sans-serif; border: 1px solid white; }
    @keyframes sq-user-pulse { 0%,100% { box-shadow: 0 0 0 7px rgba(56,189,248,.18), 0 0 18px rgba(56,189,248,.95); } 50% { box-shadow: 0 0 0 13px rgba(56,189,248,.04), 0 0 24px rgba(56,189,248,.95); } }
    @media (prefers-reduced-motion: reduce) { .sq-stars, .sq-user-location, .sq-pin-ring { animation: none; } }
    .maplibregl-canvas { outline: none !important; background: transparent !important; }
  `;
  document.head.appendChild(style);
  return () => style.remove();
}

export default function EarthGlobeDom({ ref, onReady, onError, onRollFinished, onResetFinished, userLocation, avatarLabel }: EarthGlobeDomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<(item: LocationItem) => void>(() => undefined);
  const locateRef = useRef<() => void>(() => undefined);
  const resumeRef = useRef<() => void>(() => undefined);
  const zoomRef = useRef<(direction: string) => void>(() => undefined);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onRollFinishedRef = useRef(onRollFinished);
  const onResetFinishedRef = useRef(onResetFinished);
  const userLocationRef = useRef(userLocation);
  const avatarLabelRef = useRef(avatarLabel);
  const updateUserMarkerRef = useRef<() => void>(() => undefined);
  onReadyRef.current = onReady;
  onRollFinishedRef.current = onRollFinished;
  onResetFinishedRef.current = onResetFinished;
  userLocationRef.current = userLocation;
  avatarLabelRef.current = avatarLabel;

  useEffect(() => {
    updateUserMarkerRef.current();
  }, [userLocation?.latitude, userLocation?.longitude, avatarLabel]);

  useDOMImperativeHandle(ref, () => ({
    roll: (...args: any[]) => rollRef.current(args[0]),
    locate: () => locateRef.current(),
    resume: () => resumeRef.current(),
    zoom: (...args: any[]) => zoomRef.current(args[0] === 'out' ? 'out' : 'in'),
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const removeStyles = addGlobeStyles();
    const defaultZoom = getDefaultZoom();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: defaultZoom,
      minZoom: 1.15,
      maxZoom: 17,
      attributionControl: false,
      dragRotate: true,
      touchZoomRotate: true,
      renderWorldCopies: false,
      maxTileCacheSize: 300,
    });

    const fitVisibleMap = () => map.setPadding({ top: 118, bottom: 92, left: 0, right: 0 });
    fitVisibleMap();
    window.addEventListener('resize', fitVisibleMap);
    const markerElement = document.createElement('div');
    markerElement.className = 'sq-pin-anchor';
    markerElement.innerHTML = '<div class="sq-pin-ring"></div><div class="sq-pin-wrapper"><div class="sq-pin-head"></div><div class="sq-pin-needle"></div></div>';
    const marker = new maplibregl.Marker({ element: markerElement, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' });
    const userMarkerElement = document.createElement('div');
    userMarkerElement.className = 'sq-user-location';
    userMarkerElement.setAttribute('role', 'img');
    userMarkerElement.setAttribute('aria-label', 'Twoja lokalizacja — awatar');
    const userAvatarElement = document.createElement('div');
    userAvatarElement.className = 'sq-user-avatar';
    userMarkerElement.appendChild(userAvatarElement);
    const userMarker = new maplibregl.Marker({ element: userMarkerElement, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' });
    let isReady = false;
    let isBusy = false;
    let isWaitingForConfirmation = false;
    let animationFrame = 0;
    let hasFocusedUserLocation = false;

    const updateUserMarker = () => {
      const currentLocation = userLocationRef.current;
      const label = (avatarLabelRef.current || 'TY').trim().slice(0, 2).toUpperCase();
      userAvatarElement.textContent = label;
      if (!currentLocation) {
        userMarker.remove();
        return;
      }
      userMarker.setLngLat([currentLocation.longitude, currentLocation.latitude]).addTo(map);
      if (isReady && !hasFocusedUserLocation && !isBusy) {
        hasFocusedUserLocation = true;
        map.easeTo({ center: [currentLocation.longitude, currentLocation.latitude], zoom: Math.max(map.getZoom(), 3.2), duration: 900, essential: false });
      }
    };
    updateUserMarkerRef.current = updateUserMarker;

    const lockControls = () => {
      map.dragPan.disable(); map.dragRotate.disable(); map.scrollZoom.disable(); map.touchZoomRotate.disable(); map.doubleClickZoom.disable();
    };
    const unlockControls = () => {
      map.dragPan.enable(); map.dragRotate.enable(); map.scrollZoom.enable(); map.touchZoomRotate.enable(); map.doubleClickZoom.enable();
    };

    const loadingTimeout = setTimeout(() => { if (!isReady) void onErrorRef.current(); }, 12000);
    map.once('load', () => {
      clearTimeout(loadingTimeout);
      try { map.setProjection({ type: 'globe' }); } catch {}
      isReady = true;
      updateUserMarker();
      void onReadyRef.current();
    });

    locateRef.current = () => {
      const point = userLocationRef.current;
      if (point && isReady && !isBusy) map.flyTo({ center: [point.longitude, point.latitude], zoom: 12, duration: 1100 });
    };

    let motionTimeout: ReturnType<typeof setTimeout> | null = null;
    const finishMotion = (callback: () => void) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (motionTimeout) clearTimeout(motionTimeout);
        map.off('moveend', finish);
        callback();
      };
      map.once('moveend', finish);
      motionTimeout = setTimeout(finish, 3500);
    };
    rollRef.current = (item) => {
      if (!isReady || isBusy || isWaitingForConfirmation || !item) return;
      isBusy = true;
      marker.remove();
      lockControls();

      const complete = () => {
        marker.setLngLat([item.lon, item.lat]).addTo(map);
        isBusy = false;
        isWaitingForConfirmation = true;
        void onRollFinishedRef.current(item);
      };

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        map.jumpTo({ center: [item.lon, item.lat], zoom: FINAL_TARGET_ZOOM, pitch: 35, bearing: 0 });
        complete();
        return;
      }

      // Original SideQuest roll: return to the globe, spin three full turns,
      // then ease into the assigned destination.
      finishMotion(() => {
        const start = map.getCenter();
        const startZoom = map.getZoom();
        let longitudeDifference = (start.lng - item.lon) % 360;
        if (longitudeDifference < 0) longitudeDifference += 360;
        const targetLongitude = start.lng - 1080 - longitudeDifference;
        const startedAt = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - startedAt) / 4600, 1);
          const positionEase = 1 - Math.pow(1 - progress, 4);
          const zoomEase = progress * progress * progress;
          map.setCenter([
            start.lng + (targetLongitude - start.lng) * positionEase,
            start.lat + (item.lat - start.lat) * positionEase,
          ]);
          map.setZoom(startZoom + (FINAL_TARGET_ZOOM - startZoom) * zoomEase);
          map.setPitch(zoomEase * 45);
          if (progress < 1) animationFrame = requestAnimationFrame(animate);
          else complete();
        };
        animationFrame = requestAnimationFrame(animate);
      });
      map.flyTo({ center: DEFAULT_CENTER, zoom: defaultZoom, pitch: 0, bearing: 0, duration: 650, essential: false });
    };

    resumeRef.current = () => {
      if (!isReady || isBusy) return;
      isWaitingForConfirmation = false;
      isBusy = true;
      marker.remove();
      finishMotion(() => {
        isBusy = false;
        unlockControls();
        updateUserMarker();
        void onResetFinishedRef.current();
      });
      map.flyTo({ center: DEFAULT_CENTER, zoom: defaultZoom, pitch: 0, bearing: 0, duration: 1400, essential: false });
    };

    zoomRef.current = (direction) => {
      if (!isReady || isBusy || isWaitingForConfirmation) return;
      map.easeTo({ zoom: map.getZoom() + (direction === 'in' ? 1 : -1), duration: 300 });
    };

    return () => {
      window.removeEventListener('resize', fitVisibleMap);
      clearTimeout(loadingTimeout);
      if (motionTimeout) clearTimeout(motionTimeout);
      cancelAnimationFrame(animationFrame);
      rollRef.current = () => undefined;
      resumeRef.current = () => undefined;
      zoomRef.current = () => undefined;
      marker.remove();
      userMarker.remove();
      updateUserMarkerRef.current = () => undefined;
      locateRef.current = () => undefined;
      map.remove();
      removeStyles();
    };
  }, []);

  return <><div className="sq-stars" /><div ref={containerRef} className="sq-globe" /><div className="sq-attribution">Esri, Maxar, Earthstar Geographics</div></>;
}
