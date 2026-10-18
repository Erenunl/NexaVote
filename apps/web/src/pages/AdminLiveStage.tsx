import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Camera, Check, Eye, Gauge, Lightbulb, Maximize2, Minimize2,
  MonitorPlay, Pause, Play, RotateCcw, Sparkles, Upload, Volume2, VolumeX,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { api } from '../lib/api';

const MODEL_URL = `${import.meta.env.BASE_URL}models/nexavision-aurora-r03.glb`;
const INTRO_SECONDS = 14;

export type Quality = 'low' | 'medium' | 'high';
export type ShowState = 'blackout' | 'opening' | 'live';
export type CameraPreset = 'overview' | 'diagonal' | 'jury';

export type StageControls = {
  mainColor: string;
  accentColor: string;
  master: number;
  frontEnabled: boolean;
  frontLevel: number;
  spotsEnabled: boolean;
  spotsLevel: number;
  floorEnabled: boolean;
  floorLevel: number;
  juryEnabled: boolean;
  juryLevel: number;
  edgesEnabled: boolean;
  edgesLevel: number;
  spotMotion: boolean;
  spotSpeed: number;
  leafEnabled: boolean;
  leafLevel: number;
  leafSpeed: number;
  leafFill: boolean;
  hazeEnabled: boolean;
  hazeDensity: number;
  screenEnabled: boolean;
};

type IntroChannels = {
  environment: number;
  front: number;
  spots: number;
  floor: number;
  jury: number;
  edges: number;
  leaf: number;
  screen: number;
};

const cameraPresets: Record<CameraPreset, { position: THREE.Vector3Tuple; target: THREE.Vector3Tuple; fov: number; label: string }> = {
  overview: { position: [0, 29, 70], target: [0, 10, 4], fov: 49, label: 'Genel görünüş' },
  diagonal: { position: [36, 25, 50], target: [0, 10, 3], fov: 48, label: 'Çapraz görünüş' },
  jury: { position: [27, 16, 43], target: [8, 4, 12], fov: 42, label: 'Jüri yakın' },
};

const palettes = {
  blue: { main: '#2f7dff', accent: '#9fd8ff', label: 'Buz mavisi' },
  gold: { main: '#ff7b22', accent: '#ffc04c', label: 'Altın' },
  nexa: { main: '#7236ff', accent: '#ff3f91', label: 'Mor / pembe' },
};

export const defaultControls: StageControls = {
  mainColor: '#2f7dff',
  accentColor: '#ff7b22',
  master: 1.12,
  frontEnabled: true,
  frontLevel: 0.85,
  spotsEnabled: true,
  spotsLevel: 0.82,
  floorEnabled: true,
  floorLevel: 0.78,
  juryEnabled: true,
  juryLevel: 0.72,
  edgesEnabled: true,
  edgesLevel: 0.9,
  spotMotion: true,
  spotSpeed: 0.6,
  leafEnabled: true,
  leafLevel: 0.85,
  leafSpeed: 0.6,
  leafFill: false,
  hazeEnabled: true,
  hazeDensity: 0.42,
  screenEnabled: true,
};

export type LiveStageBroadcastState = {
  controls: StageControls;
  showState: ShowState;
  introStartedAt: number | null;
  cameraPreset: CameraPreset;
  cameraSeconds: number;
  quality: Quality;
  reducedMotion: boolean;
};

export const defaultBroadcastState: LiveStageBroadcastState = {
  controls: defaultControls,
  showState: 'blackout',
  introStartedAt: null,
  cameraPreset: 'overview',
  cameraSeconds: 2.4,
  quality: 'medium',
  reducedMotion: false,
};

export function normalizeLiveStageState(value: unknown): LiveStageBroadcastState {
  if (!value || typeof value !== 'object') return { ...defaultBroadcastState, controls: { ...defaultControls } };
  const candidate = value as Partial<LiveStageBroadcastState>;
  const showState = candidate.showState && ['blackout', 'opening', 'live'].includes(candidate.showState) ? candidate.showState : 'blackout';
  const cameraPreset = candidate.cameraPreset && ['overview', 'diagonal', 'jury'].includes(candidate.cameraPreset) ? candidate.cameraPreset : 'overview';
  const quality = candidate.quality && ['low', 'medium', 'high'].includes(candidate.quality) ? candidate.quality : 'medium';
  return {
    controls: { ...defaultControls, ...(candidate.controls ?? {}) },
    showState,
    introStartedAt: typeof candidate.introStartedAt === 'number' ? candidate.introStartedAt : null,
    cameraPreset,
    cameraSeconds: typeof candidate.cameraSeconds === 'number' ? THREE.MathUtils.clamp(candidate.cameraSeconds, 0.5, 8) : 2.4,
    quality,
    reducedMotion: Boolean(candidate.reducedMotion),
  };
}

function quintic(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function ramp(time: number, start: number, end: number) {
  return quintic((time - start) / (end - start));
}

function introChannels(state: ShowState, introStartedAt: number | null, reducedMotion: boolean): IntroChannels {
  if (state === 'blackout') return { environment: 0, front: 0, spots: 0, floor: 0, jury: 0, edges: 0, leaf: 0, screen: 0 };
  if (state === 'live' || introStartedAt === null) return { environment: 1, front: 1, spots: 1, floor: 1, jury: 1, edges: 1, leaf: 1, screen: 1 };
  const time = Math.max(0, (Date.now() - introStartedAt) / 1000);
  const smoothSpots = ramp(time, 0.8, 5.2);
  const sparseCuts = reducedMotion || time > 5.2
    ? smoothSpots
    : Math.max(smoothSpots * 0.25, [1.05, 1.85, 2.7, 3.7, 4.55].some((cue) => Math.abs(time - cue) < 0.2) ? smoothSpots : 0.04);
  return {
    environment: ramp(time, 0.4, 13.5),
    front: ramp(time, 2.3, 7.8),
    spots: sparseCuts,
    edges: ramp(time, 4.4, 8.4),
    leaf: ramp(time, 5.5, 10.1),
    floor: ramp(time, 6.4, 11.5),
    jury: ramp(time, 7.6, 11.8),
    screen: ramp(time, 10.2, 13.8),
  };
}

function setEmissive(material: THREE.MeshStandardMaterial, color: string, intensity: number) {
  material.emissive.set(color);
  material.emissiveIntensity = intensity;
}

function LoadingOverlay() {
  const { active, progress, item } = useProgress();
  if (!active && progress >= 100) return null;
  return <div className="live-stage-loader"><div><Sparkles /><strong>Sahne hazırlanıyor</strong><span>{Math.round(progress)}%</span></div><div className="live-stage-progress"><i style={{ width: `${progress}%` }} /></div><small>{item ? '3D model ve materyaller yükleniyor' : 'Yükleme kuyruğu hazırlanıyor'}</small></div>;
}

function makeFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(800, 450, 40, 800, 450, 780);
    gradient.addColorStop(0, '#1bbf98');
    gradient.addColorStop(0.28, '#124bbd');
    gradient.addColorStop(0.56, '#6026bc');
    gradient.addColorStop(0.8, '#0b1830');
    gradient.addColorStop(1, '#02070c');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1600, 900);
    context.strokeStyle = 'rgba(174,255,227,.5)';
    context.lineWidth = 3;
    for (let radius = 110; radius < 600; radius += 95) {
      context.beginPath();
      context.arc(800, 450, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = '#effff9';
    context.textAlign = 'center';
    context.font = '900 92px Arial';
    context.fillText('NEXAVISION', 800, 430);
    context.fillStyle = '#a8ffdf';
    context.font = '700 30px Arial';
    context.letterSpacing = '12px';
    context.fillText('LIVE STAGE', 800, 495);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function StageModel({ controls, showState, introStartedAt, reducedMotion, videoElement, videoReady }: {
  controls: StageControls;
  showState: ShowState;
  introStartedAt: number | null;
  reducedMotion: boolean;
  videoElement: HTMLVideoElement | null;
  videoReady: boolean;
}) {
  const gltf = useGLTF(MODEL_URL, true) as unknown as { scene: THREE.Group };
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const fallbackTexture = useMemo(() => makeFallbackTexture(), []);
  const screenTexture = useMemo(() => {
    if (!videoElement || !videoReady) return fallbackTexture;
    const texture = new THREE.VideoTexture(videoElement);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }, [fallbackTexture, videoElement, videoReady]);

  const groups = useMemo(() => {
    const sharedMaterials = new Map<string, THREE.Material>();
    const mainEdges: THREE.MeshStandardMaterial[] = [];
    const accentEdges: THREE.MeshStandardMaterial[] = [];
    const sideLeds: THREE.MeshStandardMaterial[] = [];
    const leafLeds: Array<{ material: THREE.MeshStandardMaterial; phase: number }> = [];
    const leafFills: THREE.MeshStandardMaterial[] = [];
    const juryEdges: THREE.MeshStandardMaterial[] = [];
    const frontLenses: THREE.MeshStandardMaterial[] = [];
    const floorLenses: THREE.MeshStandardMaterial[] = [];
    const spotLenses: THREE.MeshStandardMaterial[] = [];
    const screens: THREE.Mesh[] = [];
    let leafIndex = 0;

    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const objectName = child.name.toLowerCase();
      const originals = Array.isArray(child.material) ? child.material : [child.material];
      const replacements = originals.map((original) => {
        const materialName = original.name.toLowerCase();
        let material: THREE.Material;
        if (materialName.includes('moving amber')) {
          material = original.clone();
        } else {
          material = sharedMaterials.get(original.uuid) ?? original.clone();
          sharedMaterials.set(original.uuid, material);
        }
        if (material instanceof THREE.MeshStandardMaterial) {
          material.toneMapped = true;
          if (materialName.includes('main luminous')) mainEdges.push(material);
          if (materialName.includes('accent luminous')) accentEdges.push(material);
          if (materialName.includes('side led')) sideLeds.push(material);
          if (materialName.includes('warm pearl contour')) juryEdges.push(material);
          if (materialName.includes('moving amber')) leafLeds.push({ material, phase: leafIndex++ * 0.52 });
          if (materialName.includes('wing backs') && objectName.includes('leaf')) leafFills.push(material);
          if (materialName.includes('startup lens | front')) frontLenses.push(material);
          if (materialName.includes('startup lens | floor')) floorLenses.push(material);
          if (materialName.includes('startup lens | spot')) spotLenses.push(material);
        }
        if (materialName.includes('main led')) screens.push(child);
        return material;
      });
      child.material = Array.isArray(child.material) ? replacements : replacements[0];
    });
    return { mainEdges, accentEdges, sideLeds, leafLeds, leafFills, juryEdges, frontLenses, floorLenses, spotLenses, screens };
  }, [model]);

  useEffect(() => {
    const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, color: '#ffffff', toneMapped: false });
    for (const mesh of groups.screens) mesh.material = screenMaterial;
    return () => screenMaterial.dispose();
  }, [groups.screens, screenTexture]);

  useEffect(() => () => {
    if (screenTexture !== fallbackTexture) screenTexture.dispose();
    fallbackTexture.dispose();
  }, [fallbackTexture, screenTexture]);

  useFrame(({ clock }) => {
    const channel = introChannels(showState, introStartedAt, reducedMotion);
    const master = controls.master;
    const main = new THREE.Color(controls.mainColor);
    const accent = new THREE.Color(controls.accentColor);
    const edgeLevel = controls.edgesEnabled ? controls.edgesLevel * channel.edges * master : 0;
    const frontLevel = controls.frontEnabled ? controls.frontLevel * channel.front * master : 0;
    const floorLevel = controls.floorEnabled ? controls.floorLevel * channel.floor * master : 0;
    const spotLevel = controls.spotsEnabled ? controls.spotsLevel * channel.spots * master : 0;
    const juryLevel = controls.juryEnabled ? controls.juryLevel * channel.jury * master : 0;
    groups.mainEdges.forEach((material) => setEmissive(material, controls.mainColor, edgeLevel * 4.2));
    groups.accentEdges.forEach((material) => setEmissive(material, controls.accentColor, edgeLevel * 4));
    groups.sideLeds.forEach((material) => setEmissive(material, main.clone().lerp(accent, 0.25).getStyle(), Math.min(2.1, edgeLevel * 1.6)));
    groups.juryEdges.forEach((material) => setEmissive(material, controls.accentColor, juryLevel * 3.2));
    groups.frontLenses.forEach((material) => setEmissive(material, controls.mainColor, frontLevel * 3));
    groups.floorLenses.forEach((material) => setEmissive(material, controls.mainColor, floorLevel * 3));
    groups.spotLenses.forEach((material) => setEmissive(material, controls.mainColor, spotLevel * 3.2));
    groups.leafFills.forEach((material) => {
      material.color.copy(controls.leafFill && showState !== 'blackout' ? main.clone().multiplyScalar(0.34) : new THREE.Color('#07102a'));
      material.metalness = 0.68;
      material.roughness = 0.32;
    });
    const leafBase = controls.leafEnabled ? controls.leafLevel * channel.leaf * master : 0;
    groups.leafLeds.forEach(({ material, phase }) => {
      const chase = controls.leafEnabled && leafBase > 0
        ? 0.24 + 0.76 * Math.pow(Math.max(0, Math.sin(clock.elapsedTime * controls.leafSpeed * 3.6 - phase)), 6)
        : 0;
      setEmissive(material, controls.accentColor, leafBase * chase * 6.2);
    });
    groups.screens.forEach((mesh) => {
      const material = mesh.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        const screenLevel = controls.screenEnabled ? channel.screen * master : 0;
        material.color.setScalar(screenLevel);
        material.visible = screenLevel > 0.004;
      }
    });
  });

  return <primitive object={model} />;
}

function StageLighting({ controls, showState, introStartedAt, reducedMotion, quality }: {
  controls: StageControls;
  showState: ShowState;
  introStartedAt: number | null;
  reducedMotion: boolean;
  quality: Quality;
}) {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.HemisphereLight>(null);
  const frontRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const spotRefs = useRef<THREE.SpotLight[]>([]);
  const floorRefs = useRef<THREE.PointLight[]>([]);
  const juryRefs = useRef<THREE.PointLight[]>([]);
  const fog = useMemo(() => new THREE.FogExp2('#02090c', 0), []);
  const spotPositions: THREE.Vector3Tuple[] = [[-22, 34, 1], [-8, 38, -2], [8, 38, -2], [22, 34, 1]];
  const floorPositions: THREE.Vector3Tuple[] = [[-24, 1, 7], [-12, 1, -1], [12, 1, -1], [24, 1, 7]];
  const juryPositions: THREE.Vector3Tuple[] = [[-22, 5, 20], [-8, 5, 24], [8, 5, 24], [22, 5, 20]];

  useEffect(() => {
    scene.fog = fog;
    return () => { if (scene.fog === fog) scene.fog = null; };
  }, [fog, scene]);

  useFrame(({ clock }) => {
    const channel = introChannels(showState, introStartedAt, reducedMotion);
    const master = controls.master;
    if (ambientRef.current) ambientRef.current.intensity = 0.1 + channel.environment * master * 0.78;
    if (frontRef.current) frontRef.current.intensity = controls.frontEnabled ? channel.front * controls.frontLevel * master * 3.8 : 0;
    if (fillRef.current) fillRef.current.intensity = channel.environment * master * 1.15;
    const spotIntensity = controls.spotsEnabled ? channel.spots * controls.spotsLevel * master : 0;
    spotRefs.current.forEach((light, index) => {
      const basePosition = spotPositions[index] ?? [0, 34, 0];
      light.intensity = spotIntensity * (quality === 'low' ? 260 : 420);
      light.color.set(index % 2 ? controls.accentColor : controls.mainColor);
      if (controls.spotMotion && !reducedMotion && showState !== 'blackout') {
        light.position.x = basePosition[0] + Math.sin(clock.elapsedTime * controls.spotSpeed + index * 1.6) * 7;
        light.target.position.set(Math.sin(clock.elapsedTime * controls.spotSpeed * 0.7 + index) * 9, 2, 4 + Math.cos(clock.elapsedTime * controls.spotSpeed + index) * 7);
        light.target.updateMatrixWorld();
      }
    });
    floorRefs.current.forEach((light, index) => {
      light.intensity = controls.floorEnabled ? channel.floor * controls.floorLevel * master * (quality === 'low' ? 34 : 54) : 0;
      light.color.set(index % 2 ? controls.accentColor : controls.mainColor);
    });
    juryRefs.current.forEach((light) => {
      light.intensity = controls.juryEnabled ? channel.jury * controls.juryLevel * master * (quality === 'low' ? 26 : 44) : 0;
      light.color.set(controls.accentColor);
    });
    fog.density = controls.hazeEnabled && showState !== 'blackout' ? controls.hazeDensity * channel.environment * 0.0014 : 0;
  });

  return <>
    <hemisphereLight ref={ambientRef} args={['#7fffd4', '#010305', 0]} />
    <directionalLight ref={frontRef} color={controls.mainColor} position={[0, 24, 36]} intensity={0} />
    <directionalLight ref={fillRef} color="#c8fff0" position={[-30, 20, -18]} intensity={0} />
    {spotPositions.map((position, index) => <spotLight key={`spot-${index}`} ref={(light) => { if (light) spotRefs.current[index] = light; }} position={position} angle={0.34} penumbra={0.72} distance={90} decay={1.7} intensity={0} castShadow={quality === 'high' && index === 1} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />)}
    {floorPositions.map((position, index) => <pointLight key={`floor-${index}`} ref={(light) => { if (light) floorRefs.current[index] = light; }} position={position} distance={38} decay={1.8} intensity={0} />)}
    {juryPositions.map((position, index) => <pointLight key={`jury-${index}`} ref={(light) => { if (light) juryRefs.current[index] = light; }} position={position} distance={26} decay={1.8} intensity={0} />)}
  </>;
}

function CameraRig({ preset, transitionSeconds, controlsRef, interactive }: {
  preset: CameraPreset;
  transitionSeconds: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  interactive: boolean;
}) {
  const { camera } = useThree();
  const transition = useRef<{
    startedAt: number;
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromQuaternion: THREE.Quaternion;
    toQuaternion: THREE.Quaternion;
    fromFov: number;
    toFov: number;
    target: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    const next = cameraPresets[preset];
    const toPosition = new THREE.Vector3(...next.position);
    const target = new THREE.Vector3(...next.target);
    // Cameras look down their local -Z axis. A generic Object3D.lookAt uses the
    // opposite convention and would leave the authored stage behind the lens.
    const helper = new THREE.PerspectiveCamera();
    helper.position.copy(toPosition);
    helper.lookAt(target);
    transition.current = {
      startedAt: performance.now(),
      fromPosition: camera.position.clone(),
      toPosition,
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: helper.quaternion.clone(),
      fromFov: camera instanceof THREE.PerspectiveCamera ? camera.fov : next.fov,
      toFov: next.fov,
      target,
    };
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [camera, controlsRef, interactive, preset, transitionSeconds]);

  useFrame(() => {
    const active = transition.current;
    if (!active) return;
    const progress = quintic((performance.now() - active.startedAt) / (transitionSeconds * 1000));
    camera.position.lerpVectors(active.fromPosition, active.toPosition, progress);
    camera.quaternion.slerpQuaternions(active.fromQuaternion, active.toQuaternion, progress);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(active.fromFov, active.toFov, progress);
      camera.updateProjectionMatrix();
    }
    if (progress >= 1) {
      transition.current = null;
      if (controlsRef.current) {
        controlsRef.current.target.copy(active.target);
        controlsRef.current.enabled = interactive;
        controlsRef.current.update();
      }
    }
  });
  return null;
}

function StageWorld({ controls, showState, introStartedAt, reducedMotion, quality, cameraPreset, cameraSeconds, videoElement, videoReady, interactive }: {
  controls: StageControls;
  showState: ShowState;
  introStartedAt: number | null;
  reducedMotion: boolean;
  quality: Quality;
  cameraPreset: CameraPreset;
  cameraSeconds: number;
  videoElement: HTMLVideoElement | null;
  videoReady: boolean;
  interactive: boolean;
}) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  return <>
    <CameraRig preset={cameraPreset} transitionSeconds={cameraSeconds} controlsRef={orbitRef} interactive={interactive} />
    <StageLighting controls={controls} showState={showState} introStartedAt={introStartedAt} reducedMotion={reducedMotion} quality={quality} />
    <StageModel controls={controls} showState={showState} introStartedAt={introStartedAt} reducedMotion={reducedMotion} videoElement={videoElement} videoReady={videoReady} />
    <OrbitControls ref={orbitRef} target={[0, 9, 4]} enabled={interactive} enableDamping dampingFactor={0.065} enablePan={false} minDistance={26} maxDistance={110} maxPolarAngle={Math.PI * 0.49} />
  </>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" className={`stage-toggle ${checked ? 'stage-toggle-active' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}><span><i /></span>{label}</button>;
}

function ChannelControl({ label, enabled, level, onEnabled, onLevel }: { label: string; enabled: boolean; level: number; onEnabled: (value: boolean) => void; onLevel: (value: number) => void }) {
  return <div className="stage-channel"><Toggle checked={enabled} onChange={onEnabled} label={label} /><input aria-label={`${label} parlaklığı`} type="range" min="0" max="1" step="0.01" value={level} disabled={!enabled} onChange={(event) => onLevel(Number(event.target.value))} /></div>;
}

export function LiveStageView({ state, videoElement = null, videoReady = false, interactive = false, publicView = false }: {
  state: LiveStageBroadcastState;
  videoElement?: HTMLVideoElement | null;
  videoReady?: boolean;
  interactive?: boolean;
  publicView?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const openingFinished = state.showState === 'opening' && state.introStartedAt !== null && Date.now() - state.introStartedAt >= INTRO_SECONDS * 1000;
  const showState = openingFinished ? 'live' : state.showState;
  const introStartedAt = openingFinished ? null : state.introStartedAt;
  const dpr = state.quality === 'low' ? 1 : state.quality === 'medium' ? [1, 1.45] as [number, number] : [1, 1.8] as [number, number];

  useEffect(() => {
    const listener = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);

  const toggleFullscreen = async () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stageRef.current.requestFullscreen();
  };

  return <section ref={stageRef} className={`live-stage-viewport quality-${state.quality} ${publicView ? 'live-stage-public-viewport' : ''}`}>
    <Canvas dpr={dpr} camera={{ position: cameraPresets.overview.position, fov: cameraPresets.overview.fov, near: 0.1, far: 400 }} gl={{ antialias: state.quality !== 'low', powerPreference: 'high-performance', alpha: false }} shadows={state.quality === 'high'} onCreated={({ gl, camera }) => { camera.lookAt(new THREE.Vector3(...cameraPresets.overview.target)); gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.28; gl.setClearColor('#010405'); }}>
      <Suspense fallback={null}><StageWorld controls={state.controls} showState={showState} introStartedAt={introStartedAt} reducedMotion={state.reducedMotion} quality={state.quality} cameraPreset={state.cameraPreset} cameraSeconds={state.cameraSeconds} videoElement={videoElement} videoReady={videoReady} interactive={interactive} /></Suspense>
    </Canvas>
    <LoadingOverlay />
    <div className="live-stage-hud"><span>NEXAVISION · HELSINKI 2026</span><strong>{cameraPresets[state.cameraPreset].label}</strong></div>
    <button className="live-stage-fullscreen" type="button" onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 /> : <Maximize2 />}<span>{isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}</span></button>
    {showState === 'blackout' && <div className="live-stage-blackout"><Sparkles /><strong>Sahne beklemede</strong><span>{publicView ? 'Canlı yayın rejiden başlatıldığında burada görünecek.' : 'Rejiden açılışı başlatın veya doğrudan açın.'}</span></div>}
  </section>;
}

export function AdminLiveStage({ token }: { token: string }) {
  const [controls, setControls] = useState(defaultControls);
  const [showState, setShowState] = useState<ShowState>('blackout');
  const [introStartedAt, setIntroStartedAt] = useState<number | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [cameraSeconds, setCameraSeconds] = useState(2.4);
  const [quality, setQuality] = useState<Quality>('medium');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoVolume, setVideoVolume] = useState(0.75);
  const [notice, setNotice] = useState('Yerel video seçilmedi; sahne ekranında geçici Nexavision görseli kullanılıyor.');
  const [broadcastReady, setBroadcastReady] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<'loading' | 'synced' | 'syncing' | 'error'>('loading');
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const broadcastState = useMemo<LiveStageBroadcastState>(() => ({
    controls, showState, introStartedAt, cameraPreset, cameraSeconds, quality, reducedMotion,
  }), [cameraPreset, cameraSeconds, controls, introStartedAt, quality, reducedMotion, showState]);

  const update = useCallback(<K extends keyof StageControls>(key: K, value: StageControls[K]) => {
    setControls((current) => ({ ...current, [key]: value }));
  }, []);

  const syncBroadcast = useCallback((state: LiveStageBroadcastState) => {
    setBroadcastStatus('syncing');
    setBroadcastMessage(null);
    return api('/api/admin/live-stage', { method: 'PUT', token, body: JSON.stringify({ state }) })
      .then(() => { setBroadcastStatus('synced'); })
      .catch((error: unknown) => {
        setBroadcastStatus('error');
        setBroadcastMessage(error instanceof Error ? error.message : 'Canlı sahne durumu izleyicilere gönderilemedi.');
        throw error;
      });
  }, [token]);

  useEffect(() => {
    if (showState !== 'opening' || introStartedAt === null) return;
    const remaining = Math.max(0, INTRO_SECONDS * 1000 - (Date.now() - introStartedAt));
    const timer = window.setTimeout(() => { setShowState('live'); setIntroStartedAt(null); }, remaining);
    return () => window.clearTimeout(timer);
  }, [introStartedAt, showState]);

  useEffect(() => {
    let cancelled = false;
    api<{ state: unknown }>('/api/admin/live-stage', { token }).then((response) => {
      if (cancelled) return;
      const state = normalizeLiveStageState(response.state);
      setControls(state.controls);
      setShowState(state.showState);
      setIntroStartedAt(state.introStartedAt);
      setCameraPreset(state.cameraPreset);
      setCameraSeconds(state.cameraSeconds);
      setQuality(state.quality);
      setReducedMotion(state.reducedMotion);
      setBroadcastReady(true);
      setBroadcastStatus('synced');
      setBroadcastMessage(null);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setBroadcastReady(true);
      setBroadcastStatus('error');
      setBroadcastMessage(error instanceof Error ? error.message : 'Canlı yayın durumu yüklenemedi.');
    });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!broadcastReady) return;
    const timer = window.setTimeout(() => {
      void syncBroadcast(broadcastState).catch(() => undefined);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [broadcastReady, broadcastState, syncBroadcast]);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = videoMuted;
    videoRef.current.volume = videoVolume;
  }, [videoMuted, videoVolume]);

  const startShow = () => {
    const startedAt = Date.now();
    const next = { ...broadcastState, showState: 'opening' as const, introStartedAt: startedAt };
    setShowState(next.showState);
    setIntroStartedAt(startedAt);
    if (broadcastReady) void syncBroadcast(next).catch(() => undefined);
  };
  const blackout = () => {
    const next = { ...broadcastState, showState: 'blackout' as const, introStartedAt: null };
    setShowState(next.showState);
    setIntroStartedAt(null);
    if (broadcastReady) void syncBroadcast(next).catch(() => undefined);
  };
  const directLive = () => {
    const next = { ...broadcastState, showState: 'live' as const, introStartedAt: null };
    setShowState(next.showState);
    setIntroStartedAt(null);
    if (broadcastReady) void syncBroadcast(next).catch(() => undefined);
  };

  const selectVideo = (file: File | undefined) => {
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoReady(false);
    setVideoPlaying(false);
    setNotice(`${file.name} yalnızca bu tarayıcı sekmesinde kullanılacak; sunucuya yüklenmedi.`);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
  };

  const toggleVideo = async () => {
    const video = videoRef.current;
    if (!video || !videoReady) return;
    if (video.paused) {
      try { await video.play(); setVideoPlaying(true); }
      catch { setNotice('Tarayıcı otomatik oynatmayı engelledi. Video düğmesine yeniden basın veya sesi kapalı başlatın.'); }
    } else {
      video.pause();
      setVideoPlaying(false);
    }
  };

  const statusLabel = showState === 'blackout' ? 'KARANLIK' : showState === 'opening' ? 'AÇILIŞ' : 'SAHNE AÇIK';

  return <div className="live-stage-admin mt-6">
    <section className="live-stage-heading">
      <div><p className="eyebrow">Yalnızca yönetici</p><h2>Nexavision Live Stage</h2><p>Blender R03 sahnesinin gerçek zamanlı WebGL prototipi. Bu bölüm genel kullanıcı arayüzünde görünmez.</p></div>
      <div className="live-stage-heading-status"><span className={`stage-status stage-status-${showState}`}><i />{statusLabel}</span><span className={`stage-broadcast-status stage-broadcast-${broadcastStatus}`}>{broadcastStatus === 'synced' ? 'İZLEYİCİYE CANLI' : broadcastStatus === 'syncing' ? 'SENKRONİZE EDİLİYOR' : broadcastStatus === 'loading' ? 'YAYIN DURUMU YÜKLENİYOR' : 'SENKRON HATASI'}</span><span>GLB · React Three Fiber</span></div>
    </section>
    {broadcastMessage && <div className="live-stage-sync-error" role="alert"><strong>İzleyici yayını güncellenemedi.</strong><span>{broadcastMessage} Sayfayı yenileyip yeniden giriş yaptıktan sonra tekrar deneyin.</span></div>}

    <LiveStageView state={broadcastState} videoElement={videoRef.current} videoReady={videoReady} interactive />

    <video ref={videoRef} className="sr-only" playsInline loop muted={videoMuted} onCanPlay={() => setVideoReady(true)} onPlaying={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} />

    <div className="live-stage-console">
      <section className="live-stage-console-card live-stage-cue-card">
        <header><span><MonitorPlay />Gösteri kontrolü</span><small>14 saniyelik tek seferlik cue</small></header>
        <div className="stage-cue-buttons"><button className="btn-primary" type="button" onClick={startShow} disabled={!broadcastReady || showState === 'opening'}><Play />{!broadcastReady ? 'Reji bağlanıyor…' : showState === 'opening' ? 'Açılış oynuyor…' : 'Sahneyi Başlat'}</button><button className="btn-secondary" type="button" onClick={blackout} disabled={!broadcastReady}><RotateCcw />Karart / Sıfırla</button><button className="btn-secondary" type="button" onClick={directLive} disabled={!broadcastReady}><Lightbulb />Doğrudan Aç</button></div>
        <div className="stage-setting-row"><Toggle checked={reducedMotion} onChange={setReducedMotion} label="Azaltılmış hareket / parlama" /><label>Kalite<select value={quality} onChange={(event) => setQuality(event.target.value as Quality)}><option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option></select></label></div>
      </section>

      <section className="live-stage-console-card">
        <header><span><Camera />Kameralar</span><small>Kesintisiz yumuşak geçiş</small></header>
        <div className="stage-camera-grid">{(Object.keys(cameraPresets) as CameraPreset[]).map((key) => <button key={key} type="button" className={cameraPreset === key ? 'active' : ''} onClick={() => setCameraPreset(key)}>{cameraPreset === key && <Check />}{cameraPresets[key].label}</button>)}</div>
        <label className="stage-slider-label"><span>Geçiş süresi <strong>{cameraSeconds.toFixed(1)} sn</strong></span><input type="range" min="0.5" max="8" step="0.1" value={cameraSeconds} onChange={(event) => setCameraSeconds(Number(event.target.value))} /></label>
      </section>

      <section className="live-stage-console-card stage-colors-card">
        <header><span><Sparkles />Renk masası</span><small>Video renklerini etkilemez</small></header>
        <div className="stage-color-inputs"><label>Ana renk<input type="color" value={controls.mainColor} onChange={(event) => update('mainColor', event.target.value)} /></label><label>Vurgu<input type="color" value={controls.accentColor} onChange={(event) => update('accentColor', event.target.value)} /></label></div>
        <div className="stage-palette-grid">{Object.values(palettes).map((palette) => <button key={palette.label} type="button" onClick={() => setControls((current) => ({ ...current, mainColor: palette.main, accentColor: palette.accent }))}><i style={{ background: `linear-gradient(135deg, ${palette.main}, ${palette.accent})` }} />{palette.label}</button>)}</div>
        <label className="stage-slider-label"><span>Genel parlaklık <strong>{Math.round(controls.master * 100)}%</strong></span><input type="range" min="0" max="1.25" step="0.01" value={controls.master} onChange={(event) => update('master', Number(event.target.value))} /></label>
      </section>

      <section className="live-stage-console-card stage-lights-card">
        <header><span><Lightbulb />Işık grupları</span><small>Her grup bağımsız</small></header>
        <ChannelControl label="Ön ışıklar" enabled={controls.frontEnabled} level={controls.frontLevel} onEnabled={(value) => update('frontEnabled', value)} onLevel={(value) => update('frontLevel', value)} />
        <ChannelControl label="Üst spotlar" enabled={controls.spotsEnabled} level={controls.spotsLevel} onEnabled={(value) => update('spotsEnabled', value)} onLevel={(value) => update('spotsLevel', value)} />
        <ChannelControl label="Yerden ışıklar" enabled={controls.floorEnabled} level={controls.floorLevel} onEnabled={(value) => update('floorEnabled', value)} onLevel={(value) => update('floorLevel', value)} />
        <ChannelControl label="Jüri ışıkları" enabled={controls.juryEnabled} level={controls.juryLevel} onEnabled={(value) => update('juryEnabled', value)} onLevel={(value) => update('juryLevel', value)} />
        <ChannelControl label="Sahne çizgileri" enabled={controls.edgesEnabled} level={controls.edgesLevel} onEnabled={(value) => update('edgesEnabled', value)} onLevel={(value) => update('edgesLevel', value)} />
      </section>

      <section className="live-stage-console-card">
        <header><span><Gauge />Hareket ve atmosfer</span><small>Tarayıcı için hafif efektler</small></header>
        <Toggle checked={controls.spotMotion} onChange={(value) => update('spotMotion', value)} label="Spot hareketi" />
        <label className="stage-slider-label"><span>Spot hızı <strong>{controls.spotSpeed.toFixed(1)}×</strong></span><input type="range" min="0.1" max="1.8" step="0.1" value={controls.spotSpeed} onChange={(event) => update('spotSpeed', Number(event.target.value))} /></label>
        <Toggle checked={controls.leafEnabled} onChange={(value) => update('leafEnabled', value)} label="Yaprak LED’leri" />
        <label className="stage-slider-label"><span>LED parlaklığı <strong>{Math.round(controls.leafLevel * 100)}%</strong></span><input type="range" min="0" max="1" step="0.01" value={controls.leafLevel} disabled={!controls.leafEnabled} onChange={(event) => update('leafLevel', Number(event.target.value))} /></label>
        <label className="stage-slider-label"><span>Dolaşım hızı <strong>{controls.leafSpeed.toFixed(1)}×</strong></span><input type="range" min="0.1" max="2" step="0.1" value={controls.leafSpeed} disabled={!controls.leafEnabled} onChange={(event) => update('leafSpeed', Number(event.target.value))} /></label>
        <Toggle checked={controls.leafFill} onChange={(value) => update('leafFill', value)} label="Renkli yaprak iç yüzeyi" />
        <Toggle checked={controls.hazeEnabled} onChange={(value) => update('hazeEnabled', value)} label="Sis / pus" />
        <label className="stage-slider-label"><span>Pus yoğunluğu <strong>{Math.round(controls.hazeDensity * 100)}%</strong></span><input type="range" min="0" max="1" step="0.01" value={controls.hazeDensity} disabled={!controls.hazeEnabled} onChange={(event) => update('hazeDensity', Number(event.target.value))} /></label>
      </section>

      <section className="live-stage-console-card stage-video-card">
        <header><span><Upload />Ana ekran / video</span><small>Yerel dosya sunucuya yüklenmez</small></header>
        <label className="stage-file-picker"><input type="file" accept="video/mp4,video/webm" onChange={(event) => selectVideo(event.target.files?.[0])} /><Upload />MP4 veya WebM seç</label>
        <p>{notice}</p>
        <div className="stage-video-actions"><button type="button" className="btn-secondary" disabled={!videoReady} onClick={toggleVideo}>{videoPlaying ? <Pause /> : <Play />}{videoPlaying ? 'Duraklat' : 'Oynat'}</button><button type="button" className="btn-secondary" onClick={() => { const next = !videoMuted; setVideoMuted(next); if (videoRef.current) videoRef.current.muted = next; }}>{videoMuted ? <VolumeX /> : <Volume2 />}{videoMuted ? 'Ses kapalı' : 'Ses açık'}</button><Toggle checked={controls.screenEnabled} onChange={(value) => update('screenEnabled', value)} label="Ana ekran" /></div>
        <label className="stage-slider-label"><span>Video sesi <strong>{Math.round(videoVolume * 100)}%</strong></span><input type="range" min="0" max="1" step="0.01" value={videoVolume} onChange={(event) => { const value = Number(event.target.value); setVideoVolume(value); if (videoRef.current) videoRef.current.volume = value; }} /></label>
        <div className="stage-privacy-note"><Eye />Dosya yalnızca tarayıcınızda bir Object URL ile okunur; prototip onu API’ye veya depolamaya göndermez.</div>
      </section>
    </div>
  </div>;
}

useGLTF.preload(MODEL_URL, true);
