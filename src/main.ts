import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Office } from './scene/Office';
import { DeskManager } from './scene/DeskManager';
import { CameraController } from './camera/CameraController';
import { AutoTour } from './camera/AutoTour';
import { StreamManager } from './video/StreamManager';
import { VideoTexturePool } from './video/VideoTexturePool';
import { StateManager } from './data/StateManager';
import { MetadataClient } from './data/MetadataClient';
import { MockDataGenerator } from './data/MockData';
import { OpenClawFeeder } from './data/OpenClawFeeder';
import { Dashboard } from './ui/Dashboard';
import { EventBanner } from './ui/EventBanner';
import { BroadcastBar } from './ui/BroadcastBar';
import { PostProcessing } from './scene/PostProcessing';
import { HologramAgent } from './scene/HologramAgent';
import { CompetitionFeeder } from './data/CompetitionFeeder';

// --- Configuration ---
const params = new URLSearchParams(location.search);
const USE_MOCK = params.has('mock');
const USE_COMPETITION = params.has('competition');
const USE_OPENCLAW = params.has('openclaw') || (!USE_MOCK && !USE_COMPETITION && !params.has('relay'));

const OPENCLAW_AGENTS = ['CEO', 'CTO', 'COO', 'CMO', 'CFO'];
const DESK_COUNT = USE_COMPETITION ? 0 : (USE_OPENCLAW ? OPENCLAW_AGENTS.length : 8);
const DESK_COLUMNS = USE_COMPETITION ? 4 : (USE_OPENCLAW ? DESK_COUNT : 4);
const DESK_NAMES = USE_OPENCLAW ? OPENCLAW_AGENTS : undefined;

// --- Viewport ---
const viewport = document.getElementById('viewport')!;

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
viewport.appendChild(renderer.domElement);

// PostProcessing (initialized after camera/scene setup below)
let postProcessing: PostProcessing;

function updateRendererSize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  renderer.setSize(w, h);
  if (postProcessing) postProcessing.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0a06);
scene.fog = new THREE.Fog(0x0f0a06, 22, 50);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);

// --- Office ---
const office = new Office();
scene.add(office.group);

// --- HDRI Environment Map (IBL reflections only, not background) ---
new RGBELoader().load('/textures/env/brown_photostudio_02_1k.hdr', (envMap) => {
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = envMap;
  // scene.background is NOT set — keep dark office background
});

// --- State Manager ---
const stateManager = new StateManager();

// --- Desk Manager ---
const deskManager = new DeskManager({
  count: DESK_COUNT,
  columns: DESK_COLUMNS,
  spacingX: 2.6,
  spacingZ: 4.0,
  names: DESK_NAMES,
});
scene.add(deskManager.group);

// --- Hologram Agents ---
const holograms: HologramAgent[] = [];
for (const [id, desk] of deskManager.desks) {
  const hologram = new HologramAgent(desk, desk.config.name);
  holograms.push(hologram);
}

// --- PostProcessing ---
postProcessing = new PostProcessing(renderer, scene, camera);

// --- Camera Controller (with OrbitControls) ---
const cameraController = new CameraController(camera, deskManager, renderer.domElement);
const autoTour = new AutoTour(cameraController, deskManager);

// --- Video ---
const streamManager = new StreamManager();
const videoTexturePool = new VideoTexturePool(deskManager, streamManager, camera);

// --- State Update Handler ---
stateManager.onUpdate((id, state) => {
  deskManager.updateDesk(id, { status: state.status });
  // Update hologram status
  const deskIndex = deskManager.getDeskIds().indexOf(id);
  if (deskIndex >= 0 && holograms[deskIndex]) {
    holograms[deskIndex].setStatus(state.status);
  }
});

// --- UI ---
const dashboard = new Dashboard(stateManager, cameraController, autoTour);
const eventBanner = new EventBanner();
const broadcastBar = new BroadcastBar(stateManager);

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'b' || e.key === 'B') eventBanner.toggle();
});

// --- Metadata Client ---
const metadataClient = new MetadataClient(stateManager);
metadataClient.onCommand((cmd) => {
  dashboard.handleCommand(cmd);
  eventBanner.handleCommand(cmd);
});

// --- Competition Feeder ---
const competitionFeeder = USE_COMPETITION ? new CompetitionFeeder(stateManager) : null;

if (competitionFeeder) {
  // Wire to MetadataClient
  metadataClient.onCompetitionEvent((event) => {
    competitionFeeder.handleEvent(event);
    // Route commentary events to BroadcastBar ticker
    if (event.type === 'commentary' && event.commentary) {
      broadcastBar.handleCommentary(event.commentary);
    }
  });

  // Dynamic desk creation when new teams appear
  competitionFeeder.onNewTeam((teamId, teamName) => {
    const deskId = `desk-${teamId}`;
    const desk = deskManager.addDesk(deskId, teamName);
    const hologram = new HologramAgent(desk, teamName);
    holograms.push(hologram);
    console.log(`[competition] New team registered: ${teamName} (${deskId})`);
  });

  dashboard.setCompetitionMode(true);
}

// --- Data sources ---
const mockGen = new MockDataGenerator(stateManager, 8);
const openclawFeeder = new OpenClawFeeder(stateManager);

// --- Start ---
function init() {
  updateRendererSize();

  metadataClient.connect();

  if (USE_COMPETITION) {
    const relayHttp = import.meta.env.VITE_RELAY_HTTP || `http://${location.hostname}:9001`;
    competitionFeeder!.loadInitialState(relayHttp);
    console.log('[main] Competition mode enabled');
  } else if (USE_MOCK) {
    mockGen.start(2000);
    console.log('[main] Mock data mode enabled');
  } else if (USE_OPENCLAW) {
    openclawFeeder.start(3000);
    console.log('[main] OpenClaw live mode enabled');
  }

  eventBanner.show();
  setTimeout(() => eventBanner.hide(), 4000);

  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 500);
  }

  animate();
}

// --- Render Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  cameraController.update();
  videoTexturePool.update();
  stateManager.checkStale(60000);

  // Hologram animations
  for (const h of holograms) h.update(dt);

  // Screen glow animation
  for (const [id, desk] of deskManager.desks) {
    const state = stateManager.getParticipant(id);
    if (state && state.status !== 'idle') {
      const mat = desk.monitorScreen.material as THREE.MeshBasicMaterial;
      if (!mat.map) {
        const t = clock.getElapsedTime();
        const pulse = 0.5 + 0.15 * Math.sin(t * 2 + parseInt(id.split('-')[1]) * 0.7);
        if (state.status === 'working') {
          mat.color.setRGB(0.1 * pulse, 0.25 * pulse, 0.15 * pulse);
        } else {
          mat.color.setRGB(0.2 * pulse, 0.18 * pulse, 0.05 * pulse);
        }
      }
    }
  }

  postProcessing.render();
}

// --- Resize ---
window.addEventListener('resize', updateRendererSize);

// --- Go ---
init();
