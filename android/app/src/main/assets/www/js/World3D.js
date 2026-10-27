/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected Intellectual Property: PredictiveAI, NystromKernel, NeuroFlow, KernelMapper, Director.
 * Unauthorized copying, reverse-engineering, scraping, or redistribution is strictly prohibited.
 */
/**
 * World3D.js - Three.js Deep-Space Cosmos & Scene Management
 * Handles scene, camera, renderer, glittering starfields, volumetric nebulae, and planetary bodies
 */

class World3D {
  constructor(container) {
    this.container = container;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Check WebGL support before proceeding
    if (!this.checkWebGLSupport()) {
      this.showWebGLError();
      throw new Error('WebGL not supported');
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010812, 0.00065);

    // Camera - responsive FOV based on aspect ratio
    const aspectRatio = this.width / this.height;
    const baseFOV = 60;
    const responsiveFOV = aspectRatio > 1.78
      ? baseFOV + (aspectRatio - 1.78) * 15
      : aspectRatio < 0.56
        ? baseFOV - 10
        : baseFOV;

    this.camera = new THREE.PerspectiveCamera(
      Math.min(90, Math.max(45, responsiveFOV)),
      aspectRatio,
      0.1,
      2500
    );
    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(0, 0, 0);

    // Performance tracking for dynamic scaling
    this.frameTimeHistory = [];
    this.targetPixelRatio = Math.min(window.devicePixelRatio, 2.0);
    this.minPixelRatio = 1.0;
    this.maxPixelRatio = 2.0;
    this.lastQualityCheck = 0;

    let rendererOptions = {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      precision: "mediump",
      stencil: false,
      depth: true,
      failIfMajorPerformanceCaveat: false
    };

    try {
      this.renderer = new THREE.WebGLRenderer(rendererOptions);
    } catch (e) {
      console.warn('[World3D] Standard renderer failed, trying fallback:', e);
      rendererOptions = { antialias: false, alpha: false };
      this.renderer = new THREE.WebGLRenderer(rendererOptions);
    }

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.targetPixelRatio);
    this.renderer.setClearColor(0x01060f, 1);
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = "three-canvas";
    this.renderer.domElement.style.cursor = "none";

    // Procedural cosmic sprite textures (eliminates square points & boxy planes)
    this.starSpriteTex = this.createStarTexture(false);
    this.glitterSpriteTex = this.createStarTexture(true);
    this.nebulaCloudTex = this.createNebulaCloudTexture();

    // Lighting
    this.setupLighting();

    // Deep-Space Cosmos Elements
    this.stars = [];
    this.nebulaClouds = [];
    this.planetAtlas = typeof PlanetAtlas !== "undefined" ? new PlanetAtlas() : null;
    this.currentThemeSector = 0;
    this.cosmicSculptures = [];
    this.createStarfield();
    this.createPlanet();
    this.createNebula();
    this.createCosmicSculptures();

    // VFX systems
    this.createFreezeVFX();
    this.createImpactVFX();
    this.impactParticles = [];

    // Screen shake
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9;

    // Day/night visual state
    this.nightFactor = 0;

    // Freeze state
    this.freezeActive = false;
    this.freezeTime = 0;
    this.globalTimeScale = 1.0;
    this.targetTimeScale = 1.0;

    // Handle resize
    window.addEventListener("resize", () => this.onResize());
  }

  /**
   * Generates a procedural radial star sprite texture (with optional 4-point diffraction spikes)
   */
  createStarTexture(withSpikes = false) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;

    // Radial star glow
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.18, 'rgba(240, 249, 255, 0.92)');
    grad.addColorStop(0.45, 'rgba(125, 211, 252, 0.35)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    if (withSpikes) {
      // 4-point astronomical diffraction flare
      ctx.save();
      ctx.translate(half, half);
      for (let r = 0; r < 2; r++) {
        const spikeGrad = ctx.createLinearGradient(-half, 0, half, 0);
        spikeGrad.addColorStop(0.0, 'rgba(255,255,255,0)');
        spikeGrad.addColorStop(0.42, 'rgba(224,242,254,0.45)');
        spikeGrad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
        spikeGrad.addColorStop(0.58, 'rgba(224,242,254,0.45)');
        spikeGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
        ctx.fillStyle = spikeGrad;
        ctx.fillRect(-half, -1.2, size, 2.4);
        ctx.rotate(Math.PI / 2);
      }
      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Generates a soft, organic multi-lobe volumetric nebula cloud texture (zero hard edges)
   */
  createNebulaCloudTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;

    // Layer soft overlapping radial puffs so it reads as an organic cosmic gas cloud
    const puffs = [
      { x: half, y: half, r: half * 0.95, a: 0.55 },
      { x: half * 0.78, y: half * 0.88, r: half * 0.65, a: 0.4 },
      { x: half * 1.22, y: half * 1.08, r: half * 0.62, a: 0.4 },
      { x: half * 0.95, y: half * 0.72, r: half * 0.55, a: 0.35 },
      { x: half * 1.1, y: half * 1.22, r: half * 0.5, a: 0.3 }
    ];

    for (const p of puffs) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0.0, `rgba(255, 255, 255, ${p.a})`);
      g.addColorStop(0.4, `rgba(255, 255, 255, ${p.a * 0.55})`);
      g.addColorStop(0.75, `rgba(255, 255, 255, ${p.a * 0.15})`);
      g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Dynamic quality scaling based on frame time
  adaptQuality(frameTime) {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 30) this.frameTimeHistory.shift();

    const now = performance.now();
    if (now - this.lastQualityCheck < 500) return;
    this.lastQualityCheck = now;

    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    const fps = 1000 / avgFrameTime;

    if (fps < 50 && this.targetPixelRatio > this.minPixelRatio) {
      this.targetPixelRatio = Math.max(this.minPixelRatio, this.targetPixelRatio - 0.1);
      this.renderer.setPixelRatio(this.targetPixelRatio);
    } else if (fps > 58 && this.targetPixelRatio < this.maxPixelRatio) {
      this.targetPixelRatio = Math.min(this.maxPixelRatio, this.targetPixelRatio + 0.05);
      this.renderer.setPixelRatio(this.targetPixelRatio);
    }
  }

  createFreezeVFX() {
    const overlayGeometry = new THREE.PlaneGeometry(2000, 2000);
    const overlayMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    this.freezeOverlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
    this.freezeOverlay.position.z = 200;
    this.scene.add(this.freezeOverlay);

    this.iceCracks = [];
    for (let i = 0; i < 12; i++) {
      const points = [];
      const startX = (Math.random() - 0.5) * 1200;
      const startY = (Math.random() - 0.5) * 800;
      points.push(new THREE.Vector3(startX, startY, 150));

      let x = startX, y = startY;
      for (let j = 0; j < 5 + Math.floor(Math.random() * 5); j++) {
        x += (Math.random() - 0.5) * 100;
        y += (Math.random() - 0.5) * 100;
        points.push(new THREE.Vector3(x, y, 150));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xaaeeff,
        transparent: true,
        opacity: 0,
        linewidth: 2
      });
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.iceCracks.push(line);
    }
  }

  createImpactVFX() {
    this.impactPool = [];
    for (let i = 0; i < 50; i++) {
      const geometry = new THREE.SphereGeometry(3, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.impactPool.push({
        mesh,
        active: false,
        vx: 0, vy: 0, vz: 0,
        life: 0
      });
    }
  }

  triggerFreeze(duration = 2.5) {
    this.freezeActive = true;
    this.freezeTime = duration;
    this.freezeOverlay.material.opacity = 0.4;

    this.iceCracks.forEach(crack => {
      crack.material.opacity = 0.8;
      crack.position.x = (Math.random() - 0.5) * 400;
      crack.position.y = (Math.random() - 0.5) * 400;
      crack.rotation.z = Math.random() * Math.PI;
    });
  }

  spawnImpactGlow(x, y, color = 0x22d3ee, count = 8) {
    for (let i = 0; i < count; i++) {
      const particle = this.impactPool.find(p => !p.active);
      if (!particle) break;

      particle.active = true;
      particle.mesh.visible = true;
      particle.mesh.position.set(x, y, 0);
      particle.mesh.material.color.setHex(color);
      particle.mesh.material.opacity = 1;
      particle.mesh.scale.setScalar(1 + Math.random());

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 80 + Math.random() * 60;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.vz = (Math.random() - 0.5) * 40;
      particle.life = 0.4 + Math.random() * 0.3;
    }
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x3b4c66, 0.5);
    this.scene.add(this.ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(200, 300, 400);
    this.scene.add(mainLight);

    const accentLight = new THREE.PointLight(0x0ac8b9, 0.65, 850);
    accentLight.position.set(0, -200, 100);
    this.scene.add(accentLight);

    const goldLight = new THREE.PointLight(0xc8aa6e, 0.45, 650);
    goldLight.position.set(-200, 100, 200);
    this.scene.add(goldLight);
  }

  createStarfield() {
    // 1. Deep-Space Spectral Starfield (2,400 stars with authentic astronomical colors)
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2400;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    this.starBaseColors = new Float32Array(starCount * 3);

    const spectralPalette = [
      new THREE.Color(0x93c5fd), // O/B Blue-white giant
      new THREE.Color(0xf8fafc), // A Diamond white
      new THREE.Color(0xfef08a), // G Solar gold
      new THREE.Color(0xfdba74), // K Warm amber
      new THREE.Color(0xc4b5fd), // Violet-blue binary
      new THREE.Color(0x67e8f9)  // Cyan pulsar
    ];

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2400;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 2] = -180 - Math.random() * 1100;

      const c = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
      const brightness = 0.55 + Math.random() * 0.45;
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;

      this.starBaseColors[i * 3] = colors[i * 3];
      this.starBaseColors[i * 3 + 1] = colors[i * 3 + 1];
      this.starBaseColors[i * 3 + 2] = colors[i * 3 + 2];
    }

    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 7.5,
      map: this.starSpriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfield);

    // 2. Scintillating / Glittering Foreground Stars (360 bright diffraction-spike stars that actively twinkle)
    const glitterCount = 360;
    const glitterGeo = new THREE.BufferGeometry();
    const glitterPos = new Float32Array(glitterCount * 3);
    const glitterCol = new Float32Array(glitterCount * 3);
    this.glitterBaseColors = new Float32Array(glitterCount * 3);
    this.glitterPhases = new Float32Array(glitterCount);
    this.glitterSpeeds = new Float32Array(glitterCount);

    for (let i = 0; i < glitterCount; i++) {
      glitterPos[i * 3] = (Math.random() - 0.5) * 2200;
      glitterPos[i * 3 + 1] = (Math.random() - 0.5) * 1600;
      glitterPos[i * 3 + 2] = -120 - Math.random() * 750;

      const c = spectralPalette[i % spectralPalette.length];
      glitterCol[i * 3] = c.r;
      glitterCol[i * 3 + 1] = c.g;
      glitterCol[i * 3 + 2] = c.b;
      this.glitterBaseColors[i * 3] = c.r;
      this.glitterBaseColors[i * 3 + 1] = c.g;
      this.glitterBaseColors[i * 3 + 2] = c.b;

      this.glitterPhases[i] = Math.random() * Math.PI * 2;
      this.glitterSpeeds[i] = 2.5 + Math.random() * 6.5;
    }

    glitterGeo.setAttribute("position", new THREE.BufferAttribute(glitterPos, 3));
    glitterGeo.setAttribute("color", new THREE.BufferAttribute(glitterCol, 3));

    const glitterMat = new THREE.PointsMaterial({
      size: 18,
      map: this.glitterSpriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.glitterStars = new THREE.Points(glitterGeo, glitterMat);
    this.scene.add(this.glitterStars);

    // 3. Create Milky Way & Volumetric Nebulae
    this.createMilkyWay();
  }

  createMilkyWay() {
    // Dense galactic spiral band (3,600 soft glowing star clusters)
    const coreStarCount = 3600;
    const coreGeometry = new THREE.BufferGeometry();
    const corePositions = new Float32Array(coreStarCount * 3);
    const coreColors = new Float32Array(coreStarCount * 3);

    const bandAngle = Math.PI * 0.22;
    const cosA = Math.cos(bandAngle);
    const sinA = Math.sin(bandAngle);

    for (let i = 0; i < coreStarCount; i++) {
      const along = (Math.random() - 0.5) * 2800;
      // Gaussian-like concentration toward galactic equator
      const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * 190;
      const curve = Math.sin(along * 0.0015) * 110;

      const x = along * cosA - (gauss + curve) * sinA;
      const y = along * sinA + (gauss + curve) * cosA;
      const z = -650 - Math.random() * 500;

      corePositions[i * 3] = x;
      corePositions[i * 3 + 1] = y;
      corePositions[i * 3 + 2] = z;

      const distFromCore = Math.min(1, Math.abs(along) / 1400);
      // Warm golden-rose galactic core transitioning to cyan-violet outer spiral arms
      coreColors[i * 3] = 0.95 - distFromCore * 0.45;
      coreColors[i * 3 + 1] = 0.72 + (1 - distFromCore) * 0.18;
      coreColors[i * 3 + 2] = 0.65 + distFromCore * 0.35;
    }

    coreGeometry.setAttribute('position', new THREE.BufferAttribute(corePositions, 3));
    coreGeometry.setAttribute('color', new THREE.BufferAttribute(coreColors, 3));

    const coreMaterial = new THREE.PointsMaterial({
      size: 6.5,
      map: this.starSpriteTex,
      transparent: true,
      opacity: 0.65,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.milkyWayCore = new THREE.Points(coreGeometry, coreMaterial);
    this.scene.add(this.milkyWayCore);

    // Volumetric Cosmic Nebula Clouds (soft radial cloud textures, zero hard edges!)
    const cloudConfigs = [
      { x: -420, y: 180, z: -680, scale: 680, color: 0x4f46e5, opacity: 0.22 },
      { x: -120, y: 60,  z: -720, scale: 760, color: 0x9333ea, opacity: 0.18 },
      { x: 260,  y: -90, z: -660, scale: 640, color: 0x06b6d4, opacity: 0.20 },
      { x: 520,  y: 210, z: -740, scale: 720, color: 0xdb2777, opacity: 0.16 },
      { x: -580, y: -220,z: -700, scale: 620, color: 0x0ea5e9, opacity: 0.18 },
      { x: 80,   y: 260, z: -760, scale: 580, color: 0x10b981, opacity: 0.13 },
      { x: -240, y: -160,z: -640, scale: 540, color: 0x8b5cf6, opacity: 0.17 },
      { x: 390,  y: 40,  z: -690, scale: 600, color: 0xf59e0b, opacity: 0.12 }
    ];

    this.nebulaClouds = [];
    for (let i = 0; i < cloudConfigs.length; i++) {
      const cfg = cloudConfigs[i];
      const geo = new THREE.PlaneGeometry(cfg.scale, cfg.scale);
      const mat = new THREE.MeshBasicMaterial({
        map: this.nebulaCloudTex,
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.z = i * 0.85;
      mesh.userData = { baseOpacity: cfg.opacity, phase: i * 1.1, rotSpeed: (i % 2 === 0 ? 1 : -1) * 0.018 };
      this.scene.add(mesh);
      this.nebulaClouds.push(mesh);
    }
  }

  /**
   * Generates a procedural equirectangular planetary surface texture with atmospheric bands,
   * continents, storm vortices, and glowing tectonic rifts so 3D axial rotation is unmistakable.
   */
  createPlanetSurfaceTexture(baseColor, bandColor, accentColor, seed = 1) {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Deep planetary ocean / base coat
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);

    // Atmospheric latitude bands & jet streams
    for (let i = 0; i < 14; i++) {
      const y = ((i * 19 + seed * 13) % h);
      const bh = 8 + ((i * 7 + seed * 3) % 18);
      ctx.fillStyle = i % 2 === 0 ? bandColor : accentColor;
      ctx.globalAlpha = 0.22 + (i % 3) * 0.08;
      ctx.fillRect(0, y, w, bh);
    }

    // Continental landmasses & swirling storm cells (wrapped horizontally for seamless rotation)
    for (let i = 0; i < 28; i++) {
      const rx = ((i * 73 + seed * 41) % w);
      const ry = 24 + ((i * 37 + seed * 29) % (h - 48));
      const rw = 26 + ((i * 19) % 55);
      const rh = 10 + ((i * 11) % 24);
      ctx.fillStyle = i % 3 === 0 ? accentColor : bandColor;
      ctx.globalAlpha = 0.45 + (i % 4) * 0.12;

      for (const offset of [0, -w, w]) {
        ctx.beginPath();
        ctx.ellipse(rx + offset, ry, rw, rh, ((i % 5) - 2) * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Glowing tectonic rifts / bioluminescent longitudinal meridians (makes axial spin pop!)
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.65;
    for (let m = 0; m < 8; m++) {
      const mx = (m / 8) * w;
      ctx.beginPath();
      ctx.moveTo(mx, 20);
      ctx.bezierCurveTo(mx + 28, h * 0.35, mx - 28, h * 0.65, mx, h - 20);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  createPlanet() {
    // 1. Primary Sovereign Ringed Planet (Always visible, vivid axial rotation)
    const primaryTex = this.createPlanetSurfaceTexture('#0f172a', '#1e40af', '#38bdf8', 1);
    const planetGeometry = new THREE.SphereGeometry(82, 36, 28);
    const planetMaterial = new THREE.MeshStandardMaterial({
      map: primaryTex,
      color: 0xffffff,
      emissive: 0x0c4a6e,
      emissiveMap: primaryTex,
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.55
    });

    this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    this.planet.position.set(-260, 155, -420);
    this.planet.rotation.z = 0.22; // Axial tilt (obliquity)
    this.planet.rotation.x = 0.18;

    // Subtle planetary geodesic lattice (rotates with planet surface)
    const gridGeo = new THREE.IcosahedronGeometry(83.4, 2);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.22
    });
    this.planetGrid = new THREE.Mesh(gridGeo, gridMat);
    this.planet.add(this.planetGrid);

    // Orbiting Moon
    const moonGeo = new THREE.OctahedronGeometry(13, 1);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.3,
      flatShading: true
    });
    this.planetMoonPivot = new THREE.Group();
    this.planetMoon = new THREE.Mesh(moonGeo, moonMat);
    this.planetMoon.position.set(148, 0, 0);
    this.planetMoonPivot.add(this.planetMoon);
    this.planet.add(this.planetMoonPivot);

    this.scene.add(this.planet);

    // Multi-band Planetary Ring System
    const ringGeometry = new THREE.TorusGeometry(122, 6, 4, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    });

    this.planetRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.planetRing.position.copy(this.planet.position);
    this.planetRing.rotation.x = Math.PI / 2.5;

    const innerRingGeo = new THREE.TorusGeometry(104, 2.2, 4, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    this.planetRingInner = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.planetRing.add(this.planetRingInner);
    this.scene.add(this.planetRing);

    // Fresnel Atmosphere Halo
    const atmosphereGeometry = new THREE.SphereGeometry(96, 32, 32);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.atmosphere.position.copy(this.planet.position);
    this.scene.add(this.atmosphere);

    // Soft radial corona behind planet
    const glowGeometry = new THREE.PlaneGeometry(340, 340);
    const glowMaterial = new THREE.MeshBasicMaterial({
      map: this.nebulaCloudTex,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.planetGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.planetGlow.position.copy(this.planet.position);
    this.scene.add(this.planetGlow);

    // 2. Progressive Phase-Unlocked Cosmic Planets (More rotating planets appear as player unlocks new Sectors/Phases!)
    const secondaryConfigs = [
      {
        name: 'Vespera Emerald Giant',
        unlockSector: 1,
        x: 310, y: -165, z: -480,
        radius: 56,
        base: '#064e3b', band: '#059669', accent: '#34d399',
        ringColor: 0x34d399, glowColor: 0x10b981,
        rotSpeed: -0.46, tiltZ: -0.28, hasRing: true, hasMoon: true, seed: 2
      },
      {
        name: 'Pyros Magma Exoplanet',
        unlockSector: 2,
        x: 340, y: 185, z: -520,
        radius: 46,
        base: '#450a0a', band: '#dc2626', accent: '#f97316',
        ringColor: 0xf97316, glowColor: 0xef4444,
        rotSpeed: 0.58, tiltZ: 0.32, hasRing: false, hasMoon: true, seed: 3
      },
      {
        name: 'Cryon Sovereign Ice World',
        unlockSector: 3,
        x: -330, y: -180, z: -500,
        radius: 52,
        base: '#1e1b4b', band: '#4f46e5', accent: '#a855f7',
        ringColor: 0xc084fc, glowColor: 0x8b5cf6,
        rotSpeed: 0.50, tiltZ: 0.24, hasRing: true, hasMoon: true, seed: 4
      },
      {
        name: 'Xylos Bioluminescent Super-Earth',
        unlockSector: 4,
        x: 55, y: 235, z: -560,
        radius: 44,
        base: '#3b0764', band: '#db2777', accent: '#f472b6',
        ringColor: 0xf472b6, glowColor: 0xec4899,
        rotSpeed: -0.62, tiltZ: -0.19, hasRing: true, hasMoon: false, seed: 5
      },
      {
        name: 'Aethelgard Dyson Singularity Sphere',
        unlockSector: 6,
        x: -45, y: -235, z: -550,
        radius: 50,
        base: '#422006', band: '#ca8a04', accent: '#facc15',
        ringColor: 0xfacc15, glowColor: 0xeab308,
        rotSpeed: 0.72, tiltZ: 0.35, hasRing: true, hasMoon: true, seed: 6
      }
    ];

    this.secondaryPlanets = [];
    for (const cfg of secondaryConfigs) {
      const group = new THREE.Group();
      group.position.set(cfg.x, cfg.y, cfg.z);

      const tex = this.createPlanetSurfaceTexture(cfg.base, cfg.band, cfg.accent, cfg.seed);
      const bodyGeo = new THREE.SphereGeometry(cfg.radius, 28, 22);
      const bodyMat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        emissive: new THREE.Color(cfg.glowColor),
        emissiveMap: tex,
        emissiveIntensity: 0.42,
        metalness: 0.35,
        roughness: 0.55
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.z = cfg.tiltZ;

      // Geodesic wireframe overlay so rotation is crystal clear
      const wireGeo = new THREE.IcosahedronGeometry(cfg.radius * 1.018, 2);
      const wireMat = new THREE.MeshBasicMaterial({
        color: cfg.ringColor,
        wireframe: true,
        transparent: true,
        opacity: 0.2
      });
      const wire = new THREE.Mesh(wireGeo, wireMat);
      body.add(wire);
      group.add(body);

      let ring = null;
      if (cfg.hasRing) {
        const rGeo = new THREE.TorusGeometry(cfg.radius * 1.48, 3.2, 4, 48);
        const rMat = new THREE.MeshBasicMaterial({
          color: cfg.ringColor,
          transparent: true,
          opacity: 0.36,
          side: THREE.DoubleSide
        });
        ring = new THREE.Mesh(rGeo, rMat);
        ring.rotation.x = Math.PI / 2.4;
        ring.rotation.y = cfg.tiltZ;
        group.add(ring);
      }

      let moonPivot = null;
      if (cfg.hasMoon) {
        moonPivot = new THREE.Group();
        const mGeo = new THREE.OctahedronGeometry(cfg.radius * 0.17, 1);
        const mMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          emissive: cfg.ringColor,
          emissiveIntensity: 0.35,
          flatShading: true
        });
        const moon = new THREE.Mesh(mGeo, mMat);
        moon.position.set(cfg.radius * 1.85, 0, 0);
        moonPivot.add(moon);
        group.add(moonPivot);
      }

      const haloGeo = new THREE.PlaneGeometry(cfg.radius * 4.2, cfg.radius * 4.2);
      const haloMat = new THREE.MeshBasicMaterial({
        map: this.nebulaCloudTex,
        color: cfg.glowColor,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      group.add(halo);

      group.visible = cfg.unlockSector <= 1;
      this.scene.add(group);
      this.secondaryPlanets.push({
        group,
        body,
        ring,
        moonPivot,
        halo,
        cfg
      });
    }
  }

  createNebula() {
    // 650 Soft Radial Cosmic Stardust & Nebula Wisps (uses nebulaCloudTex so zero square blocks!)
    const nebulaGeometry = new THREE.BufferGeometry();
    const nebulaCount = 650;
    const positions = new Float32Array(nebulaCount * 3);
    const colors = new Float32Array(nebulaCount * 3);

    const colorPalette = [
      new THREE.Color(0x38bdf8), // Cyan
      new THREE.Color(0xa855f7), // Violet
      new THREE.Color(0xec4899), // Magenta
      new THREE.Color(0xf59e0b), // Amber Gold
      new THREE.Color(0x34d399)  // Aurora Emerald
    ];

    for (let i = 0; i < nebulaCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1800;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1600;
      positions[i * 3 + 2] = -150 - Math.random() * 750;

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    nebulaGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nebulaGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const nebulaMaterial = new THREE.PointsMaterial({
      size: 28,
      map: this.nebulaCloudTex,
      transparent: true,
      opacity: 0.34,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
    this.scene.add(this.nebula);
  }

  /**
   * Creates floating 3D Sacred-Geometry Creative Sculptures across the cosmos
   * so the space canvas feels like an interactive 3D Synth & Gravity Studio.
   */
  createCosmicSculptures() {
    this.cosmicSculptures = [];
    const configs = [
      { type: 'knot', x: -390, y: -60, z: -280, size: 22, color: 0x22d3ee },
      { type: 'gyro', x: 390,  y: 75,  z: -310, size: 26, color: 0xa855f7 },
      { type: 'prism',x: -150, y: -220,z: -260, size: 20, color: 0xf472b6 },
      { type: 'knot', x: 185,  y: 215, z: -290, size: 21, color: 0xfacc15 },
      { type: 'gyro', x: 0,    y: -255,z: -340, size: 28, color: 0x34d399 },
      { type: 'prism',x: 410,  y: -210,z: -300, size: 22, color: 0x60a5fa }
    ];

    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      const group = new THREE.Group();
      group.position.set(c.x, c.y, c.z);

      let geo;
      if (c.type === 'knot') {
        geo = new THREE.TorusKnotGeometry(c.size * 0.65, 2.2, 48, 8, 2, 3);
      } else if (c.type === 'gyro') {
        geo = new THREE.DodecahedronGeometry(c.size * 0.75, 0);
      } else {
        geo = new THREE.OctahedronGeometry(c.size * 0.85, 1);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: c.color,
        emissive: c.color,
        emissiveIntensity: 0.45,
        metalness: 0.8,
        roughness: 0.2,
        wireframe: i % 2 === 0,
        transparent: true,
        opacity: 0.42
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(c.size * 1.15, 0.9, 6, 32),
        new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.32 })
      );
      outerRing.rotation.x = Math.PI / 3;
      group.add(outerRing);

      this.scene.add(group);
      this.cosmicSculptures.push({ group, mesh, outerRing, basePos: { x: c.x, y: c.y, z: c.z }, phase: i * 1.3 });
    }
  }

  /**
   * Computes a smooth gravitational pull vector toward the active Stargate & planetary core
   * so flying feels physically hooked into the planet's gravity well!
   */
  getPlanetaryGravityPull(playerX, playerY, sector = 1, activeNodes = []) {
    let pullX = 0;
    let pullY = 0;
    const gravityScale = 1.0 + Math.min(1.2, (sector - 1) * 0.055);

    // 1. Gravitational pull toward active Resonance Stargate (orbital slingshot feel)
    if (activeNodes && activeNodes.length > 0) {
      const gate = activeNodes[0];
      const dx = gate.x - playerX;
      const dy = gate.y - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist > 38 && dist < 380) {
        const strength = (68 * gravityScale) * (1 - dist / 380);
        // Combine radial pull with subtle counter-clockwise orbital swirl
        const radX = dx / dist;
        const radY = dy / dist;
        const tangX = -radY;
        const tangY = radX;
        pullX += (radX * 0.78 + tangX * 0.22) * strength;
        pullY += (radY * 0.78 + tangY * 0.22) * strength;
      }
    }

    // 2. Subtle deep-well pull toward primary planet projection
    if (this.planet) {
      const px = this.planet.position.x * 0.45 - playerX;
      const py = this.planet.position.y * 0.45 - playerY;
      const pDist = Math.hypot(px, py) || 1;
      if (pDist > 50 && pDist < 450) {
        const pStrength = 22 * gravityScale * (1 - pDist / 450);
        pullX += (px / pDist) * pStrength;
        pullY += (py / pDist) * pStrength;
      }
    }

    return { x: pullX, y: pullY };
  }

  updateTheme(sector, nightFactor) {
    this.nightFactor = nightFactor;

    const fogDensity = 0.00065 + nightFactor * 0.00035;
    this.scene.fog.density = fogDensity;

    // When entering a new sector, dynamically apply the authentic Real-Planet Atlas profile!
    if (this.planetAtlas && typeof PlanetAtlas !== 'undefined' && this.currentThemeSector !== sector) {
      this.currentThemeSector = sector;
      const profile = PlanetAtlas.getProfile(sector);
      const texBundle = this.planetAtlas.getTextures(sector);
      this.currentPlanetProfile = profile;

      if (this.planet && this.planet.material && texBundle.map) {
        this.planet.material.map = texBundle.map;
        this.planet.material.emissiveMap = texBundle.map;
        this.planet.material.emissive = new THREE.Color(profile.atmo || '#38bdf8');
        this.planet.material.emissiveIntensity = profile.emissive || 0.38;
        this.planet.material.needsUpdate = true;
        this.planet.rotation.z = profile.tilt ?? 0.22;
        const scaleRatio = (profile.radius || 82) / 82;
        this.planet.scale.setScalar(scaleRatio);
      }

      const atmoColor = new THREE.Color(profile.atmo || '#38bdf8');
      if (this.atmosphere && this.atmosphere.material) {
        this.atmosphere.material.color.copy(atmoColor);
        this.atmosphere.material.opacity = Math.min(0.28, (profile.atmoS || 0.8) * 0.14);
      }
      if (this.planetGlow && this.planetGlow.material) {
        this.planetGlow.material.color.copy(atmoColor);
      }
      if (this.planetGrid && this.planetGrid.material) {
        this.planetGrid.material.color.copy(atmoColor);
      }
      if (this.planetRing) {
        this.planetRing.visible = Boolean(profile.ring || sector >= 5);
        this.planetRing.material.color.copy(atmoColor);
      }
      if (this.planetMoonPivot) {
        this.planetMoonPivot.visible = (profile.moons ?? 1) > 0;
      }
      if (this.renderer && profile.clear !== undefined) {
        this.renderer.setClearColor(profile.clear, 1);
      }

      // Tint background volumetric nebula clouds to match the real planet's astronomical spectrum
      if (this.nebulaClouds && profile.nebula && profile.nebula.length > 0) {
        for (let i = 0; i < this.nebulaClouds.length; i++) {
          const hex = profile.nebula[i % profile.nebula.length];
          this.nebulaClouds[i].material.color.setHex(hex);
        }
      }
    }

    // Reveal additional rotating planets as new Sectors/Phases are unlocked
    if (this.secondaryPlanets) {
      for (const sp of this.secondaryPlanets) {
        sp.group.visible = sector >= sp.cfg.unlockSector;
      }
    }

    this.nebula.material.opacity = 0.32 + nightFactor * 0.18;
  }

  shake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  update(time, deltaTime, playerPos = null, playerVelocity = null) {
    // ========================================
    // GRAVITATIONAL TIME DILATION (Relativity)
    // ========================================
    let timeDilation = 1.0;
    if (playerPos) {
      const distToCenter = Math.hypot(playerPos.x, playerPos.y) + 50;
      timeDilation = Math.max(0.3, 1.0 - (30 / distToCenter));

      const redshiftIntensity = Math.max(0, 1.0 - distToCenter / 200);
      if (this.ambientLight && redshiftIntensity > 0.01) {
        const r = 0.6 + redshiftIntensity * 0.4;
        const g = 0.6 - redshiftIntensity * 0.3;
        const b = 0.8 - redshiftIntensity * 0.5;
        this.ambientLight.color.setRGB(r, g, b);
      }
    }
    this.timeDilation = timeDilation;

    // ========================================
    // REAL-TIME STAR GLITTER / SCINTILLATION
    // ========================================
    if (this.glitterStars) {
      const gColors = this.glitterStars.geometry.attributes.color;
      const count = this.glitterPhases.length;
      for (let i = 0; i < count; i++) {
        // Sharp astronomical scintillation curve
        const wave = Math.sin(time * this.glitterSpeeds[i] + this.glitterPhases[i]);
        const twinkle = 0.35 + 0.65 * (wave * 0.5 + 0.5);
        const flash = wave > 0.92 ? 1.45 : twinkle;
        gColors.setXYZ(
          i,
          Math.min(1, this.glitterBaseColors[i * 3] * flash),
          Math.min(1, this.glitterBaseColors[i * 3 + 1] * flash),
          Math.min(1, this.glitterBaseColors[i * 3 + 2] * flash)
        );
      }
      gColors.needsUpdate = true;
      this.glitterStars.rotation.z += deltaTime * timeDilation * 0.006;
    }

    // ========================================
    // SPECTRAL DOPPLER SHIFT + SUBTLE SHIMMER
    // ========================================
    if (this.starfield) {
      const positions = this.starfield.geometry.attributes.position.array;
      const colors = this.starfield.geometry.attributes.color;
      const speed = playerVelocity ? Math.hypot(playerVelocity.x, playerVelocity.y) : 0;
      const moveAngle = playerVelocity ? Math.atan2(playerVelocity.y, playerVelocity.x) : 0;

      if (colors && speed > 20) {
        const shiftIntensity = Math.min(1.0, speed / 300);
        for (let i = 0; i < positions.length / 3; i++) {
          const starX = positions[i * 3];
          const starY = positions[i * 3 + 1];
          const starAngle = Math.atan2(starY, starX);
          const relAngle = Math.cos(starAngle - moveAngle);

          const r = Math.min(1, this.starBaseColors[i * 3] - relAngle * shiftIntensity * 0.22);
          const g = this.starBaseColors[i * 3 + 1];
          const b = Math.min(1, this.starBaseColors[i * 3 + 2] + relAngle * shiftIntensity * 0.25);

          colors.setXYZ(i, r, g, b);
        }
        colors.needsUpdate = true;
      }

      this.starfield.rotation.z += deltaTime * timeDilation * 0.008;
    }

    // Animate Volumetric Nebula Clouds (slow cosmic drift & breathing glow)
    if (this.nebulaClouds && this.nebulaClouds.length > 0) {
      for (let i = 0; i < this.nebulaClouds.length; i++) {
        const cloud = this.nebulaClouds[i];
        cloud.rotation.z += deltaTime * cloud.userData.rotSpeed;
        cloud.material.opacity = cloud.userData.baseOpacity * (0.82 + 0.25 * Math.sin(time * 0.7 + cloud.userData.phase));
      }
    }

    // Animate primary planet axial rotation, rings, and orbiting moon
    if (this.planet) {
      this.planet.rotation.y += deltaTime * 0.44;
    }
    if (this.planetMoonPivot) {
      this.planetMoonPivot.rotation.y += deltaTime * 0.65;
      this.planetMoonPivot.rotation.z = 0.25;
    }
    if (this.planetRing) {
      this.planetRing.rotation.z += deltaTime * 0.22;
    }

    // Animate all unlocked secondary cosmic planets (rotation + rings + moons)
    if (this.secondaryPlanets) {
      for (let i = 0; i < this.secondaryPlanets.length; i++) {
        const sp = this.secondaryPlanets[i];
        if (!sp.group.visible) continue;
        sp.body.rotation.y += deltaTime * sp.cfg.rotSpeed;
        if (sp.ring) {
          sp.ring.rotation.z -= deltaTime * sp.cfg.rotSpeed * 0.45;
        }
        if (sp.moonPivot) {
          sp.moonPivot.rotation.y += deltaTime * 0.75 * (i % 2 === 0 ? 1 : -1);
          sp.moonPivot.rotation.x = 0.3;
        }
        if (sp.halo) {
          sp.halo.material.opacity = 0.22 + 0.06 * Math.sin(time * 1.8 + i);
        }
      }
    }

    // Animate 3D Sacred-Geometry Creative Sculptures
    if (this.cosmicSculptures && this.cosmicSculptures.length > 0) {
      for (let i = 0; i < this.cosmicSculptures.length; i++) {
        const sc = this.cosmicSculptures[i];
        sc.mesh.rotation.x += deltaTime * 0.45;
        sc.mesh.rotation.y += deltaTime * 0.65;
        sc.outerRing.rotation.z -= deltaTime * 0.8;
        sc.group.position.y = sc.basePos.y + Math.sin(time * 1.4 + sc.phase) * 12;
      }
    }

    // Pulse planet corona glow
    if (this.planetGlow) {
      const pulse = 0.26 + Math.sin(time * 2) * 0.06;
      this.planetGlow.material.opacity = pulse;
    }

    // Animate nebula stardust wisps
    if (this.nebula) {
      this.nebula.rotation.z -= deltaTime * 0.012;
    }

    // Apply screen shake
    if (this.shakeIntensity > 0.01) {
      this.camera.position.x = (Math.random() - 0.5) * this.shakeIntensity * 10;
      this.camera.position.y = (Math.random() - 0.5) * this.shakeIntensity * 10;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.camera.position.x = 0;
      this.camera.position.y = 0;
      this.shakeIntensity = 0;
    }

    // Animate freeze VFX
    if (this.freezeActive) {
      this.freezeTime -= deltaTime;

      if (this.freezeTime <= 0) {
        this.freezeActive = false;
        this.freezeOverlay.material.opacity = 0;
        this.iceCracks.forEach(crack => {
          crack.material.opacity = 0;
        });
      } else {
        const pulse = 0.15 + 0.1 * Math.sin(time * 8);
        this.freezeOverlay.material.opacity = pulse;

        this.iceCracks.forEach((crack, i) => {
          crack.material.opacity = 0.5 + 0.3 * Math.sin(time * 6 + i);
          crack.rotation.z += deltaTime * 0.05 * (i % 2 ? 1 : -1);
        });
      }
    }

    // Animate impact particles
    for (const p of this.impactPool) {
      if (!p.active) continue;

      p.life -= deltaTime;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.x += p.vx * deltaTime;
      p.mesh.position.y += p.vy * deltaTime;
      p.mesh.position.z += p.vz * deltaTime;
      p.mesh.material.opacity = p.life / 0.5;

      const scale = p.mesh.scale.x + deltaTime * 3;
      p.mesh.scale.setScalar(scale);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  screenToWorld(screenX, screenY) {
    const vector = new THREE.Vector3(
      (screenX / this.width) * 2 - 1,
      -(screenY / this.height) * 2 + 1,
      0.5
    );

    vector.unproject(this.camera);

    const dir = vector.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    const worldPos = this.camera.position
      .clone()
      .add(dir.multiplyScalar(distance));

    return { x: worldPos.x, y: worldPos.y };
  }

  worldToScreen(worldX, worldY, worldZ = 0) {
    const vector = new THREE.Vector3(worldX, worldY, worldZ);
    vector.project(this.camera);

    return {
      x: (vector.x * 0.5 + 0.5) * this.width,
      y: (-vector.y * 0.5 + 0.5) * this.height
    };
  }

  getVisibleBounds() {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    return {
      left: -width / 2,
      right: width / 2,
      top: height / 2,
      bottom: -height / 2,
      width: width,
      height: height,
    };
  }

  dispose() {
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    this.renderer.dispose();
  }

  checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');

      if (!gl) {
        console.error('[World3D] WebGL not supported by browser');
        return false;
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        console.log('[World3D] WebGL Renderer:', renderer);

        if (renderer.includes('SwiftShader') || renderer.includes('llvmpipe')) {
          console.warn('[World3D] Software renderer detected - may be slow');
        }
      }

      return true;
    } catch (e) {
      console.error('[World3D] WebGL check failed:', e);
      return false;
    }
  }

  showWebGLError() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'webgl-error';
    errorDiv.innerHTML = `
      <div style="
        position: fixed;
        inset: 0;
        background: linear-gradient(180deg, #010a13 0%, #0a1628 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #f0e6d2;
        font-family: 'Inter', sans-serif;
        text-align: center;
        padding: 2rem;
        z-index: 9999;
      ">
        <h1 style="color: #f97316; font-size: 2rem; margin-bottom: 1rem;">⚠️ WebGL Required</h1>
        <p style="max-width: 400px; line-height: 1.6; color: #94a3b8;">
          This game requires WebGL to run. Your browser may be blocking it.
        </p>
        <button onclick="location.reload()" style="
          margin-top: 2rem;
          padding: 1rem 2rem;
          background: linear-gradient(to bottom, #1e2328 0%, #0a0a0c 100%);
          border: 1px solid #785a28;
          color: #cdbe91;
          font-weight: bold;
          cursor: pointer;
          border-radius: 4px;
        ">🔄 Reload Page</button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }

  applyFloatingOrigin(playerPos, entities) {
    const ORIGIN_THRESHOLD = 5000;
    const distance = Math.hypot(playerPos.x, playerPos.y);

    if (distance < ORIGIN_THRESHOLD) {
      return { shifted: false, offset: { x: 0, y: 0 } };
    }

    const offset = { x: playerPos.x, y: playerPos.y };
    console.log(`[FloatingOrigin] Shifting world by (${offset.x.toFixed(0)}, ${offset.y.toFixed(0)})`);

    if (entities.enemies) {
      for (const enemy of entities.enemies) {
        if (enemy && enemy.active !== false) {
          enemy.x -= offset.x;
          enemy.y -= offset.y;
          if (enemy.mesh) {
            enemy.mesh.position.x -= offset.x;
            enemy.mesh.position.y -= offset.y;
          }
        }
      }
    }

    if (entities.bullets) {
      for (const bullet of entities.bullets) {
        if (bullet) {
          bullet.x -= offset.x;
          bullet.y -= offset.y;
          if (bullet.mesh) {
            bullet.mesh.position.x -= offset.x;
            bullet.mesh.position.y -= offset.y;
          }
        }
      }
    }

    if (entities.collectibles) {
      for (const collectible of entities.collectibles) {
        if (collectible) {
          collectible.x -= offset.x;
          collectible.y -= offset.y;
          if (collectible.mesh) {
            collectible.mesh.position.x -= offset.x;
            collectible.mesh.position.y -= offset.y;
          }
        }
      }
    }

    for (const p of this.impactPool) {
      if (p.active && p.mesh) {
        p.mesh.position.x -= offset.x;
        p.mesh.position.y -= offset.y;
      }
    }

    return { shifted: true, offset: offset };
  }
}
