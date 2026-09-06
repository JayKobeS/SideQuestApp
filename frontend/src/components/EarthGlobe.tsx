import { Asset } from 'expo-asset';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as THREE from 'three';

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

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

interface EarthGlobeProps {
  onRollTrigger?: (rollFn: (onFinish?: (item: LocationItem) => void) => LocationItem) => void;
  onResumeTrigger?: (resumeFn: () => void) => void;
}

export function EarthGlobe({ onRollTrigger, onResumeTrigger }: EarthGlobeProps) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const domElement = containerRef.current;
    if (!domElement) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const defaultCameraZ = 3.5;
    const zoomedCameraZ = 1.65;
    camera.position.z = defaultCameraZ;
    const defaultGlobeY = -0.05;
    const centeredGlobeY = 0.0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.cursor = 'grab';
    domElement.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    const backLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    backLight.position.set(-5, -2, -4);
    scene.add(backLight);

    const globeRadius = 1;
    const sphereGeo = new THREE.SphereGeometry(globeRadius, 256, 256);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.05,
    });
    const earthMesh = new THREE.Mesh(sphereGeo, earthMat);
    earthMesh.position.y = defaultGlobeY;
    scene.add(earthMesh);

    const atmosGeo = new THREE.SphereGeometry(globeRadius * 1.025, 64, 64);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthMesh.add(atmosMesh);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const loadMainMap = async () => {
      try {
        const mapModule = require('../../assets/maps/ZIEMIA8192x4096.png');
        const asset = Asset.fromModule(mapModule);
        await asset.downloadAsync();
        
        textureLoader.load(asset.localUri || asset.uri, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          earthMat.map = tex;
          earthMat.needsUpdate = true;
        });
      } catch (error) {
        console.warn('Nie udało się załadować mapy:', error);
      }
    };
    loadMainMap();

    // 5. Zmodyfikowany Znacznik Misji (pochylony)
    const pinGroup = new THREE.Group();
    pinGroup.visible = false;
    earthMesh.add(pinGroup);

    // Grupa trzymająca fizyczny model pinezki, by pochylić ją niezależnie od pierścienia
    const pinModelGroup = new THREE.Group();
    pinModelGroup.rotation.z = Math.PI / 7; // Pochylenie o ok. 25 stopni
    pinGroup.add(pinModelGroup);

    // Cienka, metaliczna igła - czubek dotyka powierzchni (y=0),
    // szeroki koniec chowa się w środku kulki (y=needleLength)
    const needleLength = 0.09;
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.9,
      roughness: 0.3,
    });
    const needleGeo = new THREE.ConeGeometry(0.005, needleLength, 24);
    needleGeo.rotateX(Math.PI);
    needleGeo.translate(0, needleLength / 2, 0);
    const needle = new THREE.Mesh(needleGeo, needleMat);
    pinModelGroup.add(needle);

    // Duża, błyszcząca kulka na górze - "głowa" pinezki, tak jak na zdjęciu
    const ballRadius = 0.02;
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.3,
      roughness: 0.15,
      metalness: 0.05,
    });
    const pinHeadGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
    pinHeadGeo.translate(0, needleLength, 0);
    const pinHead = new THREE.Mesh(pinHeadGeo, pinMat);
    pinModelGroup.add(pinHead);

    const ringGeo = new THREE.RingGeometry(0.015, 0.025, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf87171,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const pulseRing = new THREE.Mesh(ringGeo, ringMat);
    pinGroup.add(pulseRing); // Pierścień zostaje w podstawie, leży płasko na Ziemi

    const updatePinPosition = (lat: number, lon: number) => {
      const pos = latLonToVector3(lat, lon, globeRadius * 1.002);
      pinGroup.position.copy(pos);

      const normal = pos.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
      pinGroup.setRotationFromQuaternion(quaternion);

      pulseRing.rotation.x = Math.PI / 2;
      pinGroup.visible = true;
    };

    const starGeo = new THREE.BufferGeometry();
    const starCount = 500;
    const starCoords = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starCoords[i] = (Math.random() - 0.5) * 45;
      starCoords[i + 1] = (Math.random() - 0.5) * 45;
      starCoords[i + 2] = -Math.random() * 25 - 2;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xc7d2fe, size: 0.035 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    let isSpinning = false;
    let isZoomingOut = false;
    let hasSelectedQuest = false;
    let spinStartTime = 0;
    let zoomOutStartTime = 0;
    const spinDuration = 5200;
    const zoomOutDuration = 1200;

    let startRot = { x: 0, y: 0 };
    let finalTargetRot = { x: 0, y: 0 };
    let startCamZ = defaultCameraZ;
    let startGlobeY = defaultGlobeY;

    let onSpinCompleteCallback: ((item: LocationItem) => void) | null = null;
    let currentlySelectedQuest: LocationItem | null = null;
    
    let queuedSpin: LocationItem | null = null;
    let queuedFinishCallback: ((item: LocationItem) => void) | null = null;

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const spinToLocation = (item: LocationItem, onFinish?: (item: LocationItem) => void) => {
      if (isSpinning) return;
      
      if (isZoomingOut) {
        queuedSpin = item;
        queuedFinishCallback = onFinish || null;
        return;
      }

      isSpinning = true;
      isZoomingOut = false;
      hasSelectedQuest = false;
      pinGroup.visible = false;
      spinStartTime = performance.now();
      onSpinCompleteCallback = onFinish || null;
      currentlySelectedQuest = item;

      startRot = {
        x: earthMesh.rotation.x,
        y: earthMesh.rotation.y,
      };
      startCamZ = camera.position.z;
      startGlobeY = earthMesh.position.y;

      const baseTargetY = -(item.lon + 90) * (Math.PI / 180);
      const targetX = item.lat * (Math.PI / 180);

      const extraSpins = 4 * Math.PI * 2;
      const currentY = earthMesh.rotation.y;

      let diffY = (currentY - baseTargetY) % (Math.PI * 2);
      if (diffY < 0) diffY += Math.PI * 2;

      finalTargetRot = {
        x: targetX,
        y: currentY - extraSpins - diffY,
      };
    };

    if (onRollTrigger) {
      onRollTrigger((onFinish) => {
        const randomIndex = Math.floor(Math.random() * QUEST_LOCATIONS.length);
        const selected = QUEST_LOCATIONS[randomIndex];
        spinToLocation(selected, onFinish);
        return selected;
      });
    }

    if (onResumeTrigger) {
      onResumeTrigger(() => {
        hasSelectedQuest = false;
        pinGroup.visible = false;
        isZoomingOut = true;
        zoomOutStartTime = performance.now();
        startCamZ = camera.position.z;
        startGlobeY = earthMesh.position.y;
      });
    }

    let isDragging = false;
    let prevPos = { x: 0, y: 0 };
    let initialPinchDistance = 0;
    const minZoom = 1.4;
    const maxZoom = 6.0;

    // Funkcja blokująca wszelkie interakcje użytkownika
    const isCameraLocked = () => isSpinning || isZoomingOut || hasSelectedQuest;

    const onStart = (x: number, y: number) => {
      if (isCameraLocked()) return;
      isDragging = true;
      prevPos = { x, y };
      renderer.domElement.style.cursor = 'grabbing';
    };

    const onMove = (x: number, y: number) => {
      if (!isDragging || isCameraLocked()) return;
      const dx = x - prevPos.x;
      const dy = y - prevPos.y;

      earthMesh.rotation.y += dx * 0.005;
      earthMesh.rotation.x += dy * 0.005;
      earthMesh.rotation.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, earthMesh.rotation.x));

      prevPos = { x, y };
    };

    const onEnd = () => {
      isDragging = false;
      initialPinchDistance = 0;
      renderer.domElement.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isCameraLocked()) return;
      const zoomFactor = e.deltaY * 0.0025;
      camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z + zoomFactor));
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      if (isCameraLocked()) return;
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isCameraLocked()) return;
      if (e.touches.length === 1 && isDragging) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && initialPinchDistance > 0) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = (initialPinchDistance - currentDistance) * 0.006;
        camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z + diff));
        initialPinchDistance = currentDistance;
      }
    }, { passive: true });
    window.addEventListener('touchend', onEnd);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    let animId: number;
    let pulseScale = 1;
    let pulseDir = 1;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (pinGroup.visible) {
        pulseScale += 0.015 * pulseDir;
        if (pulseScale > 1.8) pulseDir = -1;
        if (pulseScale < 1.0) pulseDir = 1;

        pulseRing.scale.set(pulseScale, pulseScale, 1);
        ringMat.opacity = 1.0 - (pulseScale - 1) * 0.9;
      }

      if (isSpinning) {
        const elapsed = performance.now() - spinStartTime;
        const progress = Math.min(elapsed / spinDuration, 1.0);
        const eased = easeOutQuart(progress);

        earthMesh.rotation.y = startRot.y + (finalTargetRot.y - startRot.y) * eased;
        earthMesh.rotation.x = startRot.x + (finalTargetRot.x - startRot.x) * eased;

        if (progress > 0.4) {
          const zoomProgress = (progress - 0.4) / 0.6;
          const zoomEased = easeInOutCubic(zoomProgress);
          camera.position.z = startCamZ + (zoomedCameraZ - startCamZ) * zoomEased;
          earthMesh.position.y = startGlobeY + (centeredGlobeY - startGlobeY) * zoomEased;
        }

        if (progress >= 1.0) {
          isSpinning = false;
          hasSelectedQuest = true;
          camera.position.z = zoomedCameraZ;
          earthMesh.position.y = centeredGlobeY;

          if (currentlySelectedQuest) {
            updatePinPosition(currentlySelectedQuest.lat, currentlySelectedQuest.lon);
          }

          if (onSpinCompleteCallback && currentlySelectedQuest) {
            onSpinCompleteCallback(currentlySelectedQuest);
          }
        }
      } else if (isZoomingOut) {
        const elapsed = performance.now() - zoomOutStartTime;
        const progress = Math.min(elapsed / zoomOutDuration, 1.0);
        const eased = easeInOutCubic(progress);

        camera.position.z = startCamZ + (defaultCameraZ - startCamZ) * eased;
        earthMesh.position.y = startGlobeY + (defaultGlobeY - startGlobeY) * eased;

        if (progress >= 1.0) {
          isZoomingOut = false;
          camera.position.z = defaultCameraZ;
          earthMesh.position.y = defaultGlobeY;
          
          if (queuedSpin) {
            spinToLocation(queuedSpin, queuedFinishCallback || undefined);
            queuedSpin = null;
            queuedFinishCallback = null;
          }
        }
      } else if (!isDragging && !hasSelectedQuest) {
        earthMesh.rotation.y += 0.0008;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
      canvas.removeEventListener('wheel', onWheel);

      if (domElement.contains(canvas)) {
        domElement.removeChild(canvas);
      }
      sphereGeo.dispose();
      earthMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      needleGeo.dispose();
      needleMat.dispose();
      pinHeadGeo.dispose();
      pinMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <View ref={containerRef} style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
    zIndex: 0,
  },
});