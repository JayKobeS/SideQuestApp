import * as MapLibreModule from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const maplibregl = ((MapLibreModule as any).default || MapLibreModule) as typeof import('maplibre-gl');

export interface LocationItem {
  id: string;
  title: string;
  country: string;
  lat: number;
  lon: number;
}

export const QUEST_LOCATIONS: LocationItem[] = [
  { id: '1', title: 'Tajemnica Wawelu', country: 'Polska', lat: 50.0647, lon: 19.945 },
  { id: '2', title: 'Sekret Wieży', country: 'Francja', lat: 48.8584, lon: 2.2945 },
  { id: '3', title: 'Neonowy Pościg', country: 'Japonia', lat: 35.6762, lon: 139.6503 },
  { id: '4', title: 'Złote Wybrzeże', country: 'USA', lat: 37.7749, lon: -122.4194 },
  { id: '5', title: 'Piramidalna Zagadka', country: 'Egipt', lat: 29.9792, lon: 31.1342 },
  { id: '6', title: 'Tajemnica Amazonii', country: 'Brazylia', lat: -3.4653, lon: -62.2159 },
  { id: '7', title: 'Operowa Nuta', country: 'Australia', lat: -33.8568, lon: 151.2153 },
];

interface EarthGlobeProps {
  onRollTrigger?: (rollFn: (onFinish?: (item: LocationItem) => void) => LocationItem) => void;
  onResumeTrigger?: (resumeFn: (onResetDone?: () => void) => void) => void;
  onZoomTrigger?: (zoomFn: (direction: 'in' | 'out') => void) => void;
}

const DEFAULT_CENTER: [number, number] = [15, 20];
const DEFAULT_ZOOM = 2.2;

// ==========================================
// ⚙️ KONFIGURACJA PRZYBLIŻENIA I PRĘDKOŚCI
// ==========================================
// Mnożnik przybliżenia docelowego:
// 1.0 = domyślne (zoom 6.0)
// 1.5 = widok ulic / dzielnic (zoom 9.0)
// 2.0 = bardzo blisko budynków (zoom 12.0)
const ZOOM_MULTIPLIER = 1.55; // mnoznik przyblizenia
const BASE_TARGET_ZOOM = 6.0;
const FINAL_TARGET_ZOOM = BASE_TARGET_ZOOM * ZOOM_MULTIPLIER;

// Prędkość obrotu Ziemi w spoczynku (mniejsza wartość = wolniejszy obrót)
const IDLE_ROTATION_SPEED = 0.035;

const SAT_WITH_BOUNDARIES_STYLE = {
  version: 8,
  sources: {
    'satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar',
    },
    'boundaries': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 19,
    },
    {
      id: 'boundaries-layer',
      type: 'raster',
      source: 'boundaries',
      minzoom: 0,
      maxzoom: 19,
      paint: {
        'raster-opacity': 0.85,
      },
    },
  ],
  projection: { type: 'globe' },
  sky: {
    'sky-color': '#020617',
    'horizon-color': '#0f172a',
    'fog-color': '#020617',
    'fog-ground-blend': 0.5,
  },
} as any;

function injectGlobeCustomStyles() {
  if (document.getElementById('sq-globe-styles')) return;
  const style = document.createElement('style');
  style.id = 'sq-globe-styles';
  style.textContent = `
    .sq-pin-anchor {
      position: relative;
      width: 0;
      height: 0;
      pointer-events: none;
    }
    .sq-pin-wrapper {
      position: absolute;
      bottom: 0;
      left: 0;
      transform: translate(-50%, 0) rotate(22deg);
      transform-origin: bottom center;
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));
    }
    .sq-pin-head {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #fca5a5, #ef4444 60%, #7f1d1d 100%);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.95);
      border: 1.5px solid #fee2e2;
    }
    .sq-pin-needle {
      width: 3px;
      height: 38px;
      background: linear-gradient(180deg, #d1d5db 0%, #9ca3af 70%, #4b5563 100%);
      clip-path: polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%);
      margin-top: -3px;
    }
    .sq-pin-ring {
      position: absolute;
      bottom: -6px;
      left: 50%;
      width: 32px;
      height: 14px;
      transform: translate(-50%, 0);
      border-radius: 50%;
      border: 2px solid #f87171;
      animation: sq-pulse 1.8s ease-out infinite;
    }
    @keyframes sq-pulse {
      0% { transform: translate(-50%, 0) scale(0.4); opacity: 1; }
      100% { transform: translate(-50%, 0) scale(2.0); opacity: 0; }
    }
    .maplibregl-canvas { outline: none !important; }
  `;
  document.head.appendChild(style);
}

export function EarthGlobe({ onRollTrigger, onResumeTrigger, onZoomTrigger}: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    injectGlobeCustomStyles();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SAT_WITH_BOUNDARIES_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 1.5, // Blokuje nadmierne oddalenie Ziemi
      maxZoom: 17,  // Blokuje wejście w szare kafelki (brak danych)
      attributionControl: false,
      dragRotate: true,
      touchZoomRotate: true,
      renderWorldCopies: false,
      maxTileCacheSize: 300,
    });

    map.on('load', () => {
      if (typeof (map as any).setProjection === 'function') {
        try {
          (map as any).setProjection({ type: 'globe' });
        } catch {}
      }
    });

    // 1. PRZYWRÓCONY KOD TWORZĄCY HTML PINEZKI
    const markerEl = document.createElement('div');
    markerEl.className = 'sq-pin-anchor';
    markerEl.innerHTML = `
      <div class="sq-pin-ring"></div>
      <div class="sq-pin-wrapper">
        <div class="sq-pin-head"></div>
        <div class="sq-pin-needle"></div>
      </div>
    `;

    // Konfiguracja pinezki ze stałym kątem
    const marker = new maplibregl.Marker({ 
      element: markerEl, 
      anchor: 'bottom',
      pitchAlignment: 'viewport',    // ignoruje pochylenie mapy (pitch)
      rotationAlignment: 'viewport'  // ignoruje rotację mapy (bearing)
    });

    let isBusy = false;
    let isWaitingForOk = false;
    let animFrameId: number;

    const lockControls = () => {
      map.dragPan.disable();
      map.dragRotate.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
    };

    const unlockControls = () => {
      map.dragPan.enable();
      map.dragRotate.enable();
      map.scrollZoom.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
    };

    // Spowolniony obrót tła
    const rotateGlobe = () => {
      if (!isBusy && !isWaitingForOk && !map.isMoving() && map.getZoom() <= 4) {
        const c = map.getCenter();
        map.setCenter([c.lng + IDLE_ROTATION_SPEED, c.lat]);
      }
      animFrameId = requestAnimationFrame(rotateGlobe);
    };
    animFrameId = requestAnimationFrame(rotateGlobe);

   // ==========================================
   // 🎲 ANIMACJA ROLLA (WIELOKROTNY OBRÓT + NAJAZD)
   // ==========================================
   const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
   const easeInCubic = (t: number) => t * t * t; 
 
   const spinToLocation = (item: LocationItem, onFinish?: (item: LocationItem) => void) => {
     if (isBusy || isWaitingForOk) return; 
     
     isBusy = true;
     isWaitingForOk = false;
     marker.remove();
     lockControls();
 
     // Wyrównaj kamerę do domyślnej pozycji przed kręceniem
     map.flyTo({
       center: DEFAULT_CENTER,
       zoom: DEFAULT_ZOOM,
       pitch: 0,
       bearing: 0,
       speed: 1.5,
       essential: true,
     });

     //Gdy powrót się zakończy, rozpocznij właściwy roll
     map.once('moveend', () => {
       const startCenter = map.getCenter();
       const startLng = startCenter.lng;
       const startLat = startCenter.lat;
       const startZoom = map.getZoom();
   
       const extraSpins = 360 * 3;
       let diffLng = (startLng - item.lon) % 360;
       if (diffLng < 0) diffLng += 360;
       const targetLng = startLng - extraSpins - diffLng;
   
       const rollDuration = 4600; 
       const startTime = performance.now();
   
       const runRollStep = (now: number) => {
         const elapsed = now - startTime;
         const progress = Math.min(elapsed / rollDuration, 1.0);
         
         const rollEased = easeOutQuart(progress);
   
         const currentLng = startLng + (targetLng - startLng) * rollEased;
         const currentLat = startLat + (item.lat - startLat) * rollEased;
   
         const zoomEased = easeInCubic(progress);
         
         const currentZoom = startZoom + (FINAL_TARGET_ZOOM - startZoom) * zoomEased;
         const currentPitch = zoomEased * 45; 
   
         map.setCenter([currentLng, currentLat]);
         map.setZoom(currentZoom);
         map.setPitch(currentPitch);
   
         if (progress < 1.0) {
           requestAnimationFrame(runRollStep);
         } else {
           marker.setLngLat([item.lon, item.lat]).addTo(map);
           isBusy = false;
           isWaitingForOk = true;
           onFinish?.(item);
         }
       };
   
       requestAnimationFrame(runRollStep);
     });
   };

    if (onRollTrigger) {
      onRollTrigger((onFinish) => {
        // Blokada zapobiegająca strzelaniu eventów z zewnątrz gdy aplikacja w locie
        if (isBusy || isWaitingForOk) return QUEST_LOCATIONS[0]; // Zwraca cokolwiek awaryjnie, funkcja i tak jest zablokowana wewnątrz
        
        const randomIndex = Math.floor(Math.random() * QUEST_LOCATIONS.length);
        const selected = QUEST_LOCATIONS[randomIndex];
        spinToLocation(selected, onFinish);
        return selected;
      });
    }

    if (onResumeTrigger) {
      onResumeTrigger((onResetDone) => {
        isWaitingForOk = false;
        isBusy = true; 
        marker.remove();

        map.flyTo({
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          pitch: 0,
          bearing: 0,
          speed: 0.55,
          curve: 1.25,
          essential: true,
        });

        map.once('moveend', () => {
          isBusy = false;
          unlockControls();
          onResetDone?.(); 
        });
      });
    }

    if (onZoomTrigger) {
      onZoomTrigger((direction) => {
        if (isBusy) return;
        
        const currentZoom = map.getZoom();
        map.easeTo({
          zoom: direction === 'in' ? currentZoom + 1 : currentZoom - 1,
          duration: 300,
        });
      });
    }

    return () => {
      cancelAnimationFrame(animFrameId);
      marker.remove();
      map.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View ref={containerRef as any} style={StyleSheet.absoluteFillObject} />
      <Text style={styles.attribution}>Esri, Maxar, Earthstar Geographics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
    zIndex: 0,
  },
  attribution: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    fontSize: 9,
    color: 'rgba(148, 163, 184, 0.5)',
    zIndex: 1,
  },
});