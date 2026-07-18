/**
 * World3D.js - Three.js Scene Management
 * Handles scene, camera, renderer, background, and visual effects
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
    this.scene.fog = new THREE.FogExp2(0x010a13, 0.001);

    // Camera - responsive FOV based on aspect ratio
    // Prevents stretching on 21:9 ultra-wide phones
    const aspectRatio = this.width / this.height;
    const baseFOV = 60;
    // Widen FOV for ultra-wide screens (>16:9), narrow for tall screens (<16:9)
    const responsiveFOV = aspectRatio > 1.78
      ? baseFOV + (aspectRatio - 1.78) * 15   // Ultra-wide: increase FOV
      : aspectRatio < 0.56
        ? baseFOV - 10                        // Very tall: decrease FOV
        : baseFOV;                            // Standard: use base

    this.camera = new THREE.PerspectiveCamera(
      Math.min(90, Math.max(45, responsiveFOV)), // Clamp 45-90
      aspectRatio,
      0.1,
      2000
    );
    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(0, 0, 0);

    // Performance tracking for dynamic scaling
    this.frameTimeHistory = [];
    this.targetPixelRatio = Math.min(window.devicePixelRatio, 2.0);
    this.minPixelRatio = 1.0;
    this.maxPixelRatio = 2.0; // Never exceed 2x on mobile
    this.lastQualityCheck = 0;

    // Renderer - optimized for mobile and browser compatibility
    // Try WebGL2 first, fall back to WebGL1 for Brave/Safari
    let rendererOptions = {
      antialias: false, // AA is expensive, disabled for mobile perf
      alpha: false,
      powerPreference: "high-performance",
      precision: "mediump", // mediump sufficient for this art style
      stencil: false,
      depth: true,
      failIfMajorPerformanceCaveat: false // Allow software rendering as fallback
    };

    try {
      this.renderer = new THREE.WebGLRenderer(rendererOptions);
    } catch (e) {
      console.warn('[World3D] Standard renderer failed, trying fallback:', e);
      // Fallback with minimal options
      rendererOptions = { antialias: false, alpha: false };
      this.renderer = new THREE.WebGLRenderer(rendererOptions);
    }

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.targetPixelRatio);
    this.renderer.setClearColor(0x010a13, 1);
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = "three-canvas";
    this.renderer.domElement.style.cursor = "none";

    // Lighting - reduced to 3 lights max for mobile
    this.setupLighting();

    // Background elements
    this.stars = [];
    this.createStarfield();
    this.createPlanet();
    this.createNebula();

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

  // Dynamic quality scaling based on frame time
  adaptQuality(frameTime) {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 30) this.frameTimeHistory.shift();

    // Only check every 500ms to avoid jitter
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
    // Freeze overlay - ice/frost effect
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

    // Ice crack lines
    this.iceCracks = [];
    for (let i = 0; i < 12; i++) {
      const points = [];
      const startX = (Math.random() - 0.5) * 1200;
      const startY = (Math.random() - 0.5) * 800;
      points.push(new THREE.Vector3(startX, startY, 150));

      // Create branching crack
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
    // Pre-create impact glow particles pool
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

  // Trigger freeze effect - universe cracks and freezes
  triggerFreeze(duration = 2.5) {
    this.freezeActive = true;
    this.freezeTime = duration;

    // Flash overlay
    this.freezeOverlay.material.opacity = 0.4;

    // Show ice cracks with random positions
    this.iceCracks.forEach(crack => {
      crack.material.opacity = 0.8;
      crack.position.x = (Math.random() - 0.5) * 400;
      crack.position.y = (Math.random() - 0.5) * 400;
      crack.rotation.z = Math.random() * Math.PI;
    });
  }

  // Spawn impact glow particles at position
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
    // Ambient light for base visibility
    const ambient = new THREE.AmbientLight(0x334455, 0.4);
    this.scene.add(ambient);

    // Main directional light (sun-like)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(200, 300, 400);
    this.scene.add(mainLight);

    // Cyan accent light from below
    const accentLight = new THREE.PointLight(0x0ac8b9, 0.6, 800);
    accentLight.position.set(0, -200, 100);
    this.scene.add(accentLight);

    // Gold accent light
    const goldLight = new THREE.PointLight(0xc8aa6e, 0.4, 600);
    goldLight.position.set(-200, 100, 200);
    this.scene.add(goldLight);
  }

  createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1000 - 300;
      sizes[i] = Math.random() * 2 + 0.5;
    }

    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    starGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 2,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    this.starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfield);

    // Create Milky Way galaxy background
    this.createMilkyWay();
  }

  createMilkyWay() {
    // Dense star band (Milky Way core)
    const coreStarCount = 3000;
    const coreGeometry = new THREE.BufferGeometry();
    const corePositions = new Float32Array(coreStarCount * 3);
    const coreColors = new Float32Array(coreStarCount * 3);

    for (let i = 0; i < coreStarCount; i++) {
      // Band across the sky (diagonal)
      const t = Math.random();
      const spread = 150 + Math.random() * 200;
      const bandAngle = Math.PI * 0.2; // Tilt of galaxy band

      corePositions[i * 3] = (t - 0.5) * 3000 + (Math.random() - 0.5) * spread;
      corePositions[i * 3 + 1] = Math.sin(bandAngle) * (t - 0.5) * 600 + (Math.random() - 0.5) * spread * 0.5;
      corePositions[i * 3 + 2] = -800 - Math.random() * 400;

      // Color gradient (warm core, blue edges)
      const warmth = Math.abs(t - 0.5) * 2;
      coreColors[i * 3] = 0.8 + warmth * 0.2; // R
      coreColors[i * 3 + 1] = 0.7 + warmth * 0.1; // G
      coreColors[i * 3 + 2] = 0.6 + (1 - warmth) * 0.4; // B
    }

    coreGeometry.setAttribute('position', new THREE.BufferAttribute(corePositions, 3));
    coreGeometry.setAttribute('color', new THREE.BufferAttribute(coreColors, 3));

    const coreMaterial = new THREE.PointsMaterial({
      size: 1.5,
      transparent: true,
      opacity: 0.5,
      vertexColors: true,
      blending: THREE.AdditiveBlending
    });

    this.milkyWayCore = new THREE.Points(coreGeometry, coreMaterial);
    this.scene.add(this.milkyWayCore);

    // Nebula clouds (soft glow regions)
    for (let i = 0; i < 5; i++) {
      const nebulaGeometry = new THREE.PlaneGeometry(400 + Math.random() * 300, 150 + Math.random() * 100);
      const nebulaColor = [0x6366f1, 0xa855f7, 0x22d3ee, 0xf472b6, 0x4ade80][i];
      const nebulaMaterial = new THREE.MeshBasicMaterial({
        color: nebulaColor,
        transparent: true,
        opacity: 0.08 + Math.random() * 0.06,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });

      const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
      nebula.position.set(
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 400 + 100,
        -700 - Math.random() * 300
      );
      nebula.rotation.z = Math.random() * Math.PI;
      nebula.rotation.x = Math.random() * 0.3;
      this.scene.add(nebula);
    }

    // Cosmic dust band (subtle dark lane)
    const dustGeometry = new THREE.PlaneGeometry(3000, 80);
    const dustMaterial = new THREE.MeshBasicMaterial({
      color: 0x000011,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.dustLane = new THREE.Mesh(dustGeometry, dustMaterial);
    this.dustLane.position.set(0, 50, -750);
    this.dustLane.rotation.z = Math.PI * 0.1;
    this.scene.add(this.dustLane);
  }

  createPlanet() {
    // Main planet sphere - PBR with clearcoat for reflective surface
    const planetGeometry = new THREE.SphereGeometry(80, 32, 32);
    const planetMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a2e,
      emissive: 0x0a0a15,
      emissiveIntensity: 0.3,
      metalness: 0.4,
      roughness: 0.6,
      clearcoat: 0.8,
      clearcoatRoughness: 0.3
    });

    this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    this.planet.position.set(-250, 150, -400);
    this.scene.add(this.planet);

    // Planet rings
    const ringGeometry = new THREE.TorusGeometry(120, 8, 2, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });

    this.planetRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.planetRing.position.copy(this.planet.position);
    this.planetRing.rotation.x = Math.PI / 2.5;
    this.scene.add(this.planetRing);

    // ========================================
    // FRESNEL ATMOSPHERE: Outer glow for light scattering
    // Simulates atmospheric haze around planet
    // ========================================
    const atmosphereGeometry = new THREE.SphereGeometry(95, 32, 32);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,  // Render inside for glow effect
      blending: THREE.AdditiveBlending
    });
    this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.atmosphere.position.copy(this.planet.position);
    this.scene.add(this.atmosphere);

    // Inner glow effect
    const glowGeometry = new THREE.SphereGeometry(90, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });

    this.planetGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.planetGlow.position.copy(this.planet.position);
    this.scene.add(this.planetGlow);
  }

  createNebula() {
    // Nebula particles for atmospheric effect
    const nebulaGeometry = new THREE.BufferGeometry();
    const nebulaCount = 500;
    const positions = new Float32Array(nebulaCount * 3);
    const colors = new Float32Array(nebulaCount * 3);

    const colorPalette = [
      new THREE.Color(0x38bdf8), // Cyan
      new THREE.Color(0xa855f7), // Purple
      new THREE.Color(0xec4899), // Pink
      new THREE.Color(0xf97316), // Orange
    ];

    for (let i = 0; i < nebulaCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1500;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 800 - 200;

      const color =
        colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    nebulaGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    nebulaGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const nebulaMaterial = new THREE.PointsMaterial({
      size: 15,
      transparent: true,
      opacity: 0.3,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
    this.scene.add(this.nebula);
  }

  updateTheme(sector, nightFactor) {
    this.nightFactor = nightFactor;

    // Update fog based on night
    const fogDensity = 0.001 + nightFactor * 0.0005;
    this.scene.fog.density = fogDensity;

    // Update planet ring color based on sector
    if (sector >= 9) {
      // Exoplanet - purple
      this.planetRing.material.color.setHex(0xa855f7);
    } else if (sector >= 7) {
      // Ice giants - cyan
      this.planetRing.material.color.setHex(0x22d3ee);
    } else if (sector >= 5) {
      // Gas giants - gold
      this.planetRing.material.color.setHex(0xeab308);
    } else if (sector >= 4) {
      // Mars - orange
      this.planetRing.material.color.setHex(0xf97316);
    } else {
      // Inner planets - cyan
      this.planetRing.material.color.setHex(0x38bdf8);
    }

    // Night overlay effect
    const overlayOpacity = nightFactor * 0.15;
    this.nebula.material.opacity = 0.3 + nightFactor * 0.2;
  }

  shake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  update(time, deltaTime, playerPos = null, playerVelocity = null) {
    // ========================================
    // GRAVITATIONAL TIME DILATION (Relativity)
    // Time slows near center (0,0,0) - the singularity
    // ========================================
    let timeDilation = 1.0;
    if (playerPos) {
      const distToCenter = Math.hypot(playerPos.x, playerPos.y) + 50; // +50 prevents div/0
      timeDilation = Math.max(0.3, 1.0 - (30 / distToCenter)); // Min 30% speed near center

      // GRAVITATIONAL REDSHIFT: Tint scene red near singularity
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
    // SPECTRAL DOPPLER SHIFT (Special Relativity)
    // Stars shift blue in front, red behind based on velocity
    // ========================================
    if (this.starfield && playerVelocity) {
      const speed = Math.hypot(playerVelocity.x, playerVelocity.y);
      const moveAngle = Math.atan2(playerVelocity.y, playerVelocity.x);

      // Apply per-star color shift based on relative angle
      const positions = this.starfield.geometry.attributes.position.array;
      const colors = this.starfield.geometry.attributes.color;

      if (colors && speed > 20) {
        const shiftIntensity = Math.min(1.0, speed / 300);
        for (let i = 0; i < positions.length / 3; i++) {
          const starX = positions[i * 3];
          const starY = positions[i * 3 + 1];
          const starAngle = Math.atan2(starY, starX);
          const relAngle = Math.cos(starAngle - moveAngle); // -1 behind, +1 ahead

          // Blueshift ahead, redshift behind
          const r = 0.9 - relAngle * shiftIntensity * 0.3;
          const g = 0.9;
          const b = 0.9 + relAngle * shiftIntensity * 0.3;

          colors.setXYZ(i, r, g, b);
        }
        colors.needsUpdate = true;
      }
    }

    // Rotate starfield slowly (apply time dilation)
    if (this.starfield) {
      this.starfield.rotation.z += deltaTime * timeDilation * 0.01;
    }

    // Animate planet
    if (this.planet) {
      this.planet.rotation.y += deltaTime * 0.05;
    }
    if (this.planetRing) {
      this.planetRing.rotation.z += deltaTime * 0.1;
    }

    // Pulse planet glow
    if (this.planetGlow) {
      const pulse = 0.12 + Math.sin(time * 2) * 0.03;
      this.planetGlow.material.opacity = pulse;
    }

    // Animate nebula
    if (this.nebula) {
      this.nebula.rotation.y += deltaTime * 0.02;
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
        // Pulse freeze overlay
        const pulse = 0.15 + 0.1 * Math.sin(time * 8);
        this.freezeOverlay.material.opacity = pulse;

        // Animate ice cracks - shimmer effect
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

      // Move particle
      p.mesh.position.x += p.vx * deltaTime;
      p.mesh.position.y += p.vy * deltaTime;
      p.mesh.position.z += p.vz * deltaTime;

      // Fade out
      p.mesh.material.opacity = p.life / 0.5;

      // Grow slightly
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

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    // For our setup, we map screen coords directly to a plane at z=0
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

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX, worldY, worldZ = 0) {
    const vector = new THREE.Vector3(worldX, worldY, worldZ);
    vector.project(this.camera);

    return {
      x: (vector.x * 0.5 + 0.5) * this.width,
      y: (-vector.y * 0.5 + 0.5) * this.height
    };
  }

  // Get visible bounds at z=0
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
    // Clean up Three.js resources
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

  // Check if WebGL is available (blocked by Brave shields, older browsers, etc.)
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

      // Check for major performance issues
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        console.log('[World3D] WebGL Renderer:', renderer);

        // Check for software/blocked renderers
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

  // Show user-friendly error when WebGL is unavailable
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
        <div style="margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; max-width: 400px;">
          <p style="color: #c8aa6e; font-weight: bold; margin-bottom: 0.5rem;">Brave Browser Users:</p>
          <p style="color: #94a3b8; font-size: 0.9rem;">
            Click the 🦁 lion icon → Turn off "Shields" for this site
          </p>
        </div>
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; max-width: 400px;">
          <p style="color: #c8aa6e; font-weight: bold; margin-bottom: 0.5rem;">Mobile Users:</p>
          <p style="color: #94a3b8; font-size: 0.9rem;">
            Try Chrome or Safari. Disable battery saver mode.
          </p>
        </div>
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

  // ========================================
  // FLOATING ORIGIN: IEEE-754 Precision Fix
  // When player > 5000 units from origin, shift entire world
  // This prevents floating-point precision loss in Raycaster
  // ========================================
  applyFloatingOrigin(playerPos, entities) {
    const ORIGIN_THRESHOLD = 5000;
    const distance = Math.hypot(playerPos.x, playerPos.y);

    if (distance < ORIGIN_THRESHOLD) {
      return { shifted: false, offset: { x: 0, y: 0 } };
    }

    // Calculate offset to shift everything back to origin
    const offset = { x: playerPos.x, y: playerPos.y };

    console.log(`[FloatingOrigin] Shifting world by (${offset.x.toFixed(0)}, ${offset.y.toFixed(0)})`);

    // Shift all entities in the scene
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

    // Shift impact particles
    for (const p of this.impactPool) {
      if (p.active && p.mesh) {
        p.mesh.position.x -= offset.x;
        p.mesh.position.y -= offset.y;
      }
    }

    return { shifted: true, offset: offset };
  }
}
