/**
 * GeoTwin AI - 3D Hillslope Digital Twin Viewer
 * Implements interactive Three.js WebGL terrain with real-time geotechnical coloring,
 * dynamic rain particle storm system, disaster visualizers (cloudburst, cyclone, earthquake shake, flood pooling),
 * soil material palette switcher, dynamic slope deformation, sensor beacons, and displacement creep vectors.
 */

class TerrainDigitalTwin {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Objects
    this.terrainMesh = null;
    this.terrainGeo = null;
    this.wireMesh = null;
    this.waterPlane = null;
    this.floodMesh = null;
    this.failureSurface = null;
    this.sensorGroup = new THREE.Group();
    this.vectorGroup = new THREE.Group();
    this.rainParticles = null;
    this.rainGeo = null;

    // Lights
    this.ambientLight = null;
    this.sunLight = null;
    this.rimLight = null;

    // State
    this.showVectors = true;
    this.showWater = true;
    this.showSensors = true;
    this.currentFoS = 1.68;
    this.currentSlopeAngle = 28.0;
    this.currentSlipDepth = 3.5;
    this.currentSoilType = 'Clay';
    this.waterTableDepth = 4.8;
    this.displacementCm = 0.0;
    this.activeDisaster = null;
    this.pga = 0.0;
    this.rainIntensity = 0.0;

    // Camera animation targets
    this.targetCamPos = null;
    this.targetLookAt = null;

    // Soil Material Palettes
    this.soilPalettes = {
      'Clay': { baseR: 0.54, baseG: 0.27, baseB: 0.07, roughness: 0.9, metalness: 0.0, wireHex: 0x38bdf8 },
      'Sandy Soil': { baseR: 0.82, baseG: 0.70, baseB: 0.55, roughness: 0.6, metalness: 0.0, wireHex: 0xf59e0b },
      'Silty Soil': { baseR: 0.62, baseG: 0.61, baseB: 0.56, roughness: 0.85, metalness: 0.0, wireHex: 0x10b981 },
      'Gravel': { baseR: 0.35, baseG: 0.38, baseB: 0.44, roughness: 0.4, metalness: 0.1, wireHex: 0x94a3b8 },
      'Laterite': { baseR: 0.70, baseG: 0.13, baseB: 0.13, roughness: 0.8, metalness: 0.0, wireHex: 0xf97316 },
      'Weathered Rock': { baseR: 0.24, baseG: 0.21, baseB: 0.20, roughness: 0.3, metalness: 0.2, wireHex: 0x818cf8 }
    };

    this.init();
    window.twinViewer = this;
  }

  init() {
    if (!this.container) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 450;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.005);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    this.camera.position.set(70, 50, 90);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent going beneath ground
      this.controls.minDistance = 20;
      this.controls.maxDistance = 220;
      this.controls.target.set(0, 15, 0);
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Build 3D Components
    this.buildTerrain();
    this.buildWaterTablePlane();
    this.buildFloodWaterMesh();
    this.buildFailureSlipPlane();
    this.buildDisplacementVectors();
    this.buildSensorNodes();
    this.buildRainParticleSystem();

    // Add groups
    this.scene.add(this.sensorGroup);
    this.scene.add(this.vectorGroup);

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());

    // 8. Start Animation Loop
    this.animate();
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 0.9);
    this.sunLight.position.set(60, 90, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    this.rimLight.position.set(-50, 40, -40);
    this.scene.add(this.rimLight);

    const gridHelper = new THREE.GridHelper(180, 36, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.1;
    this.scene.add(gridHelper);
  }

  buildTerrain() {
    const xSegments = 60;
    const zSegments = 60;
    const width = 100;
    const depth = 90;

    this.terrainGeo = new THREE.PlaneGeometry(width, depth, xSegments, zSegments);
    this.terrainGeo.rotateX(-Math.PI / 2);

    this.deformTerrainVertices(this.currentSlopeAngle);

    const count = this.terrainGeo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const palette = this.soilPalettes[this.currentSoilType] || this.soilPalettes['Clay'];

    for (let i = 0; i < count; i++) {
      colors[i * 3] = palette.baseR;
      colors[i * 3 + 1] = palette.baseG;
      colors[i * 3 + 2] = palette.baseB;
    }
    this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: palette.roughness,
      metalness: palette.metalness,
      wireframe: false,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeo, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.scene.add(this.terrainMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: palette.wireHex,
      wireframe: true,
      transparent: true,
      opacity: 0.1
    });
    this.wireMesh = new THREE.Mesh(this.terrainGeo, wireMat);
    this.scene.add(this.wireMesh);
  }

  deformTerrainVertices(slopeAngle) {
    if (!this.terrainGeo) return;
    const pos = this.terrainGeo.attributes.position;
    const depth = 90;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const normZ = (depth / 2 - z) / depth; // 0 to 1
      const baseHeight = normZ * (depth * Math.tan(THREE.MathUtils.degToRad(slopeAngle)) * 0.7);
      const undulation = Math.sin(x * 0.08) * 3.5 + Math.cos(z * 0.06) * 2.2;
      pos.setY(i, Math.max(0, baseHeight + undulation));
    }

    pos.needsUpdate = true;
    this.terrainGeo.computeVertexNormals();
  }

  buildWaterTablePlane() {
    const geo = new THREE.PlaneGeometry(96, 86);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.8
    });

    this.waterPlane = new THREE.Mesh(geo, mat);
    this.waterPlane.position.set(0, 4.0, 0);
    this.scene.add(this.waterPlane);
  }

  buildFloodWaterMesh() {
    const geo = new THREE.PlaneGeometry(100, 45);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.0,
      roughness: 0.05,
      metalness: 0.9
    });

    this.floodMesh = new THREE.Mesh(geo, mat);
    this.floodMesh.position.set(0, 1.5, 20);
    this.scene.add(this.floodMesh);
  }

  buildFailureSlipPlane() {
    const geo = new THREE.CylinderGeometry(28, 28, 60, 24, 1, true, -Math.PI / 4, Math.PI / 2);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, 0.4, 1);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });

    this.failureSurface = new THREE.Mesh(geo, mat);
    this.failureSurface.position.set(0, 10, -5);
    this.scene.add(this.failureSurface);
  }

  buildDisplacementVectors() {
    this.vectorGroup.clear();
    const arrowCount = 14;
    for (let i = 0; i < arrowCount; i++) {
      const dir = new THREE.Vector3(0, -0.4, 0.9).normalize();
      const origin = new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        15 + Math.random() * 12,
        -10 + Math.random() * 30
      );
      const length = 4.5;
      const hex = 0x38bdf8;
      const arrow = new THREE.ArrowHelper(dir, origin, length, hex, 1.2, 0.6);
      this.vectorGroup.add(arrow);
    }
  }

  buildSensorNodes() {
    this.sensorGroup.clear();

    const sensorPositions = [
      { id: "RG-01", name: "Rain Gauge", pos: new THREE.Vector3(0, 32, -35), color: 0x38bdf8 },
      { id: "SM-01", name: "Soil Moisture", pos: new THREE.Vector3(-18, 22, -15), color: 0x10b981 },
      { id: "TL-01", name: "Tilt Inclinometer", pos: new THREE.Vector3(12, 19, -5), color: 0xf59e0b },
      { id: "AC-01", name: "Accelerometer", pos: new THREE.Vector3(-8, 14, 10), color: 0x818cf8 },
      { id: "PZ-01", name: "Piezometer", pos: new THREE.Vector3(15, 11, 20), color: 0x06b6d4 },
      { id: "GW-01", name: "Groundwater", pos: new THREE.Vector3(0, 6, 32), color: 0x3b82f6 }
    ];

    sensorPositions.forEach(s => {
      const stemGeo = new THREE.CylinderGeometry(0.25, 0.25, 4, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.copy(s.pos);
      this.sensorGroup.add(stem);

      const orbGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const orbMat = new THREE.MeshStandardMaterial({
        color: s.color,
        emissive: s.color,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(s.pos.x, s.pos.y + 2.4, s.pos.z);
      this.sensorGroup.add(orb);

      const ringGeo = new THREE.RingGeometry(1.4, 1.8, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(s.pos.x, s.pos.y + 0.1, s.pos.z);
      ring.userData = { pulsePhase: Math.random() * Math.PI };
      this.sensorGroup.add(ring);
    });
  }

  buildRainParticleSystem() {
    const particleCount = 1200;
    this.rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;     // x
      positions[i * 3 + 1] = Math.random() * 80 + 10;     // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110;    // z
      velocities[i] = 1.2 + Math.random() * 1.8;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainGeo.userData = { velocities };

    const rainMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.75,
      transparent: true,
      opacity: 0.0, // initially hidden until rain starts
      blending: THREE.AdditiveBlending
    });

    this.rainParticles = new THREE.Points(this.rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  updateState(telemetry) {
    if (!telemetry) return;

    const fos = telemetry.stability?.factor_of_safety || 1.68;
    this.currentFoS = fos;
    this.displacementCm = telemetry.stability?.displacement_cm || 0.0;
    this.waterTableDepth = telemetry.virtual_sensors?.groundwater_depth?.value || 4.8;
    this.currentSlopeAngle = telemetry.environment?.slope_angle_deg || 28.0;
    this.currentSlipDepth = telemetry.environment?.slip_surface_depth_m || 3.5;
    this.activeDisaster = telemetry.environment?.active_disaster || null;
    this.rainIntensity = telemetry.virtual_sensors?.rain_gauge?.value || 0.0;
    this.pga = telemetry.virtual_sensors?.accelerometer_pga?.value || 0.0;

    // Soil type update if changed
    if (telemetry.environment?.soil_type && telemetry.environment.soil_type !== this.currentSoilType) {
      this.setSoilType(telemetry.environment.soil_type);
    }

    // 1. Update 3D Terrain Vertex Colors (Risk heat gradient blended with soil base palette)
    if (this.terrainGeo) {
      const colors = this.terrainGeo.attributes.color;
      const pos = this.terrainGeo.attributes.position;
      const count = colors.count;
      const palette = this.soilPalettes[this.currentSoilType] || this.soilPalettes['Clay'];

      for (let i = 0; i < count; i++) {
        const y = pos.getY(i);
        const normY = y / 35.0;
        const localFoS = fos - (normY * 0.25);

        let r, g, b;
        if (localFoS > 1.5) {
          // Blend soil base with safe green accent
          r = palette.baseR * 0.6 + 0.06 * 0.4;
          g = palette.baseG * 0.6 + 0.72 * 0.4;
          b = palette.baseB * 0.6 + 0.50 * 0.4;
        } else if (localFoS > 1.2) {
          // Moderate - Amber blend
          r = 0.96; g = 0.62; b = 0.04;
        } else if (localFoS > 1.0) {
          // High Risk - Orange blend
          r = 0.97; g = 0.45; b = 0.08;
        } else {
          // Failure Imminent - Red
          r = 0.93; g = 0.26; b = 0.26;
        }

        colors.setXYZ(i, r, g, b);
      }
      colors.needsUpdate = true;
    }

    // 2. Water Table Plane Height
    if (this.waterPlane) {
      const targetWaterY = Math.max(1.0, 18.0 - (this.waterTableDepth * 2.8));
      this.waterPlane.position.y = targetWaterY;
    }

    // 3. Flood Surface Pooling Mesh (Flash Flood / Reservoir Overflow / Heavy Rain)
    if (this.floodMesh) {
      const isFlooding = this.activeDisaster === "Flash Flood" || this.activeDisaster === "Reservoir Overflow" || this.rainIntensity > 90.0;
      this.floodMesh.material.opacity = isFlooding ? 0.70 : 0.0;
      if (isFlooding) {
        this.floodMesh.position.y = Math.min(8.0, 2.0 + (this.rainIntensity / 30.0));
      }
    }

    // 4. Rain Particles & Storm Lighting
    if (this.rainParticles) {
      const isRaining = this.rainIntensity > 2.0 || ['Cloudburst', 'Cyclone Rainfall', 'Extreme Rainfall'].includes(this.activeDisaster);
      this.rainParticles.material.opacity = isRaining ? Math.min(0.85, 0.25 + (this.rainIntensity / 150.0)) : 0.0;

      // Darken sky fog during active rain/cloudburst disaster
      if (isRaining) {
        this.scene.background.setHex(0x020617);
        this.scene.fog.color.setHex(0x020617);
      } else {
        this.scene.background.setHex(0x060913);
        this.scene.fog.color.setHex(0x060913);
      }
    }

    // 5. Displacement Vectors
    if (this.vectorGroup) {
      const scaleFactor = Math.max(1.0, 1.0 + (this.displacementCm * 0.15));
      this.vectorGroup.children.forEach(arrow => {
        arrow.setLength(4.5 * scaleFactor, 1.2 * scaleFactor, 0.6 * scaleFactor);
        if (fos <= 1.0) {
          arrow.setColor(0xef4444);
        } else if (fos <= 1.2) {
          arrow.setColor(0xf97316);
        } else {
          arrow.setColor(0x38bdf8);
        }
      });
    }

    // 6. Failure Slip Surface
    if (this.failureSurface) {
      this.failureSurface.material.opacity = fos <= 1.1 ? 0.70 : 0.15;
      this.failureSurface.position.y = Math.max(2.0, 14.0 - this.currentSlipDepth * 1.5);
    }

    // 7. Update HUD Overlay & Disaster Badge
    this.updateDisasterHUD(this.activeDisaster, this.rainIntensity, this.pga);
  }

  setSoilType(soilType) {
    if (!this.soilPalettes[soilType]) return;
    this.currentSoilType = soilType;
    const palette = this.soilPalettes[soilType];

    if (this.terrainMesh) {
      this.terrainMesh.material.roughness = palette.roughness;
      this.terrainMesh.material.metalness = palette.metalness;
      this.terrainMesh.material.needsUpdate = true;
    }
    if (this.wireMesh) {
      this.wireMesh.material.color.setHex(palette.wireHex);
    }

    // Trigger vertex color update
    this.updateState({ stability: { factor_of_safety: this.currentFoS } });
    const hudSoil = document.getElementById('hud-soil-type');
    if (hudSoil) hudSoil.textContent = soilType;
  }

  setSlopeAngle(angle) {
    this.currentSlopeAngle = parseFloat(angle);
    this.deformTerrainVertices(this.currentSlopeAngle);
    this.updateState({ stability: { factor_of_safety: this.currentFoS } });
    const hudSlope = document.getElementById('hud-slope-angle');
    if (hudSlope) hudSlope.textContent = `${this.currentSlopeAngle.toFixed(1)}°`;
  }

  setSlipDepth(depth) {
    this.currentSlipDepth = parseFloat(depth);
    if (this.failureSurface) {
      this.failureSurface.position.y = Math.max(2.0, 14.0 - this.currentSlipDepth * 1.5);
    }
  }

  setCameraView(viewName) {
    if (!this.camera || !this.controls) return;
    if (viewName === 'perspective') {
      this.targetCamPos = new THREE.Vector3(70, 50, 90);
      this.targetLookAt = new THREE.Vector3(0, 15, 0);
    } else if (viewName === 'profile') {
      this.targetCamPos = new THREE.Vector3(110, 20, 0);
      this.targetLookAt = new THREE.Vector3(0, 15, 0);
    } else if (viewName === 'top') {
      this.targetCamPos = new THREE.Vector3(0, 120, 0.1);
      this.targetLookAt = new THREE.Vector3(0, 0, 0);
    }
  }

  toggleVectors() {
    this.showVectors = !this.showVectors;
    this.vectorGroup.visible = this.showVectors;
    return this.showVectors;
  }

  toggleWater() {
    this.showWater = !this.showWater;
    this.waterPlane.visible = this.showWater;
    return this.showWater;
  }

  toggleSensors() {
    this.showSensors = !this.showSensors;
    this.sensorGroup.visible = this.showSensors;
    return this.showSensors;
  }

  updateDisasterHUD(disaster, rain, pga) {
    let hudBadge = document.getElementById('disaster-hud-badge');
    let hudText = document.getElementById('disaster-hud-text');

    if (!hudBadge && this.container) {
      hudBadge = document.createElement('div');
      hudBadge.id = 'disaster-hud-badge';
      hudBadge.className = 'disaster-hud-badge';
      hudBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span id="disaster-hud-text"></span>`;
      this.container.appendChild(hudBadge);
      hudText = document.getElementById('disaster-hud-text');
    }

    if (!hudBadge || !hudText) return;

    if (disaster && disaster !== 'None') {
      hudBadge.style.display = 'flex';
      hudText.textContent = `CALAMITY INJECTED: ${disaster.toUpperCase()} ${rain > 0 ? `(${rain.toFixed(0)} mm/h)` : ''} ${pga > 0 ? `(PGA: ${pga.toFixed(3)}g)` : ''}`;
    } else {
      hudBadge.style.display = 'none';
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // 1. Smooth Camera Transition (Lerp)
    if (this.targetCamPos && this.camera && this.controls) {
      this.camera.position.lerp(this.targetCamPos, 0.08);
      this.controls.target.lerp(this.targetLookAt, 0.08);
      this.controls.update();

      if (this.camera.position.distanceTo(this.targetCamPos) < 0.2) {
        this.targetCamPos = null;
        this.targetLookAt = null;
      }
    } else if (this.controls) {
      this.controls.update();
    }

    // 2. Earthquake Seismic Camera & Terrain Shake Vibration Effect
    const isEarthquake = this.activeDisaster === "Earthquake" || this.pga > 0.01;
    if (isEarthquake && this.terrainMesh) {
      const shakeAmt = Math.min(1.4, (this.pga > 0 ? this.pga : 0.25) * 3.2);
      this.terrainMesh.position.x = (Math.random() - 0.5) * shakeAmt;
      this.terrainMesh.position.z = (Math.random() - 0.5) * shakeAmt;
    } else if (this.terrainMesh) {
      this.terrainMesh.position.set(0, 0, 0);
    }

    // 3. Rain Particle Motion Animation
    if (this.rainParticles && this.rainParticles.material.opacity > 0) {
      const pos = this.rainGeo.attributes.position;
      const velocities = this.rainGeo.userData.velocities;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        let y = pos.getY(i);
        y -= velocities[i] * (1.0 + (this.rainIntensity / 80.0));
        if (y < 0) y = Math.random() * 70 + 20;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;

      // Cloudburst lightning flash simulation
      if (this.activeDisaster === "Cloudburst" && Math.random() < 0.015 && this.sunLight) {
        this.sunLight.intensity = 2.8; // intense flash frame
      } else if (this.sunLight) {
        this.sunLight.intensity = 0.9;
      }
    }

    // 4. Sensor pulse rings animation
    const time = Date.now() * 0.0025;
    this.sensorGroup.children.forEach(child => {
      if (child.userData && child.userData.pulsePhase !== undefined) {
        const s = 1.0 + Math.sin(time + child.userData.pulsePhase) * 0.25;
        child.scale.set(s, s, s);
      }
    });

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Instantiate global twin and bind window.twinViewer
let twinViewer = null;
window.addEventListener('DOMContentLoaded', () => {
  twinViewer = new TerrainDigitalTwin('twin-viewport');
  window.twinViewer = twinViewer;
});
