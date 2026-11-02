/* Crystal Quest 4: Write & Win - game engine (Three.js r128). Writing tasks: js/data.js */
(function() {
  'use strict';

  // -------------------------------------------------------------------
  // 1. FOUR PLAYABLE HERO DEFINITIONS
  // -------------------------------------------------------------------
  const HEROES = window.CQ_DATA.HEROES;

  // -------------------------------------------------------------------
  // 2. THREE WORLDS • 8 REAL VOA RECORDINGS • 28 MUET-STYLE 3-OPTION QUESTIONS
  // Each crystal = one real VOA Learning English recording + 3-4 MUET-style
  // 3-option questions. Choices are shuffled at runtime. 'evidence' is shown
  // only after the student answers.
  // -------------------------------------------------------------------
  const WORLDS = window.CQ_DATA.WORLDS;
  const MOCK = window.CQ_DATA.MOCK;

  // -------------------------------------------------------------------
  // 3. PERSISTENT STATE & CAMERA MODES
  // -------------------------------------------------------------------
  const STORAGE_KEY = 'crystal_quest_write_save_v1';
  const RESULTS_KEY = 'crystal_quest_write_results_v1';
  const PROFILE_KEY = 'crystal_quest_student_v3';
  const CAM_MODES = [
    { id: 'close', label: 'Cam: Close', dist: 6.2, height: 3.1, front: false },
    { id: 'selfie', label: 'Cam: Selfie', dist: 5.2, height: 2.3, front: true },
    { id: 'action', label: 'Cam: Action', dist: 8.5, height: 4.5, front: false },
    { id: 'top', label: 'Cam: Top', dist: 7.5, height: 8.8, front: false }
  ];

  // Phones / small tablets: fewer props, wider camera, short objective
  const COMPACT = Math.min(window.innerWidth, window.innerHeight) < 600 || (('ontouchstart' in window) && window.innerWidth < 900);
  if (COMPACT) document.documentElement.classList.add('cq-compact');

  const state = {
    selectedHeroId: 'aiden',
    currentWorldId: 1,
    totalScore: 0,
    masterVolume: 1.0,
    musicEnabled: true,
    sfxEnabled: true,
    studentName: '',
    studentClass: '',
    levelLog: [],
    touchControlsEnabled: ('ontouchstart' in window) || window.innerWidth < 900,
    camModeIndex: 0,
    camOrbitYaw: 0, // User drag orbit offset
    isPlaying: false,
    isPaused: false,
    isListeningModalOpen: false,
    // Current level live metrics
    hearts: 3,
    levelScore: 0,
    coinsCollected: 0,
    chestsCollected: 0,
    challengesSolved: 0,
    firstAttemptCorrectCount: 0,
    currentCheckpoint: { x: 0, y: 1.5, z: 0 },
    activeCrystalObj: null,
    activeChallengeAttempt: 1,
    worldProgress: {
      1: { stars: 0, bestScore: 0, coins: 0, chests: 0, solved: 0, completed: false },
      2: { stars: 0, bestScore: 0, coins: 0, chests: 0, solved: 0, completed: false },
      3: { stars: 0, bestScore: 0, coins: 0, chests: 0, solved: 0, completed: false }
    }
  };

  function loadSaveData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.selectedHeroId) state.selectedHeroId = parsed.selectedHeroId;
      if (parsed.currentWorldId) state.currentWorldId = parsed.currentWorldId;
      if (typeof parsed.totalScore === 'number') state.totalScore = parsed.totalScore;
      if (parsed.worldProgress) {
        for (const k of [1, 2, 3]) {
          if (parsed.worldProgress[k]) {
            state.worldProgress[k] = Object.assign(state.worldProgress[k], parsed.worldProgress[k]);
          }
        }
      }
    } catch (err) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedHeroId: state.selectedHeroId,
        currentWorldId: state.currentWorldId,
        totalScore: state.totalScore,
        worldProgress: state.worldProgress
      }));
    } catch (err) {}
    updateMainMenuSummary();
  }

  // -------------------------------------------------------------------
  // 4. HIGH-OUTPUT DUAL-ENGINE VOICE & MASTER AUDIO SYSTEM
  // Solves silent iframe TTS by combining fixed Web Speech API +
  // Expressive Formant Syllable Voice Synth + Compressor Boost!
  // -------------------------------------------------------------------
  let audioCtx = null;
  let masterCompressor = null;
  let masterGain = null;
  let bgmGainNode = null;
  let bgmInterval = null;
  let speechProgressTimer = null;
  let availableVoices = [];

  function initVoices() {
    if ('speechSynthesis' in window) {
      try {
        availableVoices = window.speechSynthesis.getVoices() || [];
        window.speechSynthesis.onvoiceschanged = () => {
          availableVoices = window.speechSynthesis.getVoices() || [];
        };
      } catch (e) {}
    }
  }
  initVoices();

  function pickBestEnglishVoice() {
    if (!availableVoices || !availableVoices.length) {
      try { availableVoices = window.speechSynthesis.getVoices() || []; } catch (e) {}
    }
    const enVoices = availableVoices.filter(v => /^en(-|_|$)/i.test(v.lang));
    const preferred = enVoices.find(v => /Google|Natural|Samantha|Aria|Jenny|Guy|Daniel/i.test(v.name));
    return preferred || enVoices[0] || availableVoices[0] || null;
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        masterCompressor = audioCtx.createDynamicsCompressor();
        masterCompressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
        masterCompressor.knee.setValueAtTime(12, audioCtx.currentTime);
        masterCompressor.ratio.setValueAtTime(6, audioCtx.currentTime);
        masterCompressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
        masterCompressor.release.setValueAtTime(0.15, audioCtx.currentTime);

        masterGain = audioCtx.createGain();
        masterGain.gain.value = state.masterVolume;

        bgmGainNode = audioCtx.createGain();
        bgmGainNode.gain.value = 0.22;

        bgmGainNode.connect(masterCompressor);
        masterCompressor.connect(masterGain);
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(state.masterVolume, audioCtx.currentTime);
    }
  }

  function setBgmDucking(ducked) {
    if (!audioCtx || !bgmGainNode) return;
    const target = !state.musicEnabled ? 0.0001 : (ducked ? 0.03 : 0.22);
    bgmGainNode.gain.setTargetAtTime(target, audioCtx.currentTime, 0.12);
  }

  // Expressive Vowel-Formant Voice Syllable Synthesizer
  // Plays warm spoken-cadence syllables so the guardian is ALWAYS audible
  function playVoiceSyllable(pitchMultiplier, wordStr) {
    if (!state.sfxEnabled) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const charSum = wordStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const baseF0 = (195 + (charSum % 75)) * (pitchMultiplier || 1.0);

    // Fundamental glottal carrier + harmonic formant filter
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const syllGain = audioCtx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(baseF0, now);
    osc1.frequency.exponentialRampToValueAtTime(baseF0 * 1.08, now + 0.06);
    osc1.frequency.exponentialRampToValueAtTime(baseF0 * 0.94, now + 0.14);

    osc2.frequency.setValueAtTime(baseF0 * 2.0, now);

    // Vowel formant resonance (800Hz - 1800Hz)
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900 + (charSum % 900), now);
    filter.Q.setValueAtTime(3.2, now);

    const vol = 0.28;
    syllGain.gain.setValueAtTime(0.001, now);
    syllGain.gain.linearRampToValueAtTime(vol, now + 0.018);
    syllGain.gain.exponentialRampToValueAtTime(0.001, now + 0.145);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(syllGain);
    syllGain.connect(masterCompressor);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
  }

  function startBackgroundMusic(worldId) {
    stopBackgroundMusic();
    if (!state.musicEnabled) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const scales = {
      1: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 659.25], // Sunlit Forest
      2: [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46], // Echo Falls
      3: [329.63, 392.00, 493.88, 523.25, 587.33, 659.25, 783.99]  // Celestial Kingdom
    };
    const notes = scales[worldId] || scales[1];
    let step = 0;

    bgmInterval = setInterval(() => {
      if (!state.musicEnabled || state.isPaused || !audioCtx || audioCtx.state !== 'running') return;
      const now = audioCtx.currentTime;
      const freq = notes[step % notes.length];
      step = (step + (step % 3 === 0 ? 2 : 1)) % notes.length;

      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      osc.type = worldId === 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.26, now + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

      osc.connect(noteGain);
      noteGain.connect(bgmGainNode);
      osc.start(now);
      osc.stop(now + 0.55);
    }, 480);
  }

  function stopBackgroundMusic() {
    if (bgmInterval) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  }

  function playSfx(type) {
    if (!state.sfxEnabled) return;
    ensureAudioContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const playTone = (freqStart, freqEnd, dur, wave = 'triangle', vol = 0.35, delay = 0) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freqStart, now + delay);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + dur);
      }
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.connect(gain);
      gain.connect(masterCompressor);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    if (type === 'jump') {
      playTone(280, 620, 0.2, 'triangle', 0.38);
    } else if (type === 'bounce') {
      playTone(220, 880, 0.32, 'sine', 0.45);
    } else if (type === 'coin') {
      playTone(587.33, 587.33, 0.09, 'triangle', 0.4, 0);
      playTone(880.00, 880.00, 0.22, 'triangle', 0.42, 0.08);
    } else if (type === 'chest') {
      [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
        playTone(f, f, 0.2, 'triangle', 0.42, idx * 0.09);
      });
    } else if (type === 'checkpoint') {
      playTone(440, 660, 0.22, 'sine', 0.38, 0);
      playTone(660, 880, 0.25, 'sine', 0.38, 0.12);
    } else if (type === 'correct') {
      [523.25, 659.25, 783.99, 1046.50].forEach((f, idx) => {
        playTone(f, f * 1.02, 0.24, 'triangle', 0.45, idx * 0.08);
      });
    } else if (type === 'wrong') {
      playTone(300, 210, 0.22, 'sawtooth', 0.28, 0);
      playTone(210, 175, 0.25, 'sawtooth', 0.28, 0.15);
    } else if (type === 'damage') {
      playTone(240, 110, 0.3, 'sawtooth', 0.35, 0);
    } else if (type === 'portal') {
      [392.00, 493.88, 587.33, 783.99, 987.77, 1174.66].forEach((f, idx) => {
        playTone(f, f * 1.05, 0.28, 'triangle', 0.42, idx * 0.07);
      });
    }
  }

  function stopSpeechAudio() {}
  function applyAudioSettings() {}

  // Main menu sound check: plays a chime so students can set the volume
  document.getElementById('btn-test-voice').addEventListener('click', () => {
    ensureAudioContext();
    playSfx('correct');
    showToast('🔔 If you heard the chime, your game sounds are on. Writing needs no audio.');
  });

  // -------------------------------------------------------------------
  // 5. THREE.JS SUNLIT REALISTIC FANTASY SCENE & EXPRESSIVE HERO RIG
  // -------------------------------------------------------------------
  const container = document.getElementById('game-canvas-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x38bdf8);
  scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0065);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 4.2, 6.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Warm Realistic Hemisphere + Sun Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4ade80, 0.85);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
  dirLight.position.set(24, 42, 28);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  // Dedicated Spotlight following the Hero so the player ALWAYS stands out clearly
  const heroSpotLight = new THREE.PointLight(0xfffbeb, 0.9, 12);
  scene.add(heroSpotLight);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Collections
  let platforms = [];
  let movingPlatforms = [];
  let bouncyMushrooms = [];
  let crystalCoins = [];
  let listeningCrystals = [];
  let treasureChests = [];
  let checkpoints = [];
  let enemies = [];
  let clouds = [];
  let waterfallParticles = [];
  let waterWheels = [];
  let ambientParticles = [];
  let trailParticles = [];
  let portalObject = null;
  let waterMesh = null;

  // Hero 3D Rig & Physics State
  let heroMesh = null;
  let heroParts = {};
  const player = {
    pos: new THREE.Vector3(0, 1.5, 0),
    vel: new THREE.Vector3(0, 0, 0),
    onGround: false,
    facingAngle: Math.PI,
    animState: 'idle',
    animTimer: 0,
    invulnerableTimer: 0,
    standingPlatform: null
  };

  // Generate a crisp painted Anime Face Texture for the 3D Hero Head
  function createAnimeFaceTexture(skinHex, eyeColorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Skin background
    const hexStr = '#' + skinHex.toString(16).padStart(6, '0');
    ctx.fillStyle = hexStr;
    ctx.fillRect(0, 0, 256, 256);

    // Rosy adventure cheeks
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.ellipse(75, 152, 18, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(181, 152, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Eyes (Left & Right)
    const drawEye = (cx, cy) => {
      // White sclera
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Colored iris
      ctx.fillStyle = eyeColorStr || '#1e3a8a';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 8, 0, Math.PI * 2);
      ctx.fill();

      // Bright anime catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 6, 5, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy + 7, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Upper eyelash arch
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 20, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    };
    drawEye(88, 122);
    drawEye(168, 122);

    // Cheerful confident smile
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 154, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function buildHeroMesh(heroDef) {
    if (ART_OK && artTex[heroDef.id + '_idle']) { buildSpriteHero(heroDef); return; }
    if (heroMesh) {
      scene.remove(heroMesh);
    }
    const root = new THREE.Group();
    const c = heroDef.colors;

    const matSkin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.45 });
    const matTunic = new THREE.MeshStandardMaterial({ color: c.tunic, roughness: 0.35 });
    const matAccent = new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.3 });
    const matHair = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.4 });
    const matBoots = new THREE.MeshStandardMaterial({ color: c.boots, roughness: 0.5 });
    const matGlow = new THREE.MeshBasicMaterial({ color: c.particle });

    // Glowing Hero Ground Ring ("See Yourself" Locator Ring underfoot!)
    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.82, 32),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    groundRing.rotation.x = Math.PI / 2;
    groundRing.position.y = 0.04;
    root.add(groundRing);

    // Torso + Tunic Skirt
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.82, 14), matTunic);
    torso.position.y = 0.82;
    torso.castShadow = true;
    root.add(torso);

    // Belt & Golden Buckle
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), matBoots);
    belt.position.y = 0.58;
    root.add(belt);

    // Scarf / Collar + Flowing Cape Back
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 10, 18), matAccent);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.18;
    root.add(collar);

    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.08), matAccent);
    cape.position.set(0, 0.82, -0.36);
    cape.rotation.x = 0.18;
    root.add(cape);

    // Head with Painted Anime Face Texture
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.62;
    const faceTex = createAnimeFaceTexture(c.skin, c.eyeColor);
    const headMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 20), headMat);
    head.rotation.y = -Math.PI / 2; // Align canvas front with +Z
    head.castShadow = true;
    headGroup.add(head);

    // Sculpted Hair Cap + Spiky Tufts
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.49, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), matHair);
    hairCap.rotation.x = -0.22;
    headGroup.add(hairCap);

    // Hero-specific headgear & props
    if (heroDef.id === 'aiden' || heroDef.id === 'mia') {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 22), matBoots);
      strap.rotation.x = Math.PI / 2;
      strap.position.y = 0.18;
      const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.15 });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.2 });
      const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), lensMat);
      lensL.rotation.x = Math.PI / 2;
      lensL.position.set(-0.16, 0.19, 0.45);
      const lensR = lensL.clone();
      lensR.position.x = 0.16;
      const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 16), frameMat);
      rimL.position.set(-0.16, 0.19, 0.49);
      const rimR = rimL.clone();
      rimR.position.x = 0.16;
      headGroup.add(strap, lensL, lensR, rimL, rimR);

      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.28), matAccent);
      pack.position.set(0, 0.85, -0.38);
      root.add(pack);
    } else if (heroDef.id === 'luna') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 18), matTunic);
      brim.position.y = 0.3;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.82, 16), matTunic);
      cone.position.y = 0.7;
      cone.rotation.z = -0.12;
      const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 18), matAccent);
      hatBand.rotation.x = Math.PI / 2;
      hatBand.position.y = 0.34;
      headGroup.add(brim, cone, hatBand);
    } else if (heroDef.id === 'rex') {
      const hoodCone = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.62, 14), matTunic);
      hoodCone.position.set(0, 0.38, -0.16);
      hoodCone.rotation.x = -0.5;
      headGroup.add(hoodCone);
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.62, 10), matAccent);
      quiver.position.set(0.2, 0.9, -0.38);
      quiver.rotation.z = -0.25;
      root.add(quiver);
    }

    root.add(headGroup);

    // Articulated Arms & Hands
    const armGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.54, 10);
    const leftArm = new THREE.Mesh(armGeo, matTunic);
    leftArm.position.set(-0.5, 0.86, 0);
    const rightArm = new THREE.Mesh(armGeo, matTunic);
    rightArm.position.set(0.5, 0.86, 0);

    // Glowing Adventurer Staff / Crystal Wand on Right Hand
    const wandStick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), matAccent);
    wandStick.position.set(0, -0.28, 0.2);
    wandStick.rotation.x = Math.PI / 3;
    const wandGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), matGlow);
    wandGem.position.set(0, 0.36, 0);
    wandStick.add(wandGem);
    rightArm.add(wandStick);

    root.add(leftArm, rightArm);

    // Legs & Boots
    const legGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.45, 10);
    const leftLeg = new THREE.Mesh(legGeo, matBoots);
    leftLeg.position.set(-0.2, 0.24, 0);
    const rightLeg = new THREE.Mesh(legGeo, matBoots);
    rightLeg.position.set(0.2, 0.24, 0);
    root.add(leftLeg, rightLeg);

    // Listening Soundwave Ring
    const listenRing = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.78, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    listenRing.rotation.x = Math.PI / 2;
    listenRing.position.y = 1.6;
    listenRing.visible = false;
    root.add(listenRing);

    // Scale hero up slightly so they are super clear and prominent!
    root.scale.setScalar(1.22);

    heroMesh = root;
    heroParts = { headGroup, leftArm, rightArm, leftLeg, rightLeg, torso, cape, groundRing, listenRing, particleColor: c.particle };
    scene.add(heroMesh);
  }

  function setHeroAnimState(stateName, duration = 0) {
    player.animState = stateName;
    player.animTimer = duration;
    const poseNames = {
      idle: 'Ready ✨',
      run: 'Running 🏃',
      jump: 'Leaping ⬆️',
      fall: 'Gliding 🪂',
      listen: 'Reading 📖',
      answer: 'Answering 💡',
      collect: 'Got a Scroll! 📜',
      celebrate: 'Victory! 🎉',
      damage: 'Ouch! 💥'
    };
    const label = poseNames[stateName] || 'Exploring ✨';
    const tagPose = document.getElementById('hero-tag-pose');
    const mirrorPose = document.getElementById('mirror-pose-pill');
    if (tagPose) tagPose.textContent = '• ' + label;
    if (mirrorPose) mirrorPose.textContent = 'Pose: ' + label;
  }

  // -------------------------------------------------------------------
  // 6. 3D NPC GUARDIANS, ENEMIES, BOUNCY MUSHROOMS & SCENERY
  // -------------------------------------------------------------------
  const CLOUD_TINTS = { 1: ['#2f86d6', '#8fd0fa'], 2: ['#2f86d6', '#8fd0fa'], 3: ['#2f86d6', '#8fd0fa'] };
  function cloudSeaTexture(worldId) {
    const [base, puff] = CLOUD_TINTS[worldId] || CLOUD_TINTS[1];
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g2 = c.getContext('2d');
    g2.fillStyle = base; g2.fillRect(0, 0, 512, 512);
    let seed = 5 + worldId;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < 70; k++) {
      const x = r() * 512, y = r() * 512, rad = 8 + r() * 18;
      for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
        const gr = g2.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        gr.addColorStop(0, puff); gr.addColorStop(0.6, puff + 'cc'); gr.addColorStop(1, puff + '00');
        g2.fillStyle = gr; g2.beginPath(); g2.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g2.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 13);
    t.isCloud = true;
    return t;
  }

  function makeAnvilMesh() {
    // parchment on top (this is the part that turns gold), anvil body as children
    const parchGeo = new THREE.BoxGeometry(0.95, 0.05, 0.62);
    parchGeo.translate(0, 1.23, 0);
    const parch = new THREE.Mesh(parchGeo, new THREE.MeshStandardMaterial({ color: 0xbdb3a0, emissive: 0x000000, roughness: 0.9 }));
    parch.userData.still = true;
    const iron = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.7), dark); base.position.y = 0.18;
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.42), iron); waist.position.y = 0.6;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.32, 0.62), iron); top.position.y = 1.0;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), iron); horn.rotation.z = Math.PI / 2; horn.position.set(0.9, 1.02, 0);
    const quill = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.75, 6), new THREE.MeshStandardMaterial({ color: 0xc084fc }));
    quill.rotation.z = -0.9; quill.position.set(0.25, 1.48, 0.12);
    parch.add(base, waist, top, horn, quill);
    return parch;
  }

  function createGuardianNPC(worldId, index) {
    if (ART_OK && artTex.quilla_idle) {
      // Owl Librarian (sprite art); poses change in the reading workflow
      const og = new THREE.Group();
      const owl = makeSprite('quilla_idle', OWL_H, 0);
      og.add(makeBlobShadow(0.5), owl);
      og.userData.owl = owl;
      return og;
    }
    const kenneyGuardian = makeGuardianModel(worldId);
    if (kenneyGuardian) return kenneyGuardian;
    const g = new THREE.Group();
    if (worldId === 1) {
      // Wise Forest Spirit / Lantern Guardian
      const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.35, 12),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 })
      );
      robe.position.y = 0.68;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xfde68a })
      );
      head.position.y = 1.5;
      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 0.65, 12),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24 })
      );
      hat.position.y = 1.95;
      g.add(robe, head, hat);
    } else if (worldId === 2) {
      // Echo Falls Water Guardian
      const robe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.55, 1.35, 12),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
      );
      robe.position.y = 0.68;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xbae6fd })
      );
      head.position.y = 1.5;
      const crown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.25),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
      );
      crown.position.y = 2.0;
      g.add(robe, head, crown);
    } else {
      // Celestial Archmage Guardian
      const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.58, 1.45, 12),
        new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.3 })
      );
      robe.position.y = 0.72;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xfef08a })
      );
      head.position.y = 1.55;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.05, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 2.05;
      g.add(robe, head, halo);
    }
    return g;
  }

  function createCuteEnemyMesh(type) {
    const g = new THREE.Group();
    if (ART_OK && artTex['enemy_' + type]) {
      const h = type === 'sprite' ? 1.4 : (type === 'inkling' ? 1.05 : 1.15);
      const sp = makeSprite('enemy_' + type, h);
      if (type === 'sprite') sp.position.y = 0.25;
      g.add(makeBlobShadow(0.45), sp);
      return g;
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    if (type === 'slime') {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 14),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, transparent: true, opacity: 0.9 })
      );
      body.scale.set(1.15, 0.82, 1.15);
      body.position.y = 0.45;
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.35, 10),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15 })
      );
      tip.position.y = 0.92;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), eyeMat);
      eyeL.position.set(-0.18, 0.48, 0.52);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.18;
      g.add(body, tip, eyeL, eyeR);
    } else if (type === 'mushroom') {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.38, 0.55, 12),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.5 })
      );
      stem.position.y = 0.3;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.58, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
      );
      cap.position.y = 0.52;
      const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let i = 0; i < 4; i++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), spotMat);
        const ang = (i / 4) * Math.PI * 2;
        spot.position.set(Math.cos(ang) * 0.36, 0.78, Math.sin(ang) * 0.36);
        g.add(spot);
      }
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
      eyeL.position.set(-0.14, 0.35, 0.34);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.14;
      g.add(stem, cap, eyeL, eyeR);
    } else {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.3 })
      );
      body.position.y = 0.75;
      const glowEyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowEyeMat);
      eyeL.position.set(-0.16, 0.78, 0.42);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.16;
      const earGeo = new THREE.ConeGeometry(0.14, 0.35, 8);
      const earMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce });
      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(-0.26, 1.22, 0);
      earL.rotation.z = 0.3;
      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(0.26, 1.22, 0);
      earR.rotation.z = -0.3;
      g.add(body, eyeL, eyeR, earL, earR);
    }
    return g;
  }

  // -------------------------------------------------------------------
  // 7. SUNLIT 3D FANTASY VALLEY GENERATOR (WITH CLOUDS, WATERFALLS & TREES)
  // -------------------------------------------------------------------
  function clearWorld() {
    while (worldGroup.children.length > 0) {
      worldGroup.remove(worldGroup.children[0]);
    }
    platforms = [];
    movingPlatforms = [];
    bouncyMushrooms = [];
    crystalCoins = [];
    listeningCrystals = [];
    treasureChests = [];
    checkpoints = [];
    enemies = [];
    clouds = [];
    waterfallParticles = [];
    waterWheels = [];
    swayers = [];
    lanterns = [];
    sphinx = null;
    bookPages = [];
    flowingWaters = [];
    ambientParticles = [];
    trailParticles = [];
    portalObject = null;
    waterMesh = null;
  }

  function addPlatform(x, y, z, w, h, d, colorHex, isMoving = false, moveSpec = null) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Lush Top Grass / Crystal Cap with rounded bevel look
    const topMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.36, d),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 })
    );
    topMesh.position.y = h * 0.32;
    topMesh.receiveShadow = true;

    // Warm Cliff / Stone Base
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.92, h * 0.68, d * 0.92),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75 })
    );
    baseMesh.position.y = -h * 0.18;
    baseMesh.receiveShadow = true;

    group.add(topMesh, baseMesh);
    dressPlatform(group, topMesh, baseMesh, w, d, colorHex, buildingWorldId);
    worldGroup.add(group);

    const platObj = {
      mesh: group,
      x, y, z,
      w, h, d,
      topY: y + h * 0.5,
      active: true,
      isMoving,
      moveSpec,
      baseX: x,
      baseY: y,
      baseZ: z,
      dx: 0,
      dy: 0,
      dz: 0
    };
    platforms.push(platObj);
    if (isMoving) movingPlatforms.push(platObj);
    return platObj;
  }

  function addBouncyMushroom(x, y, z) {
    if (ART_OK && artTex.item_bounce_mushroom) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.add(makeBlobShadow(0.8), makeSprite('item_bounce_mushroom', 1.7));
      worldGroup.add(g);
      bouncyMushrooms.push({ mesh: g, x, y, z });
      return;
    }
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7 })
    );
    stem.position.y = 0.35;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x881337, emissiveIntensity: 0.25 })
    );
    cap.position.y = 0.65;
    g.add(stem, cap);
    worldGroup.add(g);
    bouncyMushrooms.push({ mesh: g, x, y, z });
  }

  function addCloud(x, y, z, scale = 1.0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.92 });
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 12), mat);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), mat);
    p2.position.set(1.5, -0.2, 0.2);
    const p3 = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 12), mat);
    p3.position.set(-1.4, -0.3, -0.2);
    g.add(p1, p2, p3);
    g.scale.setScalar(scale);
    worldGroup.add(g);
    clouds.push({ mesh: g, baseX: x, speed: 0.3 + Math.random() * 0.4, phase: Math.random() * 10 });
  }

  function addDecorativeScenery(worldDef, x, y, z, index) {
    if (MODELS_OK) { addKenneyFeature(worldDef, x, y, z, index); return; }
    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (worldDef.id === 1) {
      // Lush Forest Trees, Cozy Treehouse & Glowing Flowers
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.48, 2.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      );
      trunk.position.y = 1.25;
      const foliage1 = new THREE.Mesh(
        new THREE.SphereGeometry(1.45, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
      );
      foliage1.position.y = 2.9;
      const foliage2 = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 })
      );
      foliage2.position.set(0.4, 3.7, 0.3);
      group.add(trunk, foliage1, foliage2);

      // Add a cozy wooden treehouse lantern on every 3rd tree
      if (index % 3 === 0) {
        const house = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.1, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x92400e })
        );
        house.position.y = 2.2;
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(1.46, 0.4, 0.4),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        win.position.y = 2.25;
        group.add(house, win);
      }
    } else if (worldDef.id === 2) {
      // Echo Falls: Animated Waterfall Cascade + Spinning Wooden Waterwheel
      const cliff = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 5.2, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x475569 })
      );
      cliff.position.y = 2.2;
      const fall = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 5.3, 1.9),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.78 })
      );
      fall.position.y = 2.2;
      group.add(cliff, fall);

      if (index % 2 === 0) {
        const wheel = new THREE.Mesh(
          new THREE.TorusGeometry(1.2, 0.18, 10, 16),
          new THREE.MeshStandardMaterial({ color: 0x92400e })
        );
        wheel.position.set(1.1, 1.8, 0);
        wheel.rotation.y = Math.PI / 2;
        group.add(wheel);
        waterWheels.push(wheel);
      }
    } else {
      // Celestial Kingdom: Golden Astral Towers & Floating Crystal Clusters
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.7, 3.8, 12),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.3, roughness: 0.3 })
      );
      tower.position.y = 1.9;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 1.6, 12),
        new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x7e22ce, emissiveIntensity: 0.4 })
      );
      spire.position.y = 4.5;
      group.add(tower, spire);
    }
    worldGroup.add(group);
  }

  function addCoin(x, y, z) {
    if (ART_OK && (artTex.item_quill || artTex.item_scroll)) {
      const sp = makeSprite(artTex.item_quill ? 'item_quill' : 'item_scroll', 0.85, 0.5);
      sp.position.set(x, y, z);
      worldGroup.add(sp);
      crystalCoins.push({ mesh: sp, x, y, z, collected: false });
      return;
    }
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.15
      })
    );
    mesh.position.set(x, y, z);
    worldGroup.add(mesh);
    crystalCoins.push({ mesh, x, y, z, collected: false });
  }

  function addTreasureChest(x, y, z) {
    if (ART_OK && artTex.item_chest) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const sp = makeSprite('item_chest', 1.0);
      g.add(makeBlobShadow(0.6), sp);
      worldGroup.add(g);
      treasureChests.push({ mesh: g, sprite: sp, x, y, z, opened: false });
      return;
    }
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.65, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.35 })
    );
    box.position.y = 0.32;
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.18, 0.76),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.2 })
    );
    trim.position.y = 0.58;
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.26, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xfef08a })
    );
    lock.position.y = 0.46;
    g.add(box, trim, lock);
    worldGroup.add(g);
    treasureChests.push({ mesh: g, x, y, z, opened: false });
  }

  function addCheckpoint(x, y, z) {
    if (ART_OK && artTex.item_checkpoint) {
      const g = new THREE.Group();
      g.position.set(x - 2.6, y, z);
      const sp = makeSprite('item_checkpoint', 1.5);
      const orb = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
      orb.rotation.x = -Math.PI / 2;
      orb.position.y = 0.05;
      g.add(orb, sp);
      worldGroup.add(g);
      checkpoints.push({ mesh: g, orb, x, y, z, activated: false });
      return;
    }
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
    );
    base.position.y = 0.11;
    const orb = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.09, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    orb.position.y = 0.82;
    g.add(base, orb);
    worldGroup.add(g);
    checkpoints.push({ mesh: g, orb, x, y, z, activated: false });
  }

  // -------------------------------------------------------------------
  // 6b. PAINTED ART SPRITES (loaded from the art/ folder)
  // Replace any .webp in art/ with a sharper image of the same name:
  // no code change needed. If art/ cannot load (e.g. the HTML is opened
  // as a local file), the game falls back to the simple 3D shapes.
  // -------------------------------------------------------------------
  const ART_BASE = 'art/';
  const HERO_POSES = ['idle', 'run', 'jump', 'fall', 'listen', 'answer', 'celebrate', 'back', 'damage'];
  const ART_FILES = [];
  ['aiden', 'luna', 'rex', 'mia'].forEach(h => HERO_POSES.forEach(p => {
    if (p === 'damage' && h === 'mia') return; // no damage pose on this sheet
    ART_FILES.push(h + '_' + p);
  }));
  ['enemy_inkling', 'inkling_move', 'inkling_hit',
   'quilla_idle', 'quilla_talk', 'quilla_happy', 'quilla_point',
   'item_anvil', 'item_anvil_dim', 'item_quill', 'item_scroll', 'item_portal_ink',
   'golem_idle', 'golem_roar', 'golem_attack', 'golem_think', 'golem_happy', 'golem_fly',
   'item_chest', 'item_chest_open', 'item_checkpoint',
   'item_portal_green', 'item_portal_blue', 'item_portal_purple', 'item_signpost', 'item_bounce_mushroom',
   'backdrop_w1', 'backdrop_w2', 'backdrop_w3'].forEach(n => ART_FILES.push(n));
  const artTex = {};
  let ART_OK = false;
  const HERO_H = 2.4;

  function loadArt() {
    // Browsers block WebGL textures from local files, so only load art when served over http(s)
    if (!/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    const loader = new THREE.TextureLoader();
    return Promise.all(ART_FILES.map(name => new Promise(resolve => {
      loader.load(ART_BASE + name + '.webp', tex => {
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        artTex[name] = tex;
        resolve(true);
      }, undefined, () => resolve(false));
    }))).then(() => {
      ART_OK = !!(artTex.aiden_idle && artTex.mia_idle && artTex.luna_idle && artTex.rex_idle);
      return ART_OK;
    });
  }

  function flippedTex(tex) {
    if (!tex._flip) {
      const f = tex.clone();
      f.wrapS = THREE.RepeatWrapping;
      f.repeat.x = -1;
      f.offset.x = 1;
      f.needsUpdate = true;
      tex._flip = f;
    }
    return tex._flip;
  }

  function setSpriteSize(sprite, tex, h) {
    const img = tex.image;
    sprite.userData.baseW = h * img.width / img.height;
    sprite.userData.baseH = h;
    sprite.scale.set(sprite.userData.baseW, h, 1);
  }

  function makeSprite(name, h, centerY = 0) {
    const tex = artTex[name];
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.08 });
    const s = new THREE.Sprite(mat);
    s.center.set(0.5, centerY);
    setSpriteSize(s, tex, h);
    return s;
  }

  function addProp(name, x, y, z, h) {
    if (!ART_OK || !artTex[name]) return null;
    const s = makeSprite(name, h);
    s.position.set(x, y, z);
    worldGroup.add(s);
    return s;
  }

  function makeBlobShadow(r) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    return m;
  }

  // Panorama backdrop on a large cylinder that follows the player
  let backdropMesh = null;
  function setBackdrop(worldId) {
    if (backdropMesh) { scene.remove(backdropMesh); backdropMesh = null; }
    const tex = ART_OK && artTex['backdrop_w' + worldId];
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1; // seen from inside the cylinder
    tex.needsUpdate = true;
    const r = 150;
    const h = (2 * Math.PI * r) * (tex.image.height / tex.image.width);
    backdropMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    backdropMesh.position.y = h / 2 - 14;
    backdropMesh.rotation.y = Math.PI / 2;
    backdropMesh.renderOrder = -1;
    scene.add(backdropMesh);
  }

  function buildSpriteHero(heroDef) {
    if (heroMesh) scene.remove(heroMesh);
    const root = new THREE.Group();
    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.82, 32),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    groundRing.rotation.x = Math.PI / 2;
    groundRing.position.y = 0.04;
    const listenRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    listenRing.rotation.x = Math.PI / 2;
    listenRing.position.y = 0.06;
    listenRing.visible = false;
    const sprite = makeSprite(heroDef.id + '_idle', HERO_H);
    root.add(makeBlobShadow(0.55), groundRing, listenRing, sprite);
    heroMesh = root;
    heroParts = { groundRing, listenRing, sprite, heroId: heroDef.id, faceLeft: false, pose: 'idle', particleColor: heroDef.colors.particle };
    scene.add(heroMesh);
  }

  const _camFwd = new THREE.Vector3();
  function updateSpriteHero(elapsed, mirrorImg) {
    const hp = heroParts;
    const id = hp.heroId;
    const st = player.animState;
    let pose = 'idle';
    if (state.isListeningModalOpen) pose = st === 'answer' ? 'answer' : 'listen';
    else if (st === 'celebrate' || st === 'collect') pose = 'celebrate';
    else if (st === 'damage') pose = artTex[id + '_damage'] ? 'damage' : 'fall';
    else if (!player.onGround) pose = player.vel.y > 0 ? 'jump' : 'fall';
    else if (st === 'run') pose = 'run';

    // Which way is the hero moving, as seen by the camera?
    camera.getWorldDirection(_camFwd);
    _camFwd.y = 0;
    _camFwd.normalize();
    const rx = -_camFwd.z, rz = _camFwd.x; // camera right
    const vx = player.vel.x, vz = player.vel.z;
    const side = vx * rx + vz * rz;
    const ahead = vx * _camFwd.x + vz * _camFwd.z;
    if (Math.hypot(vx, vz) > 0.8 && Math.abs(side) > 0.4) hp.faceLeft = side < 0;
    if (pose === 'run' && ahead > Math.abs(side) * 1.4 && artTex[id + '_back']) pose = 'back';

    const base = artTex[id + '_' + pose] || artTex[id + '_idle'];
    const tex = (hp.faceLeft && pose !== 'back') ? flippedTex(base) : base;
    if (hp.sprite.material.map !== tex) {
      hp.sprite.material.map = tex;
      hp.sprite.material.needsUpdate = true;
      setSpriteSize(hp.sprite, base, pose === 'fall' ? HERO_H * 0.85 : HERO_H);
    }

    let bob = 0, sx = 1, sy = 1;
    if (pose === 'run' || pose === 'back') {
      const ph = Math.abs(Math.sin(elapsed * 12));
      bob = ph * 0.12; sy = 1 + ph * 0.04; sx = 1 - ph * 0.03;
    } else if (pose === 'idle' || pose === 'listen' || pose === 'answer') {
      sy = 1 + Math.sin(elapsed * 2.5) * 0.02;
    } else if (pose === 'celebrate') {
      bob = Math.abs(Math.sin(elapsed * 8)) * 0.25;
    }
    hp.sprite.position.y = bob;
    hp.sprite.scale.set(hp.sprite.userData.baseW * sx, hp.sprite.userData.baseH * sy, 1);
    if (mirrorImg) mirrorImg.style.transform = pose === 'run' ? `translateY(${Math.sin(elapsed * 12) * 3}px)` : 'none';
  }

  // -------------------------------------------------------------------
  // 6c. KENNEY 3D SCENERY (models/ folder, CC0 Kenney Nature Kit)
  // Trees, rocks, flowers, statues and waterfalls per world, plus
  // textured ground. Falls back to simple shapes if models cannot load.
  // -------------------------------------------------------------------
  const MODELS_BASE = 'models/';
  const WORLD_SCENERY = {
    1: { // Level 7: Lantern Library (autumn trees, bookshelves, lanterns)
      features: ['tree_oak', 'tree_detailed', 'tree_default', 'tree_fat'],
      featureScale: [3.0, 3.6],
      small: ['mushroom_tanGroup', 'flower_yellowA', 'flower_purpleA', 'plant_bushLarge', 'grass_large', 'stump_round', 'rock_smallA'],
      smallScale: [2.2, 3.2],
      guardian: 'statue_head',
      extra: ['log_stack'],
      topTint: 0x6aa84f, cliffTint: 0x9c7b56, waterTint: 0x3b82f6
    },
    2: { // Level 8: Ruins of Riddles (sandy stone, broken columns)
      features: ['statue_columnDamaged', 'rock_tallA', 'stone_tallB', 'tree_pineRoundA'],
      featureScale: [3.0, 3.8],
      small: ['stone_smallA', 'rock_smallA', 'grass_large', 'plant_bush', 'statue_block', 'flower_yellowA'],
      smallScale: [2.0, 3.0],
      guardian: 'statue_head',
      extra: ['statue_column', 'statue_obelisk'],
      topTint: 0x8fbf6a, cliffTint: 0xb9b2c8, waterTint: 0x2b8fd6
    },
    3: { // Level 9: Sky Garden (flowers, columns, the Crystal Sphinx)
      features: ['tree_oak', 'tree_fat', 'statue_column', 'tree_detailed'],
      featureScale: [3.0, 3.8],
      small: ['flower_purpleA', 'flower_purpleB', 'flower_redA', 'flower_yellowA', 'plant_bushLarge', 'lily_large', 'grass_large'],
      smallScale: [2.0, 3.0],
      guardian: 'statue_ring',
      extra: ['statue_columnDamaged', 'statue_obelisk'],
      topTint: 0x6fbf5a, cliffTint: 0xcfc6e6, waterTint: 0x8b7cf6
    }
  };
  const KENNEY_COLOURS = {
    leafsGreen: 0x3f9e3c, leafsDark: 0x2a6e45, leafsFall: 0xd9822b,
    grass: 0x57a843, dirt: 0x8d6e4c,
    woodBark: 0x7a4f2a, woodBarkDark: 0x5c3b20, wood: 0x9a6a3a, woodDark: 0x6e4a2a,
    stone: 0xaab4bb, stoneDark: 0x7f8a92,
    woodBirch: 0xe6d8c0
  };
  const modelTpl = {};
  let MODELS_OK = false;
  let swayers = [];
  let flowingWaters = [];

  function loadModels() {
    if (!/^https?:$/.test(location.protocol) || !THREE.GLTFLoader) return Promise.resolve(false);
    const names = new Set();
    Object.values(WORLD_SCENERY).forEach(w => {
      w.features.concat(w.small, [w.guardian], w.extra || []).forEach(n => names.add(n));
    });
    const loader = new THREE.GLTFLoader();
    return Promise.all([...names].map(n => new Promise(res => {
      loader.load(MODELS_BASE + n + '.glb', gltf => {
        gltf.scene.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            // glTF defaults to fully metallic, which renders near-black without an env map
            mats.forEach(m => {
              if (!m || !('metalness' in m)) return;
              m.metalness = 0;
              m.roughness = 0.85;
              // Natural colours for Kenney's pastel palette (by material name)
              const nice = KENNEY_COLOURS[m.name];
              if (nice !== undefined && m.color) m.color.setHex(nice);
            });
          }
        });
        modelTpl[n] = gltf.scene;
        res(true);
      }, undefined, () => res(false));
    }))).then(r => {
      MODELS_OK = r.filter(Boolean).length >= names.size * 0.8;
      return MODELS_OK;
    });
  }

  function placeModel(name, x, y, z, scale, rotY = Math.random() * Math.PI * 2) {
    if (!modelTpl[name]) return null;
    const m = modelTpl[name].clone(true);
    m.scale.setScalar(scale);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    worldGroup.add(m);
    return m;
  }

  // Seeded random so each world looks the same every time it loads
  let _seed = 1;
  function srand(s) { _seed = s; }
  function rnd() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function range(a, b) { return a + rnd() * (b - a); }

  // ---- Procedural textures (no image files needed) ----
  const _texCache = {};
  function noiseTexture(kind) {
    if (_texCache[kind]) return _texCache[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    if (kind === 'grass') {
      for (let i = 0; i < 2600; i++) {
        const v = 150 + Math.floor(Math.random() * 105);
        g.fillStyle = `rgb(${v},${v},${v})`;
        const x = Math.random() * 256, y = Math.random() * 256;
        g.fillRect(x, y, 2, 3 + Math.random() * 4);
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(120,120,120,0.18)';
        g.beginPath();
        g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 14, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === 'rock') {
      for (let i = 0; i < 900; i++) {
        const v = 150 + Math.floor(Math.random() * 105);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 10, 2 + Math.random() * 5);
      }
      g.strokeStyle = 'rgba(90,90,90,0.35)';
      g.lineWidth = 2;
      for (let y = 32; y < 256; y += 40 + Math.random() * 20) {
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + (Math.random() - 0.5) * 10);
        g.stroke();
      }
    } else if (kind === 'planks') {
      for (let y = 0; y < 256; y += 32) {
        const v = 190 + Math.floor(Math.random() * 50);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(0, y, 256, 30);
        g.fillStyle = 'rgba(80,60,40,0.55)';
        g.fillRect(0, y + 30, 256, 2);
        g.fillStyle = 'rgba(80,60,40,0.35)';
        g.fillRect(20 + Math.random() * 200, y + 12, 4, 4);
      }
    } else if (kind === 'water') {
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#e0f7ff'); grd.addColorStop(1, '#ffffff');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(160,220,255,${0.25 + Math.random() * 0.4})`;
        g.fillRect(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 6, 30 + Math.random() * 90);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    _texCache[kind] = t;
    return t;
  }

  function texturedMat(kind, color, w, d) {
    const t = noiseTexture(kind).clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, w / 3), Math.max(1, d / 3));
    return new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.85 });
  }

  // Called by addPlatform to dress the top and cliff with texture
  function dressPlatform(group, topMesh, baseMesh, w, d, colorHex, worldId) {
    const sc = WORLD_SCENERY[worldId] || WORLD_SCENERY[1];
    topMesh.material = texturedMat('grass', colorHex, w, d);
    baseMesh.material = texturedMat('rock', sc.cliffTint, w, 2);
  }

  function makePlanks(plat) {
    const top = plat.mesh.children[0];
    top.material = texturedMat('planks', 0xd29a62, 2, 3);
    if (plat.mesh.children[1]) plat.mesh.children[1].material = texturedMat('planks', 0x9c6b3c, 2, 1);
  }

  function addWaterfall(x, y, z, h, rotY) {
    const mat = new THREE.MeshBasicMaterial({
      map: noiseTexture('water').clone(), color: 0x9fe7ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false
    });
    mat.map.needsUpdate = true;
    mat.map.repeat.set(1, 2);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, h), mat);
    fall.position.set(x, y + h / 2 - 0.3, z);
    fall.rotation.y = rotY;
    worldGroup.add(fall);
    flowingWaters.push(mat.map);
    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(x, y + 0.06, z + 0.2);
    worldGroup.add(foam);
  }

  // Replaces the old block trees / towers with Kenney models
  function addKenneyFeature(worldDef, x, y, z, index) {
    const sc = WORLD_SCENERY[worldDef.id];
    const name = sc.features[index % sc.features.length];
    const s = range(sc.featureScale[0], sc.featureScale[1]);
    const m = placeModel(name, x, y, z, s);
    if (m && name.startsWith('tree')) swayers.push({ obj: m, phase: rnd() * 6 });
    if (sc.waterfall && index % 2 === 0) {
      // tall rock with a flowing waterfall in front of it
      const rock = placeModel('stone_tallA', x, y, z - 0.6, 4.2, 0);
      if (rock) addWaterfall(x, y, z + 0.9, 4.0, 0);
    }
    // a few small props around the feature
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2, r = range(0.9, 1.6);
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (Math.abs(nx) < 2.6) continue; // keep the centre path clear
      placeModel(pick(sc.small.filter(n => n !== 'lily_large')), nx, y, nz, range(sc.smallScale[0], sc.smallScale[1]));
    }
  }

  // Scatter flowers, grass and rocks along the island edges
  function decorateIsland(worldDef, islandZ, w, d, topY) {
    const sc = WORLD_SCENERY[worldDef.id];
    const n = COMPACT ? 5 : 14;
    for (let k = 0; k < n; k++) {
      const sideSign = k % 2 === 0 ? -1 : 1;
      const x = sideSign * range(w / 2 - 1.4, w / 2 - 0.35);
      const z = islandZ + range(-d / 2 + 0.6, d / 2 - 0.6);
      const name = pick(sc.small.filter(n => n !== 'lily_large' && n !== 'log_large' && n !== 'log_stack'));
      placeModel(name, x, topY, z, range(sc.smallScale[0], sc.smallScale[1]));
    }
    if (sc.small.includes('lily_large')) {
      for (let k = 0; k < 6; k++) {
        placeModel('lily_large', range(-12, 12), -4.1, islandZ + range(-8, 8), range(3, 5));
      }
    }
  }

  function makeGuardianModel(worldId) {
    const sc = WORLD_SCENERY[worldId];
    if (!MODELS_OK || !modelTpl[sc.guardian]) return null;
    const g = modelTpl[sc.guardian].clone(true);
    g.scale.setScalar(sc.guardian === 'statue_head' ? 1.6 : 2.2);
    return g;
  }

  function animateScenery(dt, elapsed) {
    for (const s of swayers) {
      s.obj.rotation.z = Math.sin(elapsed * 1.2 + s.phase) * 0.025;
    }
    updateSphinx(dt, elapsed);
    animateLanterns(elapsed);
    animateBookPages(dt);
    for (const t of flowingWaters) {
      t.offset.y += dt * (t.isCloud ? 0.05 : 1.4);
    }
  }

  // -------------------------------------------------------------------
  // Reading-quest set pieces:
  //   Level 7 Lantern Library : bookshelves + hanging lanterns
  //   Level 8 Ruins of Riddles: broken columns, stone blocks, "?" riddle stones
  //   Level 9 Sky Garden      : column ring, flowers + the Crystal Sphinx
  // -------------------------------------------------------------------
  let lanterns = [];
  const OWL_H = 2.05;
  const SPINE_COLOURS = ['#7c3aed', '#b45309', '#0e7490', '#be123c', '#15803d', '#a16207', '#1d4ed8', '#9d174d', '#4d7c0f'];
  let shelfTex = null;

  function makeShelfTexture() {
    if (shelfTex) return shelfTex;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = '#5b3a1e'; g.fillRect(0, 0, 256, 320);
    const rows = 4, rowH = 320 / rows;
    let seed = 7;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < rows; k++) {
      const top = k * rowH + 8, bottom = (k + 1) * rowH - 10;
      g.fillStyle = '#2b1a0c'; g.fillRect(10, top, 236, bottom - top);
      let x = 14;
      while (x < 238) {
        const w = 10 + r() * 14;
        const h = (bottom - top) * (0.72 + r() * 0.26);
        g.fillStyle = SPINE_COLOURS[Math.floor(r() * SPINE_COLOURS.length)];
        g.fillRect(x, bottom - h, Math.min(w, 240 - x), h);
        g.fillStyle = 'rgba(253,230,138,.85)';
        g.fillRect(x + 2, bottom - h + 8, Math.max(2, Math.min(w, 240 - x) - 4), 3);
        x += w + 1.5;
      }
      g.fillStyle = '#8a5a2b'; g.fillRect(0, bottom, 256, 10);
    }
    g.strokeStyle = '#3d2410'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 310);
    shelfTex = new THREE.CanvasTexture(c);
    return shelfTex;
  }

  function addBookshelf(x, y, z, rotY) {
    return; // writing world: no bookshelves
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
    const front = new THREE.MeshStandardMaterial({ map: makeShelfTexture(), roughness: 0.85 });
    // BoxGeometry faces: +x, -x, +y, -y, +z (front), -z
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.55), [wood, wood, wood, wood, front, wood]);
    shelf.position.set(x, y + 1.4, z);
    shelf.rotation.y = rotY;
    worldGroup.add(shelf);
  }

  function addLantern(x, y, z, h) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 8), new THREE.MeshStandardMaterial({ color: 0x3f2a14 }));
    post.position.set(x, y + h / 2, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: 0x3f2a14 }));
    arm.position.set(x + 0.3, y + h - 0.05, z);
    const lamp = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0x7c2d12 }));
    cap.position.y = 0.32; cap.rotation.y = Math.PI / 4;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.22, depthWrite: false }));
    lamp.add(glass, cap, halo);
    lamp.position.set(x + 0.58, y + h - 0.42, z);
    worldGroup.add(post, arm, lamp);
    lanterns.push({ obj: lamp, halo, phase: rnd() * 6 });
  }

  function riddleStone(x, y, z) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(15,23,42,.85)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#67e8f9'; g.stroke();
    g.fillStyle = '#67e8f9'; g.font = 'bold 84px Fredoka, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(buildingWorldId === 1 ? '✎' : (buildingWorldId === 2 ? '✉' : '✒'), 64, 70);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    s.scale.set(0.9, 0.9, 1);
    s.position.set(x, y, z);
    worldGroup.add(s);
    lanterns.push({ obj: s, halo: null, phase: rnd() * 6, float: y });
  }

  function addLevelSetPiece(worldDef, i, islandZ) {
    const y = 0.8;
    if (worldDef.id === 1) {
      // Lantern Library: bookshelves along both sides + lanterns
      addBookshelf(-4.9, y, islandZ - 0.4, Math.PI / 2);
      addLantern(3.4, y, islandZ - 3.6, 2.6);
      if (!COMPACT) {
        addBookshelf(-4.7, y, islandZ + 2.2, Math.PI / 2);
        addBookshelf(4.7, y, islandZ + 2.6, -Math.PI / 2);
        addLantern(-3.4, y, islandZ - 3.6, 2.6);
        placeModel('log_stack', 4.0, y, islandZ - 1.0, 2.2, 0.3);
      }
    } else if (worldDef.id === 2) {
      // Ruins of Riddles: broken columns, blocks and floating riddle stones
      (COMPACT ? [[-4.8, -1.6], [4.8, -2.2]] : [[-4.6, 2.8], [-4.4, -1.6], [4.5, 3.0], [4.7, -2.2]]).forEach(([x, dz], k) => {
        placeModel(k % 2 ? 'statue_column' : 'statue_columnDamaged', x, y, islandZ + dz, 3.6, 0);
      });
      riddleStone(-4.5, y + 3.9, islandZ - 1.6);
      if (!COMPACT) {
        placeModel('statue_block', -3.4, y, islandZ + 4.3, 1.6, 0.4);
        placeModel('statue_block', 3.6, y, islandZ - 4.0, 1.4, 1.1);
        riddleStone(4.5, y + 4.1, islandZ + 3.0);
      }
    } else {
      // Sky Garden: a ring of columns around each island
      const n = COMPACT ? 6 : 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.3;
        const x = Math.cos(a) * 4.75;
        const z = islandZ + Math.sin(a) * 5.4;
        if (Math.abs(x) < 2.6) continue; // keep the path and bridges open
        if (i === worldDef.challenges.length - 1 && x > 0 && Math.abs(z - islandZ) < 2.5) continue; // sphinx's side
        placeModel(k % 3 === 0 ? 'statue_columnDamaged' : 'statue_column', x, y, z, 3.6, 0);
      }
      if (i === worldDef.challenges.length - 1) addSphinx(islandZ);
    }
  }

  function addFinalSetPiece(worldDef, finalZ) {
    const y = 1.0;
    if (worldDef.id === 1) {
      addBookshelf(-4.4, y, finalZ + 0.8, Math.PI / 2);
      addBookshelf(4.4, y, finalZ + 0.8, -Math.PI / 2);
      addLantern(-2.9, y, finalZ + 3.6, 2.8);
      addLantern(2.6, y, finalZ + 3.6, 2.8);
    } else if (worldDef.id === 2) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = Math.cos(a) * 5.2, z = finalZ + Math.sin(a) * 5.2;
        if (z > finalZ + 3.5 && Math.abs(x) < 2.8) continue;
        placeModel(k % 3 === 0 ? 'statue_obelisk' : 'statue_columnDamaged', x, y, z, k % 3 === 0 ? 4.2 : 3.8, 0);
      }
      riddleStone(0, y + 4.6, finalZ - 3.6);
    } else {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const x = Math.cos(a) * 5.2, z = finalZ + Math.sin(a) * 5.2;
        if (z > finalZ + 3.5 && Math.abs(x) < 2.8) continue;
        placeModel(k % 4 === 0 ? 'statue_obelisk' : 'statue_column', x, y, z, k % 4 === 0 ? 4.4 : 4.6, 0);
      }
    }
  }

  function animateLanterns(elapsed) {
    for (const l of lanterns) {
      if (l.float !== undefined) {
        l.obj.position.y = l.float + Math.sin(elapsed * 1.6 + l.phase) * 0.18;
        continue;
      }
      l.obj.rotation.z = Math.sin(elapsed * 1.4 + l.phase) * 0.08;
      if (l.halo) l.halo.material.opacity = 0.18 + Math.sin(elapsed * 5 + l.phase) * 0.06;
    }
  }

  // -------------------------------------------------------------------
  // LEVEL 9 CRYSTAL SPHINX
  // Sits beside the last island. It roars (warning: the ground glows
  // purple), then sends a magic beam across the path for about 2 seconds.
  // Wait, then run past. Touching the beam costs a heart and returns the
  // hero to the checkpoint. It never reacts to reading mistakes; while a
  // student reads, it just sits and thinks. Finishing the last book calms
  // it and it flies away.
  // -------------------------------------------------------------------
  let sphinx = null;
  const SPHINX_H = 3.0;

  function addSphinx(islandZ) {
    if (!ART_OK || !artTex.golem_idle) return;
    const sp = makeSprite('golem_idle', SPHINX_H, 0.5);
    const baseX = COMPACT ? 5.2 : 6.4, baseY = 2.6, z = islandZ + 0.6;
    sp.position.set(baseX, baseY, z);
    worldGroup.add(sp);

    const mk = (r, color, opacity) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 11, 18, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
      );
      m.rotation.z = Math.PI / 2;
      m.position.set(baseX - 6.4, 1.55, z);
      m.visible = false;
      worldGroup.add(m);
      return m;
    };
    const beam = mk(0.8, 0x3b0764, 0.75);
    const core = mk(0.32, 0x7c3aed, 0.9);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x581c87, transparent: true, opacity: 0, depthWrite: false })
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.84, z);
    worldGroup.add(strip);
    sphinx = { sprite: sp, beam, core, strip, baseX, baseY, z, mode: 'idle', t: 0, warned: false, pose: '', flip: null };
  }

  function sphinxPose(name, flip) {
    if (!sphinx) return;
    if (sphinx.pose === name && sphinx.flip === flip) return;
    const base = artTex['golem_' + (name === 'magic' ? 'attack' : name)] || artTex.golem_idle;
    sphinx.sprite.material.map = flip ? flippedTex(base) : base;
    sphinx.sprite.material.needsUpdate = true;
    setSpriteSize(sphinx.sprite, base, SPHINX_H);
    sphinx.pose = name;
    sphinx.flip = flip;
  }

  function setSphinxBeam(on) {
    sphinx.beam.visible = sphinx.core.visible = on;
  }

  function updateSphinx(dt, elapsed) {
    if (!sphinx) return;
    const d = sphinx;
    d.t += dt;
    const busy = !state.isPlaying || state.isPaused || state.isListeningModalOpen;

    if (d.mode === 'calm') {
      sphinxPose('happy', true);
      d.sprite.position.y = d.baseY + Math.sin(elapsed * 2) * 0.06;
      if (d.t > 2.8) { d.mode = 'leave'; d.t = 0; }
      return;
    }
    if (d.mode === 'leave') {
      sphinxPose('fly', false);
      d.sprite.position.x += dt * 7;
      d.sprite.position.y += dt * 3.2;
      d.sprite.material.opacity = Math.max(0, 1 - d.t / 3.5);
      if (d.t > 3.6) {
        worldGroup.remove(d.sprite, d.beam, d.core, d.strip);
        sphinx = null;
      }
      return;
    }

    d.sprite.position.y = d.baseY + Math.sin(elapsed * 1.6) * 0.1;

    if (busy) {
      d.mode = 'idle'; d.t = 0;
      setSphinxBeam(false);
      d.strip.material.opacity = 0;
      sphinxPose(state.isListeningModalOpen ? 'think' : 'idle', true);
      return;
    }

    if (d.mode === 'idle') {
      sphinxPose('idle', true);
      setSphinxBeam(false);
      d.strip.material.opacity = 0;
      if (d.t > 3.2) { d.mode = 'roar'; d.t = 0; }
    } else if (d.mode === 'roar') {
      sphinxPose('roar', true);
      d.strip.material.opacity = 0.16 + Math.abs(Math.sin(elapsed * 10)) * 0.2;
      if (!d.warned && Math.abs(player.pos.z - d.z) < 9) {
        d.warned = true;
        showToast('📜 The Writer’s Block Golem roars! Wait for the ink blast to stop, then run past.');
      }
      if (d.t > 1.1) { d.mode = 'magic'; d.t = 0; playSfx('damage'); }
    } else if (d.mode === 'magic') {
      sphinxPose('magic', true);
      setSphinxBeam(true);
      const pulse = 0.85 + Math.sin(elapsed * 28) * 0.12;
      d.beam.scale.set(pulse, 1, pulse);
      d.beam.position.z = d.core.position.z = d.strip.position.z = d.sprite.position.z;
      d.strip.material.opacity = 0.35;
      if (player.invulnerableTimer <= 0 && player.pos.x < d.baseX - 0.5 &&
          Math.abs(player.pos.z - d.sprite.position.z) < 1.25 && player.pos.y < 3.4) {
        takePlayerDamage('🖋️ Splat! Wait for the Golem’s ink blast to stop.');
      }
      if (d.t > 1.8) { d.mode = 'idle'; d.t = 0; }
    }
  }

  function calmSphinx(silent) {
    if (!sphinx) return;
    setSphinxBeam(false);
    sphinx.strip.material.opacity = 0;
    if (silent) {
      worldGroup.remove(sphinx.sprite, sphinx.beam, sphinx.core, sphinx.strip);
      sphinx = null;
      return;
    }
    sphinx.mode = 'calm';
    sphinx.t = 0;
    sphinx.sprite.material.transparent = true;
    setTimeout(() => showToast('📜💜 Your essay broke the Writer’s Block! The Golem turns into paper birds and flies away.'), 1200);
  }

  // -------------------------------------------------------------------
  // BOOK BRIDGES
  // Each bridge is a giant open book made of one "page" per question.
  // A page flips down into place every time a question is answered,
  // so students can see the bridge growing. It can be walked on only
  // when the whole book is open (all questions answered).
  // -------------------------------------------------------------------
  let bookPages = [];
  const BOOK_COVERS = { 1: 0x9a6a3a, 2: 0x8a5a2b, 3: 0x6b21a8 };
  let pageTex = null;

  function makePageTexture() {
    if (pageTex) return pageTex;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#fbf3dc'; g.fillRect(0, 0, 512, 256);
    // gutter shadow in the middle (the spine runs along the bridge)
    const gr = g.createLinearGradient(226, 0, 286, 0);
    gr.addColorStop(0, 'rgba(120,90,40,0)'); gr.addColorStop(0.5, 'rgba(120,90,40,.45)'); gr.addColorStop(1, 'rgba(120,90,40,0)');
    g.fillStyle = gr; g.fillRect(226, 0, 60, 256);
    // lines of "text" on both pages
    g.fillStyle = 'rgba(60,40,80,.85)';
    let seed = 11;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (const x0 of [30, 296]) {
      for (let y = 26; y < 236; y += 19) {
        let x = x0;
        while (x < x0 + 180) {
          const w = 14 + r() * 34;
          g.fillRect(x, y, Math.min(w, x0 + 186 - x), 8);
          x += w + 7;
        }
      }
    }
    pageTex = new THREE.CanvasTexture(c);
    pageTex.anisotropy = 4;
    return pageTex;
  }

  function makeBookBridge(plat, nPages) {
    // hide the plank look, keep the platform for collisions
    plat.mesh.children.forEach(ch => { ch.visible = false; });
    const cover = new THREE.MeshStandardMaterial({ color: BOOK_COVERS[buildingWorldId] || 0x7c2d12, roughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.35, metalness: 0.2 });
    const paper = new THREE.MeshStandardMaterial({ map: makePageTexture(), color: 0xcfc3a3, roughness: 0.95 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xc9b98f, roughness: 0.9 });
    const segD = plat.d / nPages;
    const pages = [];
    for (let k = 0; k < nPages; k++) {
      const pivot = new THREE.Group();
      // pivot on the island side (+z) edge of this page, pages run towards -z
      pivot.position.set(0, plat.h * 0.12, plat.d / 2 - k * segD);
      const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(plat.w + 0.7, 0.2, segD), cover);
      coverMesh.position.set(0, -0.08, -segD / 2);
      const block = new THREE.Mesh(new THREE.BoxGeometry(plat.w, 0.24, segD - 0.04), [edge, edge, paper, edge, edge, edge]);
      block.position.set(0, 0.08, -segD / 2);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, segD), gold);
      trim.position.set(0, 0.22, -segD / 2);
      pivot.add(coverMesh, block, trim);
      pivot.rotation.x = -Math.PI / 2; // standing up, waiting to flip down
      pivot.visible = false;
      plat.mesh.add(pivot);
      const pg = { obj: pivot, t: 0, open: false };
      pages.push(pg);
      bookPages.push(pg);
    }
    plat.book = pages;
  }

  function makeFloatingBook(plat) {
    plat.mesh.children.forEach(ch => { ch.visible = false; });
    const cover = new THREE.MeshStandardMaterial({ color: BOOK_COVERS[buildingWorldId] || 0x7c2d12, roughness: 0.6 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xf1e3bd, roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.35, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(plat.w * 0.96, plat.h * 0.5, plat.d * 0.92), [edge, cover, cover, cover, edge, edge]);
    body.position.y = plat.h * 0.12;
    const top = new THREE.Mesh(new THREE.BoxGeometry(plat.w, 0.1, plat.d), cover);
    top.position.y = plat.h * 0.42;
    const bottom = top.clone();
    bottom.position.y = -plat.h * 0.18;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), gold);
    star.scale.set(1, 0.18, 1);
    star.position.y = plat.h * 0.48;
    plat.mesh.add(body, top, bottom, star);
  }

  // Show pages 1..count of a crystal's bridge (flip animation)
  function openBridgePages(crystalObj, count) {
    const plat = crystalObj && crystalObj.bridgePlat;
    if (!plat || !plat.book) return;
    plat.mesh.visible = true;
    plat.book.forEach((pg, k) => {
      if (k < count && !pg.open) {
        pg.open = true;
        pg.obj.visible = true;
        pg.t = -k * 0.12; // small stagger when several open together
      }
    });
  }

  function animateBookPages(dt) {
    for (const pg of bookPages) {
      if (!pg.open || pg.t >= 1) continue;
      pg.t = Math.min(1, pg.t + dt * 1.8);
      const e = Math.max(0, pg.t);
      const ease = 1 - Math.pow(1 - e, 3);
      pg.obj.rotation.x = -Math.PI / 2 * (1 - ease) + Math.sin(ease * Math.PI) * 0.08;
    }
  }

  let buildingWorldId = 1;
  function buildWorld(worldId) {
    clearWorld();
    const worldDef = WORLDS.find(w => w.id === worldId) || WORLDS[0];
    buildingWorldId = worldDef.id;
    srand(worldDef.id * 1000 + 7);

    scene.background = new THREE.Color(worldDef.skyColor);
    setBackdrop(worldDef.id);
    scene.fog = new THREE.FogExp2(worldDef.fogColor, 0.006);

    // Shimmering Crystal River / Sky Sea Plane below the islands
    waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 320, 24, 24),
      new THREE.MeshBasicMaterial({ map: cloudSeaTexture(worldDef.id), transparent: true, opacity: 0.92, fog: false })
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, -6.5, -90);
    flowingWaters.push(waterMesh.material.map);
    worldGroup.add(waterMesh);

    // Fluffy 3D Clouds in the Sky
    for (let c = 0; c < 18; c++) {
      addCloud(
        (Math.random() - 0.5) * 75,
        12 + Math.random() * 10,
        20 - c * 14,
        0.9 + Math.random() * 0.8
      );
    }

    // Reset level counters
    state.hearts = 3;
    state.levelScore = 0;
    state.coinsCollected = 0;
    state.chestsCollected = 0;
    state.challengesSolved = 0;
    state.firstAttemptCorrectCount = 0;
    state.levelLog = [];
    state.currentCheckpoint = { x: 0, y: 1.5, z: 4.5 };

    const numChallenges = worldDef.challenges.length;
    let curZ = 0;
    let coinsPlaced = 0;
    const coinsPerSegment = Math.floor(worldDef.totalCoins / numChallenges);

    for (let i = 0; i < numChallenges; i++) {
      const ch = worldDef.challenges[i];
      const islandZ = curZ;

      // Main Sunlit Island Platform
      addPlatform(0, 0, islandZ, 10.5, 1.6, 12.0, worldDef.groundColor);
      if (MODELS_OK) decorateIsland(worldDef, islandZ, 10.5, 12.0, 0.8);
      addLevelSetPiece(worldDef, i, islandZ);

      // Decorative Trees / Waterfalls / Astral Towers on Island Edges
      addDecorativeScenery(worldDef, -4.1, 0.8, islandZ - 2.2, i);
      addDecorativeScenery(worldDef, 4.1, 0.8, islandZ + 2.2, i + 1);

      // Bouncy Giant Red Mushroom Pad on side of island for fun high jumps!
      addBouncyMushroom(-3.2, 0.8, islandZ + 1.2);

      // Checkpoint at start of each island
      addCheckpoint(0, 0.8, islandZ + 3.5);
      if (!COMPACT) addProp('item_signpost', 3.4, 0.8, islandZ + 4.4, 1.3);

      // Crystal Coins along the island
      for (let c = 0; c < coinsPerSegment && coinsPlaced < worldDef.totalCoins; c++) {
        const cx = ((c % 3) - 1) * 2.0;
        const cz = islandZ + 2.2 - c * 1.4;
        addCoin(cx, 1.55, cz);
        coinsPlaced++;
      }

      // Cute Patrolling Critter
      const enemyTypes = ['inkling'];
      const eType = enemyTypes[i % enemyTypes.length];
      if (!(worldDef.id === 3 && i === numChallenges - 1)) {
      const eMesh = createCuteEnemyMesh(eType);
      const eZ = islandZ + 0.2;
      eMesh.position.set(0, 0.8, eZ);
      worldGroup.add(eMesh);
      enemies.push({
        mesh: eMesh,
        type: eType,
        baseX: 0,
        y: 0.8,
        z: eZ,
        range: 3.0,
        speed: 1.3 + worldDef.id * 0.2,
        phase: i * 1.3,
        hitT: 0
      });
      }

      // Hidden Treasure Chests on bonus side islands
      const chestIndices = worldDef.chestIndices || [];
      if (chestIndices.includes(i)) {
        const sideX = (i % 2 === 0) ? -7.6 : 7.6;
        addPlatform(sideX * 0.55, 0.4, islandZ, 2.8, 1.0, 2.8, worldDef.platformColor);
        addPlatform(sideX, 0.7, islandZ, 3.8, 1.2, 3.8, worldDef.platformColor);
        addTreasureChest(sideX, 1.3, islandZ);
      }

      // Glowing Listening Crystal Pedestal + 3D NPC Guardian at north (-Z) edge
      const crystalZ = islandZ - 4.4;
      const crystalGroup = new THREE.Group();
      crystalGroup.position.set(0, 0.8, crystalZ);

      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.95, 0.55, 14),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
      );
      ped.position.y = 0.28;

      const gem = (ART_OK && artTex.item_anvil_dim) ? makeSprite('item_anvil_dim', 1.9, 0) : makeAnvilMesh();
      gem.position.y = 0.02;
      ped.visible = false;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.07, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.32;

      // Friendly 3D Guardian standing right next to the Listening Crystal
      const guardianMesh = createGuardianNPC(worldDef.id, i);
      guardianMesh.position.set(1.45, 0, 0.2);
      guardianMesh.rotation.y = -0.4;

      crystalGroup.add(ped, gem, ring, guardianMesh);
      worldGroup.add(crystalGroup);

      // Locked Golden Rope/Crystal Bridge + Moving Platform linking to the next island
      const bridgeZ = islandZ - 8.5;
      const bridgePlat = addPlatform(0, 0.1, bridgeZ, 4.6, 0.7, 5.6, 0xfbbf24);
      bridgePlat.active = false;
      bridgePlat.mesh.visible = false;
      makePlanks(bridgePlat);
      makeBookBridge(bridgePlat, ch.questions.length || 3);

      const movePlatZ = islandZ - 13.4;
      const moveSpec = {
        axis: (i % 2 === 0) ? 'x' : 'y',
        amp: (i % 2 === 0) ? 2.4 : 1.0,
        speed: 1.4 + worldDef.id * 0.18,
        phase: i
      };
      // Locked too, so the gap cannot be jumped before the crystal is solved
      const movePlat = addPlatform(0, 0.2, movePlatZ, 4.4, 0.8, 4.4, worldDef.platformColor, true, moveSpec);
      movePlat.active = false;
      movePlat.mesh.visible = false;
      makeFloatingBook(movePlat);

      listeningCrystals.push({
        id: ch.id,
        index: i,
        challenge: ch,
        group: crystalGroup,
        gem,
        ring,
        guardianMesh,
        x: 0,
        y: 0.8,
        z: crystalZ,
        solved: false,
        bridgePlat,
        movePlat
      });

      curZ -= 21.0; // wider gap between islands
    }

    // Final Sanctuary Island + Portal
    const finalZ = curZ;
    addPlatform(0, 0.2, finalZ, 11.5, 1.6, 11.5, worldDef.groundColor);
    while (coinsPlaced < worldDef.totalCoins) {
      const ang = (coinsPlaced / 8) * Math.PI * 2;
      addCoin(Math.cos(ang) * 3.4, 1.7, finalZ + Math.sin(ang) * 3.4);
      coinsPlaced++;
    }

    addFinalSetPiece(worldDef, finalZ);
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 1.0, finalZ - 2.4);
    const portalArt = artTex.item_portal_ink ? 'item_portal_ink' : ['item_portal_green', 'item_portal_blue', 'item_portal_purple'][worldDef.id - 1];
    if (ART_OK && artTex[portalArt]) {
      const sp = makeSprite(portalArt, 4.4);
      sp.material.opacity = 0.55;
      portalGroup.add(sp);
      worldGroup.add(portalGroup);
      portalObject = { group: portalGroup, vortex: sp, x: 0, y: 1.0, z: finalZ - 2.4, unlocked: false };
    } else {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.35, 12, 28, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    );
    const vortex = new THREE.Mesh(
      new THREE.CircleGeometry(1.95, 28),
      new THREE.MeshBasicMaterial({
        color: worldDef.portalColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
      })
    );
    vortex.position.y = 1.0;
    arch.position.y = 0.2;
    portalGroup.add(arch, vortex);
    worldGroup.add(portalGroup);

    portalObject = {
      group: portalGroup,
      vortex,
      x: 0,
      y: 1.0,
      z: finalZ - 2.4,
      unlocked: false
    };
    }

    // Sunbeams / Floating Firefly Particles
    const pGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let p = 0; p < 50; p++) {
      const pm = new THREE.Mesh(pGeo, pMat);
      pm.position.set(
        (Math.random() - 0.5) * 28,
        1.5 + Math.random() * 7,
        -Math.random() * Math.abs(finalZ - 8)
      );
      worldGroup.add(pm);
      ambientParticles.push({
        mesh: pm,
        baseY: pm.position.y,
        phase: Math.random() * Math.PI * 2
      });
    }

    const heroDef = HEROES.find(h => h.id === state.selectedHeroId) || HEROES[0];
    buildHeroMesh(heroDef);
    respawnAtCheckpoint(false);
    updateHUD();
  }

  function respawnAtCheckpoint(playSound = true) {
    player.pos.set(state.currentCheckpoint.x, state.currentCheckpoint.y + 0.5, state.currentCheckpoint.z);
    player.vel.set(0, 0, 0);
    player.onGround = false;
    if (heroMesh) {
      heroMesh.position.copy(player.pos);
    }
    if (playSound) playSfx('checkpoint');
  }

  // -------------------------------------------------------------------
  // 8. CONTROLS, 360° MOUSE ORBIT & CAMERA VIEW SWITCHER ("SEE YOURSELF")
  // -------------------------------------------------------------------
  const keys = { up: false, down: false, left: false, right: false, jump: false };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'Space') {
      keys.jump = true;
      triggerJump();
    }
    if (e.code === 'KeyE') {
      triggerInteract();
    }
    if (e.code === 'KeyC') {
      cycleCameraMode();
    }
    if (e.code === 'Escape') {
      if (state.isListeningModalOpen) {
        closeListeningModal();
      } else if (state.isPlaying) {
        togglePauseModal();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'Space') keys.jump = false;
  });

  // Mouse / Pointer Drag on 3D Canvas to Orbit 360° Around Hero!
  let isDraggingCam = false;
  let dragStartX = 0;
  container.addEventListener('pointerdown', (e) => {
    isDraggingCam = true;
    dragStartX = e.clientX;
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDraggingCam) return;
    const dx = e.clientX - dragStartX;
    dragStartX = e.clientX;
    state.camOrbitYaw -= dx * 0.008;
  });
  window.addEventListener('pointerup', () => {
    isDraggingCam = false;
  });

  function cycleCameraMode() {
    state.camModeIndex = (state.camModeIndex + 1) % CAM_MODES.length;
    state.camOrbitYaw = 0;
    const mode = CAM_MODES[state.camModeIndex];
    document.getElementById('label-cam-mode').textContent = mode.label;
    showToast(`🎥 Switched to ${mode.label} (Tip: Drag screen to orbit 360° around your hero!)`);
  }

  document.getElementById('btn-hud-cam').addEventListener('click', cycleCameraMode);
  document.getElementById('btn-center-hero').addEventListener('click', () => {
    state.camOrbitYaw = 0;
    showToast('🎥 Camera centered behind hero!');
  });

  // Toggle Hero Mirror card
  document.getElementById('btn-hud-webcam').addEventListener('click', () => {
    const card = document.getElementById('self-mirror-card');
    card.classList.toggle('hidden');
  });

  // Touch directional buttons
  document.querySelectorAll('.touch-dir-btn').forEach(btn => {
    const dir = btn.getAttribute('data-dir');
    const setDir = (val) => { keys[dir] = val; };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); setDir(true); });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); setDir(false); });
    btn.addEventListener('pointerleave', () => setDir(false));
    btn.addEventListener('pointercancel', () => setDir(false));
  });

  document.getElementById('btn-touch-jump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    triggerJump();
  });

  document.getElementById('btn-touch-listen').addEventListener('click', triggerInteract);
  document.getElementById('btn-interact-prompt').addEventListener('click', triggerInteract);

  function triggerJump() {
    if (!state.isPlaying || state.isPaused || state.isListeningModalOpen) return;
    if (player.onGround) {
      player.vel.y = 10.6;
      player.onGround = false;
      setHeroAnimState('jump', 0.55);
      playSfx('jump');
      spawnHeroBurst(8, heroParts.particleColor);
    }
  }

  function spawnHeroBurst(count, colorHex) {
    const geo = new THREE.SphereGeometry(0.09, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex || 0xfbbf24 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(player.pos).add(new THREE.Vector3(0, 0.7, 0));
      worldGroup.add(m);
      trailParticles.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4.5, 1.8 + Math.random() * 3.2, (Math.random() - 0.5) * 4.5),
        life: 0.6
      });
    }
  }

  // -------------------------------------------------------------------
  // 9. INTERACTION & MUET-STYLE READING CHALLENGE WORKFLOW
  // One Reading Crystal = one MUET Reading task (Parts 1-7, simplified).
  // Text on the left, question on the right (stacked on narrow screens).
  // Two tries per question (100 / 50 points). After answering, the evidence
  // is highlighted in the text.
  // -------------------------------------------------------------------
  function findNearestListeningCrystal() {
    let nearest = null;
    let minDist = 3.5;
    for (const lc of listeningCrystals) {
      const dist = Math.hypot(player.pos.x - lc.x, player.pos.z - lc.z);
      if (dist < minDist) {
        minDist = dist;
        nearest = lc;
      }
    }
    return nearest;
  }

  function triggerInteract() {
    if (!state.isPlaying || state.isPaused || state.isListeningModalOpen) return;
    const nearCrystal = findNearestListeningCrystal();
    if (nearCrystal) {
      openListeningModal(nearCrystal);
    } else {
      showToast('Walk up to a glowing Reading Book and the Owl Librarian ahead!');
    }
  }

  function shuffledOrder(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const LETTERS = 'ABCDEFG';
  const rdEl = id => document.getElementById(id);

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Choices shown for a question (as plain strings, in original order)
  function questionChoices(ch, q) {
    if (ch.type === 'gapped') return ch.options;
    if (ch.type === 'sort') return ch.choices;
    if (ch.type === 'match') return ch.texts.map(t => t.label + (t.title ? ': ' + t.title : ''));
    return q.choices;
  }
  function questionText(ch, q) {
    if (ch.type === 'gapped') return `Which sentence (A–G) fits Gap ${q.gap}?`;
    return q.q;
  }
  function usesFixedOrder(ch) {
    return ch.type === 'gapped' || ch.type === 'match' || ch.type === 'sort';
  }

  // Owl Librarian poses (sprite art), if the art is loaded
  function owlPose(crystalObj, name) {
    const g = crystalObj && crystalObj.guardianMesh;
    const sp = g && g.userData.owl;
    if (!sp || !artTex['quilla_' + name]) return;
    sp.material.map = artTex['quilla_' + name];
    sp.material.needsUpdate = true;
    setSpriteSize(sp, artTex['quilla_' + name], OWL_H);
  }

  function openListeningModal(crystalObj) {
    if (crystalObj.challenge.type === 'write') { openWriteModal(crystalObj); return; }
    state.isListeningModalOpen = true;
    state.activeCrystalObj = crystalObj;
    keys.up = keys.down = keys.left = keys.right = false;

    const ch = crystalObj.challenge;
    if (typeof crystalObj.qIndex !== 'number') crystalObj.qIndex = 0;
    if (!crystalObj.orders) {
      crystalObj.orders = ch.questions.map(q => {
        const n = questionChoices(ch, q).length;
        return usesFixedOrder(ch) ? Array.from({ length: n }, (_, i) => i) : shuffledOrder(n);
      });
    }
    if (!crystalObj.filled) crystalObj.filled = {};
    if (crystalObj.solved && crystalObj.qIndex === 0) crystalObj.filled = {}; // review mode starts fresh

    player.pos.set(crystalObj.x - 1.35, crystalObj.y, crystalObj.z + 0.4);
    player.facingAngle = 0.35;
    state.currentCheckpoint = { x: crystalObj.x, y: crystalObj.y, z: crystalObj.z + 2.2 };
    setHeroAnimState('listen', 0);
    owlPose(crystalObj, 'talk');

    const worldDef = WORLDS.find(w => w.id === state.currentWorldId);
    rdEl('rd-badge').textContent = `Anvil ${crystalObj.index + 1} of ${worldDef.challenges.length}`;
    rdEl('rd-part').textContent = 'MUET Writing ' + ch.part + ' • ' + ch.time;
    rdEl('rd-title').textContent = ch.title;
    rdEl('rd-guardian').textContent = '🦉 ' + ch.guardian + (crystalObj.solved ? '  (review mode: no points)' : '');
    rdEl('rd-instructions').textContent = ch.instructions;
    rdEl('modal-listening').classList.toggle('rd-boss', !!ch.boss);

    renderQuestion();
    rdEl('modal-listening').classList.remove('hidden');
    rdEl('rd-text-scroll').scrollTop = 0;
    rdEl('rd-q-scroll').scrollTop = 0;
  }

  // ---- text column ----
  function evidenceList(q) {
    if (!q || !q.evidence) return [];
    return Array.isArray(q.evidence) ? q.evidence : [q.evidence];
  }

  function renderTexts(highlight) {
    const crystalObj = state.activeCrystalObj;
    const ch = crystalObj.challenge;
    const q = ch.questions[crystalObj.qIndex];
    const marks = (highlight || []).map(escHtml);
    let html = '';
    ch.texts.forEach(t => {
      html += '<article class="rd-text-block">';
      if (t.label || t.title) {
        html += '<header>' + (t.label ? `<span class="rd-text-label">${escHtml(t.label)}</span>` : '') +
          (t.title ? `<h4>${escHtml(t.title)}</h4>` : '') + '</header>';
      }
      t.paras.forEach(p => {
        let s = escHtml(p).replace(/\n/g, '<br>');
        marks.forEach(m => {
          const i = s.indexOf(m);
          if (i >= 0) s = s.slice(0, i) + '<mark class="rd-ev">' + m + '</mark>' + s.slice(i + m.length);
        });
        if (ch.type === 'gapped') {
          s = s.replace(/\[(\d)\]/g, (all, n) => {
            const g = Number(n);
            const isNow = q && q.gap === g;
            if (crystalObj.filled[g] !== undefined) {
              const oi = crystalObj.filled[g];
              return `<span class="rd-gap rd-gap-filled${isNow ? ' rd-gap-now' : ''}"><b>${g}</b> ${LETTERS[oi]}. ${escHtml(ch.options[oi])}</span>`;
            }
            return `<span class="rd-gap${isNow ? ' rd-gap-now' : ''}" data-gap="${g}"><b>${g}</b> ……………</span>`;
          });
        }
        html += `<p>${s}</p>`;
      });
      html += '</article>';
    });
    rdEl('rd-text').innerHTML = html;
  }

  function scrollToFirst(selector) {
    const el = rdEl('rd-text').querySelector(selector);
    const box = rdEl('rd-text-scroll');
    if (!el || !box) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 60;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  // ---- question column ----
  function renderQuestion() {
    const crystalObj = state.activeCrystalObj;
    const ch = crystalObj.challenge;
    const q = ch.questions[crystalObj.qIndex];
    state.activeChallengeAttempt = 1;

    rdEl('rd-qnum').textContent = `Question ${crystalObj.qIndex + 1} of ${ch.questions.length} • ${q.skill}`;
    rdEl('rd-question').textContent = questionText(ch, q);
    rdEl('rd-attempt').textContent = crystalObj.solved ? 'Review' : 'Try 1 of 2 (+100 pts)';
    rdEl('rd-feedback').classList.add('hidden');
    rdEl('rd-continue').classList.add('hidden');

    renderTexts([]);
    if (ch.type === 'gapped') scrollToFirst('.rd-gap-now');

    // which gapped options are already used in other gaps
    const usedBy = {};
    if (ch.type === 'gapped') {
      Object.keys(crystalObj.filled).forEach(g => { usedBy[crystalObj.filled[g]] = g; });
    }

    const grid = rdEl('rd-choices');
    grid.innerHTML = '';
    const choices = questionChoices(ch, q);
    crystalObj.orders[crystalObj.qIndex].forEach((origIdx, pos) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.orig = String(origIdx);
      btn.className = 'rd-choice';
      const letter = document.createElement('span');
      letter.className = 'rd-letter';
      letter.textContent = usesFixedOrder(ch) ? LETTERS[origIdx] : LETTERS[pos];
      const text = document.createElement('span');
      text.className = 'rd-choice-text';
      text.textContent = ch.type === 'match' ? choices[origIdx] : choices[origIdx];
      btn.append(letter, text);
      if (usedBy[origIdx] !== undefined) {
        btn.disabled = true;
        btn.classList.add('rd-used');
        const tag = document.createElement('span');
        tag.className = 'rd-used-tag';
        tag.textContent = 'Gap ' + usedBy[origIdx];
        btn.appendChild(tag);
      } else {
        btn.addEventListener('click', () => handleAnswerSelection(origIdx, btn));
      }
      grid.appendChild(btn);
    });
  }

  function revealEvidence(q, correctIdx) {
    const crystalObj = state.activeCrystalObj;
    const ch = crystalObj.challenge;
    if (ch.type === 'gapped') crystalObj.filled[q.gap] = correctIdx;
    const ev = evidenceList(q);
    renderTexts(ev);
    rdEl('rd-evidence').classList.remove('hidden');
    rdEl('rd-evidence-text').textContent = ch.type === 'gapped'
      ? `Gap ${q.gap} = ${LETTERS[correctIdx]}. Clue in the text: “${ev.join('” … “')}”`
      : '“' + ev.join('” … “') + '”';
    setTimeout(() => scrollToFirst('mark.rd-ev'), 60);
  }

  function markButton(btn, kind) {
    btn.classList.remove('rd-right', 'rd-wrong');
    btn.classList.add(kind === 'correct' ? 'rd-right' : 'rd-wrong');
  }

  function logAnswer(q, correct, firstTry, points) {
    const crystalObj = state.activeCrystalObj;
    const ch = crystalObj.challenge;
    const entry = {
      time: new Date().toISOString(),
      student: state.studentName || '',
      group: state.studentClass || '',
      world: WORLDS.find(w => w.id === state.currentWorldId).level || state.currentWorldId,
      clip: ch.part + ': ' + ch.title,
      question: crystalObj.qIndex + 1,
      skill: q.skill,
      correct: correct,
      firstTry: firstTry,
      points: points
    };
    state.levelLog.push(entry);
    try {
      const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
      all.push(entry);
      localStorage.setItem(RESULTS_KEY, JSON.stringify(all.slice(-2000)));
    } catch (e) {}
  }

  function finishQuestion(isLast) {
    const fc = state.activeCrystalObj;
    if (fc && !fc.solved) openBridgePages(fc, fc.qIndex + 1);
    document.querySelectorAll('#rd-choices button').forEach(b => { b.disabled = true; });
    const contBtn = rdEl('rd-continue');
    contBtn.textContent = isLast
      ? (state.activeCrystalObj.solved ? 'Close Review' : '✨ Restore the Book & Continue →')
      : 'Next Question →';
    contBtn.classList.remove('hidden');
    setTimeout(() => contBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80);
  }

  function setFeedback(kind, title, body) {
    const box = rdEl('rd-feedback');
    box.className = 'rd-feedback rd-fb-' + kind;
    rdEl('rd-feedback-title').textContent = title;
    rdEl('rd-feedback-body').textContent = body;
    rdEl('rd-evidence').classList.add('hidden');
  }

  function handleAnswerSelection(selectedIndex, btnEl) {
    const crystalObj = state.activeCrystalObj;
    if (!crystalObj) return;
    const ch = crystalObj.challenge;
    const q = ch.questions[crystalObj.qIndex];
    const isLast = crystalObj.qIndex === ch.questions.length - 1;
    const review = crystalObj.solved;
    setHeroAnimState('answer', 1.2);

    if (selectedIndex === q.correct) {
      playSfx('correct');
      markButton(btnEl, 'correct');
      let pts = 0;
      if (!review) {
        const firstTry = state.activeChallengeAttempt === 1;
        pts = firstTry ? 100 : 50;
        if (firstTry) state.firstAttemptCorrectCount++;
        state.levelScore += pts;
        state.totalScore += pts;
        logAnswer(q, true, firstTry, pts);
      }
      setFeedback('good', pts > 0 ? `✅ Correct! (+${pts} points)` : '✅ Correct!',
        'The highlighted words in the text prove it:');
      revealEvidence(q, q.correct);
      owlPose(crystalObj, 'happy');
      spawnHeroBurst(10, 0xfbbf24);
      finishQuestion(isLast);
      updateHUD();
      return;
    }

    playSfx('wrong');
    markButton(btnEl, 'wrong');
    btnEl.disabled = true;

    if (state.activeChallengeAttempt === 1 && !review) {
      state.activeChallengeAttempt = 2;
      rdEl('rd-attempt').textContent = 'Try 2 of 2 (+50 pts)';
      setFeedback('try', 'Not quite. One more try.', 'Hint: ' + q.hint);
      owlPose(crystalObj, 'point');
      return;
    }

    // Second wrong try (or wrong in review): show the right answer and move on
    document.querySelectorAll('#rd-choices button').forEach(b => {
      if (Number(b.dataset.orig) === q.correct) markButton(b, 'correct');
    });
    if (!review) logAnswer(q, false, false, 0);
    setFeedback('bad', '❌ The correct answer is shown in green.',
      'Read the highlighted words in the text, then continue. No points for this question.');
    revealEvidence(q, q.correct);
    finishQuestion(isLast);
  }

  function completeCrystal(crystalObj) {
    crystalObj.solved = true;
    openBridgePages(crystalObj, 99);
    state.challengesSolved++;
    for (const p of [crystalObj.bridgePlat, crystalObj.movePlat]) {
      if (p) { p.active = true; p.mesh.visible = true; }
    }
    if (crystalObj.gem.isSprite && artTex.item_anvil) {
      crystalObj.gem.material.map = artTex.item_anvil; // forged anvil glows
      setSpriteSize(crystalObj.gem, artTex.item_anvil, 2.0);
      crystalObj.gem.material.needsUpdate = true;
    } else {
      crystalObj.gem.material.color.setHex(0xfbbf24);
      if (crystalObj.gem.material.emissive) crystalObj.gem.material.emissive.setHex(0xf59e0b);
    }
    owlPose(crystalObj, 'point');
    setHeroAnimState('celebrate', 2.8);
    spawnHeroBurst(22, 0xfbbf24);
    playSfx('chest');

    const worldDef = WORLDS.find(w => w.id === state.currentWorldId);
    if (crystalObj.challenge.boss) calmSphinx(false);
    if (state.challengesSolved >= worldDef.challenges.length && portalObject) {
      portalObject.unlocked = true;
      portalObject.vortex.material.opacity = 0.95;
      showToast('🌀 All anvils forged! The portal is open.');
    } else {
      showToast('📜 The scroll bridge is open! Head to the next anvil.');
    }
    updateHUD();
    saveProgress();
  }

  function handleContinue() {
    const crystalObj = state.activeCrystalObj;
    if (!crystalObj) return;
    const total = crystalObj.challenge.questions.length;
    if (crystalObj.qIndex < total - 1) {
      crystalObj.qIndex++;
      owlPose(crystalObj, 'talk');
      renderQuestion();
      rdEl('rd-q-scroll').scrollTop = 0;
      return;
    }
    const wasSolved = crystalObj.solved;
    crystalObj.qIndex = 0;
    hideListeningModal();
    if (!wasSolved) completeCrystal(crystalObj);
  }

  // Step Back / Esc: if the current question is already answered, keep the result
  // (move on, or finish the book) so a question can never be answered twice.
  function closeListeningModal() {
    if (!document.getElementById('modal-write').classList.contains('hidden')) { hideWriteModal(); return; }
    const crystalObj = state.activeCrystalObj;
    const answered = !rdEl('rd-continue').classList.contains('hidden');
    if (crystalObj && answered) {
      const total = crystalObj.challenge.questions.length;
      if (crystalObj.qIndex < total - 1) {
        crystalObj.qIndex++;
      } else if (!crystalObj.solved) {
        crystalObj.qIndex = 0;
        hideListeningModal();
        completeCrystal(crystalObj);
        return;
      } else {
        crystalObj.qIndex = 0;
      }
    }
    hideListeningModal();
  }

  function hideListeningModal() {
    state.isListeningModalOpen = false;
    rdEl('modal-listening').classList.add('hidden');
    const c = state.activeCrystalObj;
    if (c) owlPose(c, c.solved ? 'point' : 'idle');
    if (player.animState === 'listen' || player.animState === 'answer') setHeroAnimState('idle', 0);
  }

  // Text size (saved on this device)
  const RD_SIZES = [0.95, 1.05, 1.18, 1.32];
  let rdSize = 1;
  try { rdSize = Math.min(3, Math.max(0, Number(localStorage.getItem('cq3_text_size') || 1))); } catch (e) {}
  function applyTextSize() {
    rdEl('modal-listening').style.setProperty('--rd-size', RD_SIZES[rdSize] + 'rem');
    try { localStorage.setItem('cq3_text_size', String(rdSize)); } catch (e) {}
    const t = rdEl('toggle-big-text');
    if (t) t.checked = rdSize >= 2;
  }
  rdEl('rd-font-dec').addEventListener('click', () => { rdSize = Math.max(0, rdSize - 1); applyTextSize(); });
  rdEl('rd-font-inc').addEventListener('click', () => { rdSize = Math.min(3, rdSize + 1); applyTextSize(); });
  applyTextSize();

  rdEl('rd-close').addEventListener('click', closeListeningModal);
  rdEl('rd-continue').addEventListener('click', handleContinue);

  // -------------------------------------------------------------------
  // 9b. WRITING ANVILS (MUET 800/4 Task 1 & Task 2)
  // Stage 1 WRITE : stimulus + notes on the left, editor on the right,
  //                 live word count, optional exam timer, sentence frames.
  // Stage 2 CHECK : the student taps a label (note / PEEL part) and then the
  //                 sentence(s) in their own writing that show it, and ticks
  //                 the quality checklist. Nothing is scored automatically.
  //                 The model answer opens only now, colour-coded the same way.
  // Stars: 1 = reached the word target, 2 = every label found, 3 = every check ticked.
  // -------------------------------------------------------------------
  const TAG_COLOURS = ['#f59e0b', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#ef4444', '#84cc16', '#3b82f6'];
  const W = {
    obj: null, ch: null, parts: [], part: 0, stage: 'write',
    texts: [], tagged: {}, activeTag: null, timer: null, timeLeft: 0, timed: false, timeUsed: 0, startedAt: 0
  };
  const wEl = id => document.getElementById(id);
  const DRAFT_KEY = id => 'cq4_draft_' + id;

  function wordCount(t) { const m = String(t || '').trim().match(/[A-Za-z0-9À-ɏ'’-]+/g); return m ? m.length : 0; }

  function partsOf(ch) {
    if (ch.parts) return ch.parts;
    return [{ title: '', rubric: ch.rubric, stimulus: ch.stimulus, notes: ch.notes || [], minWords: ch.minWords, tags: ch.tags }];
  }

  function allTags() {
    const out = [];
    W.parts.forEach((p, pi) => p.tags.forEach(t => out.push({ key: pi + ':' + t.id, part: pi, label: (W.parts.length > 1 ? p.title + ' • ' : '') + t.label })));
    out.forEach((t, i) => { t.colour = TAG_COLOURS[i % TAG_COLOURS.length]; });
    return out;
  }

  function openWriteModal(crystalObj) {
    state.isListeningModalOpen = true;
    state.activeCrystalObj = crystalObj;
    keys.up = keys.down = keys.left = keys.right = false;
    const ch = crystalObj.challenge;
    W.obj = crystalObj; W.ch = ch; W.parts = partsOf(ch); W.part = 0; W.stage = 'write';
    W.activeTag = null; W.tagged = crystalObj.tagged || {};
    // restore draft (kept on this device so a tablet refresh never loses work)
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY(ch.id)) || 'null'); } catch (e) {}
    W.texts = crystalObj.texts || (saved && saved.texts) || W.parts.map(() => '');
    if (!ch.mock && player && crystalObj.x !== undefined) {
      player.pos.set(crystalObj.x - 1.35, crystalObj.y, crystalObj.z + 0.4);
      player.facingAngle = 0.35;
      state.currentCheckpoint = { x: crystalObj.x, y: crystalObj.y, z: crystalObj.z + 2.2 };
    }
    setHeroAnimState('listen', 0);
    owlPose(crystalObj, 'talk');

    const worldDef = WORLDS.find(w => w.id === state.currentWorldId);
    wEl('wr-badge').textContent = ch.mock ? 'Mock paper' : `Anvil ${crystalObj.index + 1} of ${worldDef.challenges.length}`;
    wEl('wr-part').textContent = 'MUET Writing ' + ch.part + ' • ' + ch.time;
    wEl('wr-title').textContent = ch.title;
    wEl('wr-guardian').textContent = '🦊 ' + ch.guardian + (crystalObj.solved ? '  (practise again: no extra points)' : '');
    wEl('modal-write').classList.toggle('rd-boss', !!ch.boss);
    const ex = wEl('wr-exam');
    ex.checked = !!ch.mock;
    ex.disabled = !!ch.mock;
    wEl('wr-exam-label').textContent = `⏱ Exam timing (${ch.examMinutes} min)`;
    stopTimer();
    W.timed = !!ch.mock; W.timeUsed = 0; W.startedAt = Date.now();
    if (W.timed) startTimer(ch.examMinutes * 60);
    else wEl('wr-timer').classList.add('hidden');
    renderWriteLeft();
    showWriteStage('write');
    wEl('modal-write').classList.remove('hidden');
    setTimeout(() => { try { wEl('wr-text').focus({ preventScroll: true }); } catch (e) {} }, 200);
  }

  function renderWriteLeft(showModel) {
    const ch = W.ch;
    const p = W.parts[W.part];
    let h = `<p class="rd-instructions">${escHtml(ch.instructions)}</p>`;
    if (W.parts.length > 1) {
      h += '<div class="wr-tabs">' + W.parts.map((pp, i) =>
        `<button type="button" class="wr-tab${i === W.part ? ' on' : ''}" data-part="${i}">${escHtml(pp.title)} • ${wordCount(W.texts[i])}/${pp.minWords}</button>`).join('') + '</div>';
    }
    h += `<div class="wr-rubric">${escHtml(p.rubric)}</div>`;
    h += `<article class="rd-text-block wr-stim"><header><span class="rd-text-label">${escHtml(p.stimulus.label)}</span></header>` +
      p.stimulus.paras.map(x => `<p>${escHtml(x).replace(/\n/g, '<br>')}</p>`).join('') + '</article>';
    if (p.notes && p.notes.length) {
      h += '<div class="wr-notes"><div class="wr-sub">📌 Notes (use all of them)</div>' +
        p.notes.map((n, i) => `<div class="wr-note"><b>${'①②③④⑤'[i]}</b> ${escHtml(n)}</div>`).join('') + '</div>';
    }
    const helpOk = !ch.mock && !W.timed && W.stage === 'write' && ch.frames && ch.frames.length;
    if (helpOk) {
      h += '<div class="wr-frames"><div class="wr-sub">🧩 Sentence frames (tap to add, then fill the blanks ___)</div>' +
        ch.frames.map((f, i) => `<button type="button" class="wr-frame" data-frame="${i}">${escHtml(f.replace(/\n/g, ' ↵ '))}</button>`).join('') + '</div>';
    } else if (W.timed && W.stage === 'write') {
      h += '<div class="wr-sub wr-examnote">⏱ Exam timing is on: no frames, no model. Plan for 2–3 minutes, then write.</div>';
    }
    if (showModel && ch.model) {
      const tags = allTags();
      const marks = ch.model.marks || {};
      h += '<article class="rd-text-block wr-model"><header><span class="rd-text-label">Model</span><h4>Compare: Quilla’s model answer</h4></header>';
      ch.model.paras.forEach(par => {
        let s = escHtml(par).replace(/\n/g, '<br>');
        tags.forEach(t => {
          const m = marks[t.key.split(':')[1]];
          if (!m) return;
          const em = escHtml(m);
          const i = s.indexOf(em);
          if (i >= 0) s = s.slice(0, i) + `<mark class="wr-mark" style="--c:${t.colour}" title="${escHtml(t.label)}">` + em + '</mark>' + s.slice(i + em.length);
        });
        h += `<p>${s}</p>`;
      });
      h += '<p class="wr-legend">' + tags.filter(t => marks[t.key.split(':')[1]]).map(t => `<span style="--c:${t.colour}">${escHtml(t.label)}</span>`).join('') + '</p></article>';
    }
    wEl('wr-left').innerHTML = h;
    wEl('wr-left').querySelectorAll('.wr-frame').forEach(b => b.addEventListener('click', () => insertFrame(ch.frames[Number(b.dataset.frame)])));
    wEl('wr-left').querySelectorAll('.wr-tab').forEach(b => b.addEventListener('click', () => switchPart(Number(b.dataset.part))));
  }

  function switchPart(i) {
    W.texts[W.part] = wEl('wr-text').value;
    W.part = i;
    wEl('wr-text').value = W.texts[i] || '';
    renderWriteLeft(W.stage === 'check');
    updateWordCount();
  }

  function insertFrame(f) {
    const ta = wEl('wr-text');
    const s = ta.selectionStart || ta.value.length, e = ta.selectionEnd || ta.value.length;
    ta.value = ta.value.slice(0, s) + f + ta.value.slice(e);
    const pos = s + f.length;
    ta.focus();
    try { ta.setSelectionRange(pos, pos); } catch (err) {}
    onWriteInput();
  }

  function onWriteInput() {
    W.texts[W.part] = wEl('wr-text').value;
    updateWordCount();
    clearTimeout(W._save);
    W._save = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY(W.ch.id), JSON.stringify({ texts: W.texts, at: Date.now() })); } catch (e) {}
    }, 600);
  }

  function updateWordCount() {
    const p = W.parts[W.part];
    const n = wordCount(W.texts[W.part]);
    const b = wEl('wr-count');
    b.textContent = `${n} / ${p.minWords}+ words`;
    b.classList.toggle('ok', n >= p.minWords);
    const allOk = W.parts.every((pp, i) => wordCount(W.texts[i]) >= pp.minWords);
    wEl('wr-to-check').classList.toggle('wr-dim', !allOk);
    const tab = wEl('wr-left').querySelector(`.wr-tab[data-part="${W.part}"]`);
    if (tab) tab.textContent = `${p.title} • ${n}/${p.minWords}`;
  }

  function showWriteStage(stage) {
    W.stage = stage;
    wEl('wr-stage-write').classList.toggle('hidden', stage !== 'write');
    wEl('wr-stage-check').classList.toggle('hidden', stage !== 'check');
    if (stage === 'write') {
      wEl('wr-text').value = W.texts[W.part] || '';
      updateWordCount();
      renderWriteLeft(false);
    } else {
      renderWriteLeft(!W.ch.mock);
      renderCheck();
    }
    wEl('wr-right').scrollTop = 0;
  }

  // ---- exam timer ----
  function fmtClock(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function startTimer(sec) {
    stopTimer();
    W.timeLeft = sec;
    const el = wEl('wr-timer');
    el.classList.remove('hidden', 'wr-late');
    el.textContent = '⏱ ' + fmtClock(W.timeLeft);
    W.timer = setInterval(() => {
      W.timeLeft--;
      el.textContent = '⏱ ' + fmtClock(W.timeLeft);
      if (W.timeLeft === 300) showToast('⏱ 5 minutes left. Start your conclusion or closing now.');
      if (W.timeLeft <= 0) {
        el.classList.add('wr-late');
        el.textContent = '⏱ Time’s up';
        showToast('⏱ Time’s up! In the real exam you would stop now. Finish your sentence, then check your work.');
        stopTimer();
      }
    }, 1000);
  }
  function stopTimer() { if (W.timer) clearInterval(W.timer); W.timer = null; }

  wEl('wr-exam').addEventListener('change', e => {
    W.timed = e.target.checked;
    if (W.timed) { startTimer(W.ch.examMinutes * 60); W.startedAt = Date.now(); }
    else { stopTimer(); wEl('wr-timer').classList.add('hidden'); }
    renderWriteLeft(false);
  });

  // ---- check stage ----
  function sentencesOf(text) {
    const out = [];
    // keep abbreviations such as "a.m.", "p.m.", "e.g." and "Dr." inside one sentence
    const safe = String(text || '').replace(/\b(a\.m|p\.m|e\.g|i\.e|etc|Dr|Mr|Mrs|Ms|Prof|No)\./gi, m => m.replace(/\./g, '․'));
    safe.split(/\n/).forEach((line, li) => {
      const parts = line.match(/[^.!?]+[.!?]+["'’”)]*\s*|[^.!?]+$/g) || [];
      parts.forEach(s => { if (s.trim()) out.push({ text: s.trim().replace(/․/g, '.'), para: li }); });
    });
    return out;
  }

  function renderCheck() {
    const tags = allTags();
    if (!W.activeTag || !tags.find(t => t.key === W.activeTag)) W.activeTag = tags[0] && tags[0].key;
    wEl('wr-tags').innerHTML = tags.map(t => {
      const n = (W.tagged[t.key] || []).length;
      return `<button type="button" class="wr-tag${t.key === W.activeTag ? ' on' : ''}${n ? ' done' : ''}" data-tag="${t.key}" style="--c:${t.colour}">` +
        `${n ? '✔' : '○'} ${escHtml(t.label)}</button>`;
    }).join('');
    wEl('wr-tags').querySelectorAll('.wr-tag').forEach(b => b.addEventListener('click', () => { W.activeTag = b.dataset.tag; renderCheck(); }));

    let h = '';
    W.parts.forEach((p, pi) => {
      if (W.parts.length > 1) h += `<div class="wr-sub">${escHtml(p.title)}</div>`;
      const sents = sentencesOf(W.texts[pi]);
      let lastPara = -1;
      h += '<div class="wr-sents"><p>';
      sents.forEach((s, si) => {
        if (lastPara !== -1 && s.para !== lastPara) h += '</p><p>';
        lastPara = s.para;
        const id = pi + ':' + si;
        const owners = tags.filter(t => (W.tagged[t.key] || []).includes(id));
        const style = owners.length ? `style="--c:${owners[0].colour};${owners.length > 1 ? '--c2:' + owners[1].colour : ''}"` : '';
        const labels = owners.map(o => o.label).join(' + ');
        h += `<span class="wr-sent${owners.length ? ' tagged' : ''}" data-sid="${id}" ${style} title="${escHtml(labels)}">${escHtml(s.text)}</span> `;
      });
      h += '</p></div>';
    });
    wEl('wr-sentences').innerHTML = h;
    wEl('wr-sentences').querySelectorAll('.wr-sent').forEach(sp => sp.addEventListener('click', () => {
      if (!W.activeTag) return;
      const arr = W.tagged[W.activeTag] = W.tagged[W.activeTag] || [];
      const i = arr.indexOf(sp.dataset.sid);
      if (i >= 0) arr.splice(i, 1); else arr.push(sp.dataset.sid);
      // move on to the next label that is still empty
      if (i < 0) {
        const next = tags.find(t => !(W.tagged[t.key] || []).length);
        if (next) W.activeTag = next.key;
      }
      renderCheck();
    }));

    const checks = W.ch.checks || [];
    const ticked = W.obj.ticks || (W.obj.ticks = checks.map(() => false));
    wEl('wr-checks').innerHTML = checks.map((c, i) =>
      `<label class="wr-check"><input type="checkbox" data-i="${i}" ${ticked[i] ? 'checked' : ''}/> <span>${escHtml(c)}</span></label>`).join('');
    wEl('wr-checks').querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
      ticked[Number(inp.dataset.i)] = inp.checked; updateStars();
    }));
    updateStars();
  }

  function currentStars() {
    const tags = allTags();
    const words = W.parts.every((p, i) => wordCount(W.texts[i]) >= p.minWords);
    const found = tags.every(t => (W.tagged[t.key] || []).length);
    const ticks = (W.obj.ticks || []).every(Boolean) && (W.ch.checks || []).length > 0;
    let s = words ? 1 : 0;
    if (words && found) s = 2;
    if (words && found && ticks) s = 3;
    return { s, words, found, ticks, tagCount: tags.filter(t => (W.tagged[t.key] || []).length).length, tagTotal: tags.length };
  }

  function updateStars() {
    const r = currentStars();
    wEl('wr-stars').innerHTML = [1, 2, 3].map(n => `<span class="${n <= r.s ? '' : 'off'}">⭐</span>`).join('') +
      `<small>${r.words ? '✔' : '✖'} word target • ${r.tagCount}/${r.tagTotal} labels found • ${r.ticks ? '✔' : '○'} checklist</small>`;
  }

  wEl('wr-text').addEventListener('input', onWriteInput);
  ['keydown', 'keyup'].forEach(ev => wEl('wr-text').addEventListener(ev, e => { if (e.key !== 'Escape') e.stopPropagation(); }));

  wEl('wr-to-check').addEventListener('click', () => {
    W.texts[W.part] = wEl('wr-text').value;
    const short = W.parts.map((p, i) => ({ p, n: wordCount(W.texts[i]) })).filter(x => x.n < x.p.minWords);
    if (short.length) {
      playSfx('wrong');
      showToast(`✍️ ${short[0].p.title || 'Your answer'} has ${short[0].n} words. MUET asks for at least ${short[0].p.minWords}.`);
      return;
    }
    W.timeUsed = Math.round((Date.now() - W.startedAt) / 1000);
    stopTimer();
    playSfx('correct');
    owlPose(W.obj, 'happy');
    if (!W.obj.solved && !W.ch.mock) openBridgePages(W.obj, 2);
    showWriteStage('check');
  });
  wEl('wr-back-edit').addEventListener('click', () => showWriteStage('write'));

  wEl('wr-save').addEventListener('click', () => {
    const r = currentStars();
    if (r.s < 2) {
      playSfx('wrong');
      showToast(r.tagCount < r.tagTotal
        ? `🏷️ Find all the labels first (${r.tagCount}/${r.tagTotal}). If a note or part is missing, go back and add it to your writing.`
        : '✍️ Reach the word target first.');
      return;
    }
    const ch = W.ch, obj = W.obj;
    const firstTime = !obj.solved && !ch.mock;
    const pts = firstTime ? r.s * 100 : 0;
    if (firstTime) {
      state.levelScore += pts; state.totalScore += pts;
      if (r.s === 3) state.firstAttemptCorrectCount += 0;
    }
    const entry = {
      time: new Date().toISOString(), student: state.studentName || '', group: state.studentClass || '',
      world: ch.mock ? 'Mock' : (WORLDS.find(w => w.id === state.currentWorldId).level || state.currentWorldId),
      clip: ch.part + ': ' + ch.title, question: '-', skill: ch.skill, correct: r.s >= 2, firstTry: true, points: pts,
      stars: r.s, words: W.parts.map((p, i) => wordCount(W.texts[i])).join(' + '),
      timed: W.timed ? 'Yes (' + fmtClock(W.timeUsed) + ' used)' : 'No',
      selfCheck: (W.ch.checks || []).map((c, i) => (obj.ticks || [])[i] ? 'Y' : 'N').join(''),
      text: W.texts.map((t, i) => (W.parts.length > 1 ? '[' + W.parts[i].title + '] ' : '') + t).join('\n\n')
    };
    if (!ch.mock) state.levelLog.push(entry);
    try {
      const all = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
      all.push(entry);
      localStorage.setItem(RESULTS_KEY, JSON.stringify(all.slice(-2000)));
      localStorage.removeItem(DRAFT_KEY(ch.id));
    } catch (e) {}
    obj.texts = W.texts.slice(); obj.tagged = W.tagged;
    playSfx('chest');
    spawnHeroBurst(14, 0xfbbf24);
    hideWriteModal();
    if (ch.mock) {
      showToast(`📝 Mock paper saved (${r.s}⭐). Download the CSV in the results screen for your lecturer.`);
      return;
    }
    if (firstTime) completeCrystal(obj);
    else showToast('✨ Saved. Practice makes perfect!');
    updateHUD();
  });

  function hideWriteModal() {
    stopTimer();
    try { W.texts[W.part] = wEl('wr-text').value; } catch (e) {}
    if (W.obj) { W.obj.texts = W.texts.slice(); W.obj.tagged = W.tagged; }
    state.isListeningModalOpen = false;
    wEl('modal-write').classList.add('hidden');
    if (W.obj && !W.ch.mock) owlPose(W.obj, W.obj.solved ? 'point' : 'idle');
    if (player.animState === 'listen' || player.animState === 'answer') setHeroAnimState('idle', 0);
  }
  wEl('wr-close').addEventListener('click', () => { hideWriteModal(); showToast('💾 Your writing is kept on this device. Come back to the anvil to continue.'); });
  wEl('wr-font-dec').addEventListener('click', () => { rdSize = Math.max(0, rdSize - 1); applyTextSize(); wEl('modal-write').style.setProperty('--rd-size', RD_SIZES[rdSize] + 'rem'); });
  wEl('wr-font-inc').addEventListener('click', () => { rdSize = Math.min(3, rdSize + 1); applyTextSize(); wEl('modal-write').style.setProperty('--rd-size', RD_SIZES[rdSize] + 'rem'); });
  wEl('modal-write').style.setProperty('--rd-size', RD_SIZES[rdSize] + 'rem');

  function openMockPaper() {
    if (state.isListeningModalOpen) return;
    const fake = { challenge: MOCK, index: 0, solved: false, mock: true, ticks: null };
    openWriteModal(fake);
  }

  // 10. LEVEL COMPLETION, STAR RATING & TEACHER RESULTS REPORT
  // -------------------------------------------------------------------
  function totalQuestions(worldDef) {
    return worldDef.challenges.reduce((n, c) => n + c.questions.length, 0);
  }

  function skillBreakdown(log) {
    const map = {};
    for (const e of log) {
      if (!map[e.skill]) map[e.skill] = { total: 0, first: 0, correct: 0 };
      map[e.skill].total++;
      if (e.firstTry) map[e.skill].first++;
      if (e.correct) map[e.skill].correct++;
    }
    return map;
  }

  function completeCurrentLevel() {
    state.isPlaying = false;
    playSfx('portal');

    const worldDef = WORLDS.find(w => w.id === state.currentWorldId);
    const levelBonus = 300;
    state.levelScore += levelBonus;
    state.totalScore += levelBonus;

    const nQ = totalQuestions(worldDef);
    const accuracyPct = Math.round((state.firstAttemptCorrectCount / nQ) * 100);
    const coinRatio = state.coinsCollected / worldDef.totalCoins;

    let stars = 1;
    if (accuracyPct >= 60 && coinRatio >= 0.5) stars = 2;
    if (accuracyPct >= 80 && coinRatio >= 0.75) stars = 3;

    const wp = state.worldProgress[state.currentWorldId];
    wp.completed = true;
    wp.stars = Math.max(wp.stars, stars);
    wp.bestScore = Math.max(wp.bestScore, state.levelScore);
    wp.coins = Math.max(wp.coins, state.coinsCollected);
    wp.chests = Math.max(wp.chests, state.chestsCollected);
    wp.solved = worldDef.challenges.length;

    saveProgress();

    const isFinalWorld = state.currentWorldId === 3;
    document.getElementById('results-crown').textContent = isFinalWorld ? '👑' : '🏆';
    document.getElementById('results-title').textContent = isFinalWorld
      ? 'The Forge Is Free!'
      : `Level ${worldDef.level || state.currentWorldId}: ${worldDef.name} Clear!`;
    document.getElementById('results-subtitle').textContent =
      (state.studentName ? state.studentName + (state.studentClass ? ' (' + state.studentClass + ')' : '') + ': ' : '') +
      (isFinalWorld
        ? 'You freed the Writer\u2019s Block Golem and forged all nine anvils! Ready for the 75-minute Mock Paper?'
        : 'You opened the ancient portal and earned +300 Level Completion points!');

    const starsEl = document.getElementById('results-stars');
    starsEl.innerHTML = [1, 2, 3].map(n => n <= stars ? '<span>⭐</span>' : '<span class="opacity-25">⭐</span>').join('');

    document.getElementById('results-score').textContent = state.levelScore.toLocaleString() + ' pts';
    document.getElementById('results-accuracy').textContent = `${accuracyPct}% (${state.firstAttemptCorrectCount}/${nQ})`;
    document.getElementById('results-coins').textContent = `${state.coinsCollected} / ${worldDef.totalCoins}`;
    document.getElementById('results-chests').textContent = `${state.chestsCollected} / ${worldDef.totalChests}`;

    // Per-skill breakdown (first-try accuracy) for the lecturer
    const sk = skillBreakdown(state.levelLog);
    const rows = Object.keys(sk).map(name => {
      const r = sk[name];
      const pct = Math.round((r.first / r.total) * 100);
      const color = pct >= 80 ? 'text-emerald-300' : pct >= 50 ? 'text-amber-300' : 'text-rose-300';
      return `<tr><td class="py-1 pr-2">${name}</td><td class="py-1 text-right ${color} font-bold">${r.first}/${r.total} (${pct}%)</td></tr>`;
    }).join('');
    document.getElementById('results-skills').innerHTML = rows
      ? `<table class="w-full"><thead><tr class="text-purple-300"><th class="text-left font-semibold pb-1">Writing skill</th><th class="text-right font-semibold pb-1">1st-try correct</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="text-slate-400">No answers recorded.</div>';

    const nextBtn = document.getElementById('btn-results-next');
    nextBtn.textContent = isFinalWorld ? '📝 Try the 75-min Mock Paper' : '⏭️ Next Level →';

    document.getElementById('modal-results').classList.remove('hidden');
  }

  function getAllResults() {
    try { return JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]'); } catch (e) { return []; }
  }

  const RESULT_HEADER = ['Time', 'Student', 'Class', 'Level', 'Task', 'Q#', 'Skill', 'Correct', 'First try', 'Points', 'Stars', 'Words', 'Exam timing', 'Self-check', 'Student writing'];
  function resultRow(e) {
    return [e.time, e.student, e.group, e.world, e.clip, e.question, e.skill, e.correct ? 'Yes' : 'No', e.firstTry ? 'Yes' : 'No', e.points,
      e.stars === undefined ? '' : e.stars, e.words || '', e.timed || '', e.selfCheck || '', e.text || ''];
  }
  function resultsAsTSV(log) {
    const clean = v => String(v).replace(/[\t\n\r]+/g, ' ');
    return [RESULT_HEADER.join('\t')].concat(log.map(e => resultRow(e).map(clean).join('\t'))).join('\n');
  }
  function resultsAsCSV(log) {
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    return [RESULT_HEADER.map(esc).join(',')].concat(log.map(e => resultRow(e).map(esc).join(','))).join('\n');
  }

  document.getElementById('btn-results-copy').addEventListener('click', async () => {
    const text = resultsAsTSV(state.levelLog);
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Results copied. Paste into Google Sheets or Excel.');
    } catch (e) {
      window.prompt('Copy these results:', text);
    }
  });

  document.getElementById('btn-results-csv').addEventListener('click', () => {
    const log = getAllResults();
    if (!log.length) { showToast('No results saved on this device yet.'); return; }
    const blob = new Blob(['﻿' + resultsAsCSV(log)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const who = (state.studentName || 'student').replace(/[^\w-]+/g, '_');
    a.download = `CrystalQuest_Writing_results_${who}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  // -------------------------------------------------------------------
  // 11. UI RENDERING
  // -------------------------------------------------------------------
  function renderHeroCards() {
    const grid = document.getElementById('hero-cards-grid');
    grid.innerHTML = '';
    HEROES.forEach(h => {
      const isSelected = h.id === state.selectedHeroId;
      const card = document.createElement('div');
      card.className = `rounded-2xl p-3.5 border-2 transition cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-purple-900/80 border-amber-400 shadow-lg shadow-amber-400/20'
          : 'bg-slate-900/80 border-purple-500/30 hover:border-purple-400'
      }`;
      card.innerHTML = `
        <div class="space-y-2.5">
          <div class="relative w-full h-32 rounded-xl overflow-hidden bg-slate-950 border border-purple-400/30">
            <img src="${h.portrait}" alt="${h.name}" class="w-full h-full object-cover" />
            ${isSelected ? '<span class="absolute top-2 right-2 bg-amber-400 text-slate-950 text-[11px] font-extrabold px-2 py-0.5 rounded-full">SELECTED</span>' : ''}
          </div>
          <div>
            <h3 class="font-display font-bold text-base text-white">${h.name}</h3>
            <div class="text-xs font-semibold text-amber-300">${h.title}</div>
            <p class="text-xs text-purple-200 mt-1">${h.traits}</p>
          </div>
        </div>
        <div class="mt-3 pt-2 border-t border-purple-400/20 text-xs font-semibold text-cyan-300">
          ${h.effectLabel}
        </div>
      `;
      card.addEventListener('click', () => {
        state.selectedHeroId = h.id;
        buildHeroMesh(h);
        updateHUD();
        saveProgress();
        renderHeroCards();
        playSfx('coin');
      });
      grid.appendChild(card);
    });
  }

  function renderWorldCards() {
    const grid = document.getElementById('world-cards-grid');
    grid.innerHTML = '';
    WORLDS.forEach(w => {
      const wp = state.worldProgress[w.id];
      const starsStr = [1, 2, 3].map(n => n <= wp.stars ? '⭐' : '☆').join(' ');
      const card = document.createElement('div');
      card.className = 'rounded-2xl p-4 bg-slate-900/85 border-2 border-purple-400/40 hover:border-amber-400 transition flex flex-col justify-between space-y-3';
      card.innerHTML = `
        <div class="space-y-2.5">
          <div class="relative w-full h-32 rounded-xl overflow-hidden border border-purple-400/30">
            <img src="${ART_OK ? ART_BASE + 'card_w' + w.id + '.webp' : w.thumb}" alt="${w.name}" class="w-full h-full object-cover" />
            <span class="absolute top-2 left-2 bg-slate-950/85 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-400/40">Level ${w.level || w.id}</span>
            <span class="absolute top-2 right-2 bg-slate-950/85 text-yellow-300 text-xs font-bold px-2 py-0.5 rounded-full">${starsStr}</span>
          </div>
          <div>
            <h3 class="font-display font-bold text-lg text-white">${w.name}</h3>
            <div class="text-xs font-semibold text-cyan-300">${w.subtitle}</div>
            <p class="text-xs text-purple-200 mt-1">${w.objectiveDesc}</p>
          </div>
          <div class="grid grid-cols-3 gap-1 text-xs bg-slate-950/70 p-2 rounded-xl text-center text-slate-300">
            <div>📖 ${w.challenges.length} Books</div>
            <div>📜 ${w.totalCoins} Scrolls</div>
            <div>🎁 ${w.totalChests} Chests</div>
          </div>
        </div>
        <button type="button" class="crystal-btn w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-display font-extrabold text-sm shadow">
          ▶️ Enter ${w.name}
        </button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        document.getElementById('modal-worlds').classList.add('hidden');
        startGameLevel(w.id);
      });
      grid.appendChild(card);
    });
  }

  function updateMainMenuSummary() {
    const heroDef = HEROES.find(h => h.id === state.selectedHeroId) || HEROES[0];
    document.getElementById('menu-hero-img').src = heroDef.portrait;
    document.getElementById('menu-hero-title').textContent = `${heroDef.name} — ${heroDef.title}`;
    document.getElementById('menu-hero-desc').textContent = `${heroDef.traits}. Trail: ${heroDef.effectLabel}`;

    const totalStars = state.worldProgress[1].stars + state.worldProgress[2].stars + state.worldProgress[3].stars;
    document.getElementById('menu-progress-summary').textContent = `Saved Progress: ${totalStars} / 9 ⭐ | ${state.totalScore.toLocaleString()} Pts`;

    const curWorld = WORLDS.find(w => w.id === state.currentWorldId) || WORLDS[0];
    document.getElementById('label-continue-btn').textContent = `Continue Saved Quest`;

    const listEl = document.getElementById('menu-worlds-list');
    listEl.innerHTML = WORLDS.map(w => {
      const wp = state.worldProgress[w.id];
      const st = [1, 2, 3].map(n => n <= wp.stars ? '⭐' : '☆').join('');
      return `
        <div class="flex items-center justify-between bg-slate-950/60 px-3 py-1.5 rounded-lg border border-purple-500/20">
          <span class="font-semibold text-purple-100">Lv.${w.level || w.id} ${w.name}</span>
          <span class="text-amber-300 font-bold">${st} (${w.challenges.length} 📖)</span>
        </div>
      `;
    }).join('');
  }

  function updateHUD() {
    const heroDef = HEROES.find(h => h.id === state.selectedHeroId) || HEROES[0];
    const worldDef = WORLDS.find(w => w.id === state.currentWorldId) || WORLDS[0];

    document.getElementById('hud-hero-img').src = heroDef.portrait;
    document.getElementById('mirror-hero-img').src = heroDef.portrait;
    document.getElementById('hud-hero-name').textContent = heroDef.name;
    document.getElementById('hero-tag-name').textContent = `YOU (${heroDef.name})`;
    document.getElementById('hud-level-badge').textContent = `Lv.${worldDef.level || worldDef.id} ${worldDef.name}`;

    const heartsEl = document.getElementById('hud-hearts');
    heartsEl.innerHTML = [1, 2, 3].map(n =>
      n <= state.hearts
        ? '<span class="text-rose-500 text-base drop-shadow">❤️</span>'
        : '<span class="text-slate-600 text-base">🖤</span>'
    ).join('');

    document.getElementById('hud-coins').textContent = `${state.coinsCollected} / ${worldDef.totalCoins}`;
    document.getElementById('hud-listening').textContent = `${state.challengesSolved} / ${worldDef.challenges.length}`;
    document.getElementById('hud-chests').textContent = `${state.chestsCollected} / ${worldDef.totalChests}`;
    document.getElementById('hud-score').textContent = state.levelScore.toLocaleString();

    const objText = document.getElementById('hud-objective-text');
    const nB = worldDef.challenges.length;
    let msg;
    if (state.challengesSolved < nB) {
      msg = COMPACT
        ? `Anvil ${state.challengesSolved + 1}/${nB}: walk to Quilla, tap ✒️ WRITE`
        : `Forge Anvil ${state.challengesSolved + 1} of ${nB} with Quilla the Fox Scribe (Press E) to unlock the bridge!`;
    } else {
      msg = COMPACT ? 'All anvils forged! Run to the portal 🌀' : `All ${nB} anvils forged! Step into the glowing Portal ahead!`;
    }
    const wrapEl = document.getElementById('hud-objective-wrap');
    if (objText.textContent !== msg) {
      objText.textContent = msg;
      wrapEl.style.opacity = '1';
      clearTimeout(wrapEl._fade);
      if (COMPACT) wrapEl._fade = setTimeout(() => { wrapEl.style.opacity = '0'; }, 7000);
    }
    requestAnimationFrame(placeObjective);
  }

  let lastToastMsg = '';
  let lastToastAt = 0;
  function showToast(msg) {
    const nowMs = performance.now();
    if (msg === lastToastMsg && nowMs - lastToastAt < 2500) return;
    lastToastMsg = msg;
    lastToastAt = nowMs;
    const t = document.getElementById('game-toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  function startGameLevel(worldId) {
    ensureAudioContext();
    state.currentWorldId = worldId;
    state.isPlaying = true;
    state.isPaused = false;
    state.isListeningModalOpen = false;

    document.getElementById('modal-main-menu').classList.add('hidden');
    document.getElementById('modal-worlds').classList.add('hidden');
    document.getElementById('modal-heroes').classList.add('hidden');
    document.getElementById('modal-results').classList.add('hidden');
    document.getElementById('modal-pause').classList.add('hidden');

    document.getElementById('hud-bar').classList.remove('hidden');
    document.getElementById('hero-screen-tag').classList.remove('hidden');
    document.getElementById('hud-objective-wrap').classList.remove('hidden');
    if (state.touchControlsEnabled) {
      document.getElementById('touch-controls').classList.remove('hidden');
    }

    buildWorld(worldId);
    player.invulnerableTimer = 4.0;
    startBackgroundMusic(worldId);
    if (ART_OK) {
      const sp = document.getElementById('level-splash');
      const wd = WORLDS.find(w => w.id === worldId);
      document.getElementById('level-splash-img').src = ART_BASE + 'card_w' + worldId + '.webp';
      document.getElementById('level-splash-title').textContent = 'Level ' + (wd.level || worldId) + ': ' + wd.name;
      document.getElementById('level-splash-sub').textContent = wd.objectiveDesc;
      document.getElementById('level-splash-textbox').classList.add('cq-no-title'); // the level cards have their own titles
      sp.classList.remove('hidden');
      requestAnimationFrame(() => { sp.style.opacity = '1'; });
      clearTimeout(sp._t1); clearTimeout(sp._t2);
      sp._t1 = setTimeout(() => { sp.style.opacity = '0'; }, 2600);
      sp._t2 = setTimeout(() => { sp.classList.add('hidden'); }, 3300);
      sp.onclick = () => { sp.style.opacity = '0'; setTimeout(() => sp.classList.add('hidden'), 400); };
    }
    saveProgress();
  }

  function togglePauseModal() {
    state.isPaused = !state.isPaused;
    document.getElementById('modal-pause').classList.toggle('hidden', !state.isPaused);
  }

  // -------------------------------------------------------------------
  // 12. BUTTON EVENT LISTENERS
  // -------------------------------------------------------------------
  document.getElementById('btn-menu-play').addEventListener('click', () => startGameLevel(1));
  document.getElementById('btn-menu-mock').addEventListener('click', () => openMockPaper());
  document.getElementById('btn-menu-continue').addEventListener('click', () => startGameLevel(state.currentWorldId || 1));

  document.getElementById('btn-menu-heroes').addEventListener('click', () => {
    renderHeroCards();
    document.getElementById('modal-heroes').classList.remove('hidden');
  });
  document.getElementById('btn-menu-swap-hero').addEventListener('click', () => {
    renderHeroCards();
    document.getElementById('modal-heroes').classList.remove('hidden');
  });
  document.getElementById('btn-hud-hero').addEventListener('click', () => {
    renderHeroCards();
    document.getElementById('modal-heroes').classList.remove('hidden');
  });
  document.getElementById('btn-close-heroes').addEventListener('click', () => {
    document.getElementById('modal-heroes').classList.add('hidden');
  });
  document.getElementById('btn-confirm-hero').addEventListener('click', () => {
    document.getElementById('modal-heroes').classList.add('hidden');
  });

  document.getElementById('btn-menu-worlds').addEventListener('click', () => {
    renderWorldCards();
    document.getElementById('modal-worlds').classList.remove('hidden');
  });
  document.getElementById('btn-hud-map').addEventListener('click', () => {
    renderWorldCards();
    document.getElementById('modal-worlds').classList.remove('hidden');
  });
  document.getElementById('btn-close-worlds').addEventListener('click', () => {
    document.getElementById('modal-worlds').classList.add('hidden');
  });

  document.getElementById('btn-menu-howto').addEventListener('click', () => {
    document.getElementById('modal-howto').classList.remove('hidden');
  });
  document.getElementById('btn-close-howto').addEventListener('click', () => {
    document.getElementById('modal-howto').classList.add('hidden');
  });

  document.getElementById('btn-menu-settings').addEventListener('click', () => {
    document.getElementById('modal-pause').classList.remove('hidden');
  });
  document.getElementById('btn-hud-pause').addEventListener('click', togglePauseModal);
  document.getElementById('btn-close-pause').addEventListener('click', () => {
    state.isPaused = false;
    document.getElementById('modal-pause').classList.add('hidden');
  });
  document.getElementById('btn-pause-resume').addEventListener('click', () => {
    state.isPaused = false;
    document.getElementById('modal-pause').classList.add('hidden');
  });
  document.getElementById('btn-pause-checkpoint').addEventListener('click', () => {
    state.hearts = 3;
    state.isPaused = false;
    document.getElementById('modal-pause').classList.add('hidden');
    respawnAtCheckpoint(true);
    updateHUD();
  });
  document.getElementById('btn-pause-restart').addEventListener('click', () => {
    document.getElementById('modal-pause').classList.add('hidden');
    startGameLevel(state.currentWorldId);
  });
  document.getElementById('btn-pause-mainmenu').addEventListener('click', () => {
    stopSpeechAudio();
    stopBackgroundMusic();
    state.isPlaying = false;
    state.isPaused = false;
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('hud-bar').classList.add('hidden');
    document.getElementById('self-mirror-card').classList.add('hidden');
    document.getElementById('hero-screen-tag').classList.add('hidden');
    document.getElementById('hud-objective-wrap').classList.add('hidden');
    document.getElementById('touch-controls').classList.add('hidden');
    document.getElementById('interaction-prompt').classList.add('hidden');
    updateMainMenuSummary();
    document.getElementById('modal-main-menu').classList.remove('hidden');
  });

  document.getElementById('slider-master-vol').addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10) || 100;
    state.masterVolume = val / 100;
    document.getElementById('volume-pct-label').textContent = val + '%';
    ensureAudioContext();
    applyAudioSettings();
  });

  document.getElementById('btn-hud-mute').addEventListener('click', () => {
    state.musicEnabled = !state.musicEnabled;
    state.sfxEnabled = state.musicEnabled;
    document.getElementById('toggle-music').checked = state.musicEnabled;
    document.getElementById('toggle-sfx').checked = state.sfxEnabled;
    document.getElementById('btn-hud-mute').textContent = state.musicEnabled ? '🔊' : '🔇';
    if (state.musicEnabled && state.isPlaying) {
      startBackgroundMusic(state.currentWorldId);
    } else {
      stopBackgroundMusic();
    }
  });

  document.getElementById('toggle-music').addEventListener('change', (e) => {
    state.musicEnabled = e.target.checked;
    if (state.musicEnabled && state.isPlaying) startBackgroundMusic(state.currentWorldId);
    else stopBackgroundMusic();
  });
  document.getElementById('toggle-sfx').addEventListener('change', (e) => {
    state.sfxEnabled = e.target.checked;
  });
  document.getElementById('toggle-touch').addEventListener('change', (e) => {
    state.touchControlsEnabled = e.target.checked;
    if (state.isPlaying) {
      document.getElementById('touch-controls').classList.toggle('hidden', !state.touchControlsEnabled);
    }
  });

  document.getElementById('btn-results-next').addEventListener('click', () => {
    if (state.currentWorldId === 3) { document.getElementById('modal-results').classList.add('hidden'); openMockPaper(); return; }
    const nextId = state.currentWorldId < 3 ? state.currentWorldId + 1 : 1;
    startGameLevel(nextId);
  });
  document.getElementById('btn-results-retry').addEventListener('click', () => {
    startGameLevel(state.currentWorldId);
  });
  document.getElementById('btn-results-menu').addEventListener('click', () => {
    document.getElementById('modal-results').classList.add('hidden');
    document.getElementById('hud-bar').classList.add('hidden');
    document.getElementById('self-mirror-card').classList.add('hidden');
    document.getElementById('hero-screen-tag').classList.add('hidden');
    document.getElementById('hud-objective-wrap').classList.add('hidden');
    document.getElementById('touch-controls').classList.add('hidden');
    updateMainMenuSummary();
    document.getElementById('modal-main-menu').classList.remove('hidden');
  });

  // -------------------------------------------------------------------
  // 13. MAIN 3D PHYSICS, COLLISION, CAMERA & ANIMATION LOOP
  // -------------------------------------------------------------------
  let lastTime = performance.now();
  const projVec = new THREE.Vector3();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const elapsed = now * 0.001;

    // Drift clouds & spin waterwheels
    for (const cl of clouds) {
      cl.mesh.position.x = cl.baseX + Math.sin(elapsed * 0.15 + cl.phase) * 5.0;
    }
    for (const ww of waterWheels) {
      ww.rotation.x += dt * 1.4;
    }

    // Update moving platforms
    for (const mp of movingPlatforms) {
      if (!mp.moveSpec) continue;
      const s = mp.moveSpec;
      const offset = Math.sin(elapsed * s.speed + s.phase) * s.amp;
      const prevX = mp.x;
      const prevY = mp.y;
      if (s.axis === 'x') {
        mp.x = mp.baseX + offset;
      } else {
        mp.y = mp.baseY + offset;
      }
      mp.dx = mp.x - prevX;
      mp.dy = mp.y - prevY;
      mp.topY = mp.y + mp.h * 0.5;
      mp.mesh.position.set(mp.x, mp.y, mp.z);
    }

    // Rotate coins, listening crystals, guardians, portal & ambient particles
    for (const coin of crystalCoins) {
      if (!coin.collected) {
        coin.mesh.rotation.y += dt * 2.6;
        coin.mesh.position.y = coin.y + Math.sin(elapsed * 3 + coin.z) * 0.12;
      }
    }
    for (const lc of listeningCrystals) {
      if (!lc.gem.isSprite && !lc.gem.userData.still) {
        lc.gem.rotation.y += dt * 1.8;
        lc.gem.position.y = 1.55 + Math.sin(elapsed * 2.5 + lc.index) * 0.14;
      }
      lc.ring.rotation.z += dt * 1.2;
      if (lc.guardianMesh) {
        lc.guardianMesh.position.y = Math.abs(Math.sin(elapsed * 2.2 + lc.index)) * 0.06;
      }
    }
    if (portalObject) {
      portalObject.vortex.rotation.z += dt * 2.2;
    }
    for (const ap of ambientParticles) {
      ap.mesh.position.y = ap.baseY + Math.sin(elapsed * 1.8 + ap.phase) * 0.45;
    }

    // Update trail particles
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const tp = trailParticles[i];
      tp.life -= dt;
      tp.mesh.position.addScaledVector(tp.vel, dt);
      tp.mesh.scale.setScalar(Math.max(0.01, tp.life * 1.8));
      if (tp.life <= 0) {
        worldGroup.remove(tp.mesh);
        trailParticles.splice(i, 1);
      }
    }

    // Gameplay movement & collisions when active
    if (state.isPlaying && !state.isPaused && !state.isListeningModalOpen) {
      const moveSpeed = 7.0;
      let mx = 0;
      let mz = 0;
      if (keys.left) mx -= 1;
      if (keys.right) mx += 1;
      if (keys.up) mz -= 1;
      if (keys.down) mz += 1;

      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        player.vel.x = mx * moveSpeed;
        player.vel.z = mz * moveSpeed;
        player.facingAngle = Math.atan2(mx, mz);
        if (player.onGround && player.animTimer <= 0) {
          setHeroAnimState('run', 0);
        }
      } else {
        player.vel.x *= 0.78;
        player.vel.z *= 0.78;
        if (player.onGround && player.animTimer <= 0) {
          setHeroAnimState('idle', 0);
        }
      }

      if (player.onGround && player.standingPlatform && player.standingPlatform.isMoving) {
        player.pos.x += player.standingPlatform.dx;
        player.pos.y += player.standingPlatform.dy;
      }

      // Gravity
      player.vel.y -= 24.0 * dt;
      player.pos.x += player.vel.x * dt;
      player.pos.z += player.vel.z * dt;
      const prevY = player.pos.y;
      player.pos.y += player.vel.y * dt;

      // Platform landing collision
      player.onGround = false;
      player.standingPlatform = null;
      for (const p of platforms) {
        if (!p.active) continue;
        const halfW = p.w * 0.5 + 0.32;
        const halfD = p.d * 0.5 + 0.32;
        if (
          Math.abs(player.pos.x - p.x) <= halfW &&
          Math.abs(player.pos.z - p.z) <= halfD
        ) {
          if (prevY >= p.topY - 0.38 && player.pos.y <= p.topY + 0.14 && player.vel.y <= 0) {
            player.pos.y = p.topY;
            player.vel.y = 0;
            player.onGround = true;
            player.standingPlatform = p;
            break;
          }
        }
      }

      // Bouncy Giant Mushroom Pads!
      for (const bm of bouncyMushrooms) {
        if (
          Math.hypot(player.pos.x - bm.x, player.pos.z - bm.z) < 1.15 &&
          Math.abs(player.pos.y - (bm.y + 0.7)) < 0.75 &&
          player.vel.y <= 0
        ) {
          player.vel.y = 14.5;
          player.onGround = false;
          setHeroAnimState('jump', 0.8);
          playSfx('bounce');
          spawnHeroBurst(14, 0xf43f5e);
          showToast('🍄 Super Mushroom Bounce!');
        }
      }

      if (!player.onGround && player.vel.y < -2.0 && player.animTimer <= 0) {
        setHeroAnimState('fall', 0);
      }

      if (player.pos.y < -4.5) {
        takePlayerDamage('Splash! Returning safely to your last checkpoint.');
      }

      // Collect Crystal Coins
      for (const coin of crystalCoins) {
        if (!coin.collected && Math.hypot(player.pos.x - coin.x, player.pos.y + 0.7 - coin.y, player.pos.z - coin.z) < 1.25) {
          coin.collected = true;
          coin.mesh.visible = false;
          state.coinsCollected++;
          state.levelScore += 10;
          state.totalScore += 10;
          playSfx('coin');
          setHeroAnimState('collect', 0.45);
          spawnHeroBurst(8, 0xfbbf24);
          updateHUD();
        }
      }

      // Open Hidden Treasure Chests
      for (const ch of treasureChests) {
        if (!ch.opened && Math.hypot(player.pos.x - ch.x, player.pos.z - ch.z) < 1.55) {
          ch.opened = true;
          if (ch.sprite && artTex.item_chest_open) {
            ch.sprite.material.map = artTex.item_chest_open;
            ch.sprite.material.needsUpdate = true;
            setSpriteSize(ch.sprite, artTex.item_chest_open, 1.25);
          } else {
            ch.mesh.scale.set(1.15, 0.65, 1.15);
          }
          state.chestsCollected++;
          state.levelScore += 100;
          state.totalScore += 100;
          playSfx('chest');
          setHeroAnimState('celebrate', 1.2);
          spawnHeroBurst(16, 0xfbbf24);
          showToast('🎁 Hidden Treasure Chest Discovered! +100 Bonus Points!');
          updateHUD();
        }
      }

      // Activate Checkpoints
      for (const cp of checkpoints) {
        if (!cp.activated && Math.hypot(player.pos.x - cp.x, player.pos.z - cp.z) < 1.6) {
          cp.activated = true;
          cp.orb.material.color.setHex(0x4ade80);
          state.currentCheckpoint = { x: cp.x, y: cp.y, z: cp.z };
          playSfx('checkpoint');
          showToast('🚩 Checkpoint Reached!');
        }
      }

      // Enemy Patrol & Collision
      if (player.invulnerableTimer > 0) {
        player.invulnerableTimer -= dt;
      }
      for (const en of enemies) {
        en.mesh.position.x = en.baseX + Math.sin(elapsed * en.speed + en.phase) * en.range;
        en.mesh.position.y = en.y + Math.abs(Math.sin(elapsed * 4 + en.phase)) * 0.06;
        const wsp = en.mesh.children[1];
        if (wsp && wsp.isSprite && artTex.enemy_inkling) {
          if (en.hitT > 0) en.hitT -= dt;
          const base = en.hitT > 0 ? (artTex.inkling_hit || artTex.enemy_inkling)
            : (Math.floor(elapsed * 4 + en.phase) % 2 ? (artTex.inkling_move || artTex.enemy_inkling) : artTex.enemy_inkling);
          const goingLeft = Math.cos(elapsed * en.speed + en.phase) < 0;
          const tex = base;
          if (wsp.material.map !== tex) {
            wsp.material.map = tex;
            wsp.material.needsUpdate = true;
            setSpriteSize(wsp, base, 1.05);
          }
        }
        if (
          player.invulnerableTimer <= 0 &&
          Math.hypot(player.pos.x - en.mesh.position.x, player.pos.z - en.z) < 0.92 &&
          Math.abs(player.pos.y - en.y) < 1.0
        ) {
          en.hitT = 0.9;
          takePlayerDamage('Splashed by a Typo Inkling! -1 Heart');
        }
      }

      const nearCrystal = findNearestListeningCrystal();
      const promptEl = document.getElementById('interaction-prompt');
      if (nearCrystal) {
        promptEl.classList.remove('hidden');
        document.getElementById('interaction-prompt-label').textContent = nearCrystal.solved
          ? `Review ${nearCrystal.challenge.part}: ${nearCrystal.challenge.title}`
          : `Write: ${nearCrystal.challenge.title}`;
      } else {
        promptEl.classList.add('hidden');
      }

      if (portalObject && Math.hypot(player.pos.x - portalObject.x, player.pos.z - portalObject.z) < 1.95) {
        if (portalObject.unlocked) {
          completeCurrentLevel();
        } else {
          showToast('🔒 Forge all three anvils in this level to open the Portal!');
        }
      }
    }

    animateScenery(dt, elapsed);
    if (backdropMesh) backdropMesh.position.set(player.pos.x, backdropMesh.position.y, player.pos.z);

    // Update Hero 3D Pose, Spotlight & Screen Callout Tag
    if (heroMesh) {
      heroMesh.position.copy(player.pos);
      heroMesh.rotation.y = player.facingAngle;
      heroSpotLight.position.set(player.pos.x, player.pos.y + 4.5, player.pos.z + 2.0);

      if (player.animTimer > 0) {
        player.animTimer -= dt;
      }

      const st = player.animState;
      heroParts.listenRing.visible = (st === 'listen' || state.isListeningModalOpen);
      if (heroParts.listenRing.visible) {
        const s = 1 + Math.sin(elapsed * 6) * 0.15;
        heroParts.listenRing.scale.set(s, s, 1);
      }
      heroParts.groundRing.rotation.z += dt * 1.5;

      const mirrorImg = document.getElementById('mirror-hero-img');
      if (heroParts.sprite) {
        updateSpriteHero(elapsed, mirrorImg);
      } else if (st === 'run') {
        const swing = Math.sin(elapsed * 14) * 0.7;
        heroParts.leftLeg.rotation.x = swing;
        heroParts.rightLeg.rotation.x = -swing;
        heroParts.leftArm.rotation.x = -swing * 0.85;
        heroParts.rightArm.rotation.x = swing * 0.85;
        heroParts.cape.rotation.x = 0.45 + Math.abs(swing) * 0.25;
        heroParts.headGroup.position.y = 1.62 + Math.abs(Math.sin(elapsed * 14)) * 0.06;
        if (mirrorImg) mirrorImg.style.transform = `translateY(${Math.sin(elapsed * 14) * 3}px)`;
      } else if (st === 'jump' || st === 'fall') {
        heroParts.leftArm.rotation.x = -2.3;
        heroParts.rightArm.rotation.x = -2.3;
        heroParts.leftLeg.rotation.x = 0.45;
        heroParts.rightLeg.rotation.x = -0.45;
        heroParts.cape.rotation.x = 0.7;
        if (mirrorImg) mirrorImg.style.transform = 'scale(1.08) translateY(-4px)';
      } else if (st === 'listen' || state.isListeningModalOpen) {
        heroParts.rightArm.rotation.x = -1.9;
        heroParts.headGroup.rotation.z = Math.sin(elapsed * 3.5) * 0.14;
        if (mirrorImg) mirrorImg.style.transform = `rotate(${Math.sin(elapsed * 3.5) * 4}deg)`;
      } else if (st === 'celebrate' || st === 'collect') {
        heroParts.leftArm.rotation.x = -2.6;
        heroParts.rightArm.rotation.x = -2.6;
        heroMesh.rotation.y = elapsed * 5.5;
        if (mirrorImg) mirrorImg.style.transform = 'scale(1.12)';
      } else {
        heroParts.leftLeg.rotation.x = 0;
        heroParts.rightLeg.rotation.x = 0;
        heroParts.leftArm.rotation.x = Math.sin(elapsed * 2.5) * 0.08;
        heroParts.rightArm.rotation.x = -Math.sin(elapsed * 2.5) * 0.08;
        heroParts.cape.rotation.x = 0.18;
        heroParts.headGroup.position.y = 1.62 + Math.sin(elapsed * 2.5) * 0.03;
        heroParts.headGroup.rotation.z = 0;
        if (mirrorImg) mirrorImg.style.transform = 'none';
      }

      // Update Floating Overhead "YOU" Screen Tag
      const tagEl = document.getElementById('hero-screen-tag');
      if (state.isPlaying && tagEl) {
        projVec.set(player.pos.x, player.pos.y + 3.1, player.pos.z);
        projVec.project(camera);
        if (projVec.z < 1) {
          const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
          tagEl.style.left = `${sx}px`;
          tagEl.style.top = `${sy}px`;
          tagEl.classList.remove('hidden');
        } else {
          tagEl.classList.add('hidden');
        }
      }
    }

    // Dynamic Camera System:
    // - On Main Menu: Slowly orbits close around the Hero so you see your Hero's face & sunlit world!
    // - During Listening Modal: Zooms into a cinematic face-to-face shot of Hero + Guardian in top half of screen!
    // - During Gameplay: Follows selected Camera Mode (Close / Selfie Front / Action / Top) + Mouse Orbit!
    if (!state.isPlaying) {
      const menuAngle = elapsed * 0.45;
      camera.position.set(
        player.pos.x + Math.sin(menuAngle) * 4.8,
        player.pos.y + 2.4,
        player.pos.z + Math.cos(menuAngle) * 4.8
      );
      camera.lookAt(player.pos.x, player.pos.y + 1.5, player.pos.z);
    } else if (state.isListeningModalOpen && state.activeCrystalObj) {
      const lc = state.activeCrystalObj;
      const targetX = lc.x;
      const targetY = lc.y + 2.2;
      const targetZ = lc.z + 4.4;
      camera.position.x += (targetX - camera.position.x) * 0.1;
      camera.position.y += (targetY - camera.position.y) * 0.1;
      camera.position.z += (targetZ - camera.position.z) * 0.1;
      // Look slightly lower so Hero & Guardian appear in the upper clear half of the viewport above the docked panel!
      camera.lookAt(lc.x, lc.y + 0.2, lc.z);
    } else {
      const mode = CAM_MODES[state.camModeIndex] || CAM_MODES[0];
      const baseYaw = mode.front ? Math.PI : 0;
      const totalYaw = baseYaw + state.camOrbitYaw;
      const targetCamX = player.pos.x + Math.sin(totalYaw) * mode.dist;
      const targetCamY = player.pos.y + mode.height;
      const targetCamZ = player.pos.z + Math.cos(totalYaw) * mode.dist;

      camera.position.x += (targetCamX - camera.position.x) * 0.1;
      camera.position.y += (targetCamY - camera.position.y) * 0.1;
      camera.position.z += (targetCamZ - camera.position.z) * 0.1;
      camera.lookAt(player.pos.x, player.pos.y + 1.45, player.pos.z - (mode.front ? -0.5 : 1.2));
    }

    renderer.render(scene, camera);
  }

  function takePlayerDamage(reasonMsg) {
    playSfx('damage');
    setHeroAnimState('damage', 0.8);
    player.invulnerableTimer = 1.6;
    state.hearts--;
    if (state.hearts <= 0) {
      state.hearts = 3;
      showToast('💖 Hearts restored at Checkpoint! Keep trying!');
    } else {
      showToast(reasonMsg);
    }
    respawnAtCheckpoint(false);
    updateHUD();
  }

  function fitCamera() {
    const a = window.innerWidth / window.innerHeight;
    camera.aspect = a;
    camera.fov = a < 1 ? Math.min(74, 52 + (1 - a) * 42) : 52;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    placeObjective();
  }
  function placeObjective() {
    const bar = document.getElementById('hud-bar');
    const wrap = document.getElementById('hud-objective-wrap');
    if (!bar || !wrap || bar.classList.contains('hidden')) return;
    wrap.style.top = Math.round(bar.getBoundingClientRect().bottom + 6) + 'px';
  }
  window.addEventListener('resize', fitCamera);
  setTimeout(fitCamera, 0);
  setInterval(placeObjective, 800);

  // Student details & practice mode
  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      state.studentName = p.name || '';
      state.studentClass = p.group || '';
    } catch (e) {}
    document.getElementById('input-student-name').value = state.studentName;
    document.getElementById('input-student-class').value = state.studentClass;
  }
  function saveProfile() {
    state.studentName = document.getElementById('input-student-name').value.trim();
    state.studentClass = document.getElementById('input-student-class').value.trim();
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: state.studentName, group: state.studentClass })); } catch (e) {}
  }
  document.getElementById('input-student-name').addEventListener('input', saveProfile);
  document.getElementById('input-student-class').addEventListener('input', saveProfile);
  // Typing in the name boxes must not move the hero or trigger shortcuts
  ['input-student-name', 'input-student-class'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('keydown', e => e.stopPropagation());
    el.addEventListener('keyup', e => e.stopPropagation());
  });
  document.getElementById('toggle-big-text').addEventListener('change', (e) => {
    rdSize = e.target.checked ? 2 : 1;
    applyTextSize();
    showToast(e.target.checked ? '🔤 Bigger reading text ON.' : '🔤 Normal reading text.');
  });

  window.addEventListener('load', () => {
    loadSaveData();
    loadProfile();
    document.getElementById('toggle-touch').checked = state.touchControlsEnabled;
    Promise.all([loadArt(), loadModels()]).then(([ok]) => {
      buildWorld(state.currentWorldId || 1);
      updateMainMenuSummary();
      requestAnimationFrame(animate);
      if (!ok && !/^https?:$/.test(location.protocol)) {
        setTimeout(() => showToast('🎨 Open the game from your GitHub Pages link to see the full artwork.'), 1200);
      }
    });
  });
})();
