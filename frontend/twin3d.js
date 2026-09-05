/**
 * GeoTwin AI - 3D Hillslope Digital Twin Viewer
 * Implements interactive Three.js WebGL terrain with real-time geotechnical coloring,
 * sensor beacons, groundwater plane, slip plane, and animated displacement vectors.
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
    this.waterPlane = null;
    this.failureSurface = null;
    this.sensorGroup = new THREE.Group();
    this.vectorGroup = new THREE.Group();

    // State
    this.showVectors = true;
    this.showWater = true;
    this.showSensors = true;
    this.currentFoS = 1.68;
    this.currentSlopeAngle = 28.0;
    this.waterTableDepth = 4.8;
    this.displacementCm = 0.0;

    this.init();
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

    // 6. Build 3D Terrain & Components
    this.buildTerrain();
    this.buildWaterTablePlane();
    this.buildFailureSlipPlane();
    this.buildDisplacementVectors();
    this.buildSensorNodes();

    // Add groups
    this.scene.add(this.sensorGroup);
    this.scene.add(this.vectorGroup);

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());

    // 8. Start Animation Loop
    this.animate();
  }

  setupLighting() {
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    // Directional sunlight casting shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 0.9);
    sunLight.position.set(60, 90, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    this.scene.add(sunLight);

    // Subtle blue accent rim light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-50, 40, -40);
    this.scene.add(rimLight);

    // Subtle coordinate grid floor
    const gridHelper = new THREE.GridHelper(180, 36, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.1;
    this.scene.add(gridHelper);
  }

  buildTerrain() {
    // Terrain Dimensions
    const xSegments = 60;
    const zSegments = 60;
    const width = 100;
    const depth = 90;

    this.terrainGeo = new THREE.PlaneGeometry(width, depth, xSegments, zSegments);
    this.terrainGeo.rotateX(-Math.PI / 2);

    // Procedurally shape hillslope with slope angle and natural regolith undulations
    const pos = this.terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Height increases along negative z to simulate an inclined mountain flank
      const normZ = (depth / 2 - z) / depth; // 0 to 1
      const baseHeight = normZ * (depth * Math.tan(THREE.MathUtils.degToRad(this.currentSlopeAngle)) * 0.7);

      // Secondary terrain ridge undulations
      const undulation = Math.sin(x * 0.08) * 3.5 + Math.cos(z * 0.06) * 2.2;
      pos.setY(i, Math.max(0, baseHeight + undulation));
    }

    this.terrainGeo.computeVertexNormals();

    // Enable vertex colors for dynamic risk heat zones
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = 0.06;     // r
      colors[i * 3 + 1] = 0.72; // g (green safe baseline)
      colors[i * 3 + 2] = 0.50; // b
    }
    this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: false,
      flatShading: false
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeo, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.scene.add(this.terrainMesh);

    // Add wireframe overlay for tech aesthetic
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    });
    const wireMesh = new THREE.Mesh(this.terrainGeo, wireMat);
    this.scene.add(wireMesh);
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
    this.waterPlane.position.set(0, 4.0, 0); // initial water level
    this.scene.add(this.waterPlane);
  }

  buildFailureSlipPlane() {
    // Curved parabolic slip surface beneath the crest
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
      // Pin stem
      const stemGeo = new THREE.CylinderGeometry(0.25, 0.25, 4, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.copy(s.pos);
      this.sensorGroup.add(stem);

      // Glowing beacon orb
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

      // Pulse ring
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

  updateState(telemetry) {
    if (!telemetry) return;

    const fos = telemetry.stability?.factor_of_safety || 1.68;
    this.currentFoS = fos;
    this.displacementCm = telemetry.stability?.displacement_cm || 0.0;
    this.waterTableDepth = telemetry.virtual_sensors?.groundwater_depth?.value || 4.8;
    this.currentSlopeAngle = telemetry.environment?.slope_angle_deg || 28.0;

    // 1. Update 3D Terrain Vertex Coloring according to FoS
    if (this.terrainGeo) {
      const colors = this.terrainGeo.attributes.color;
      const pos = this.terrainGeo.attributes.position;
      const count = colors.count;

      for (let i = 0; i < count; i++) {
        const y = pos.getY(i);
        const normY = y / 35.0; // elevation weighting

        // Calculate localized safety factor variation along the slope
        const localFoS = fos - (normY * 0.25);

        let r, g, b;
        if (localFoS > 1.5) {
          // Safe - Green
          r = 0.06; g = 0.72; b = 0.50;
        } else if (localFoS > 1.2) {
          // Moderate - Yellow/Amber
          r = 0.96; g = 0.62; b = 0.04;
        } else if (localFoS > 1.0) {
          // High Risk - Orange
          r = 0.97; g = 0.45; b = 0.08;
        } else {
          // Failure Imminent - Red
          r = 0.93; g = 0.26; b = 0.26;
        }

        colors.setXYZ(i, r, g, b);
      }
      colors.needsUpdate = true;
    }

    // 2. Update Water Table Plane Height
    if (this.waterPlane) {
      // Invert depth: 5m depth = low height (y=2), 0.5m depth = near surface (y=16)
      const targetWaterY = Math.max(1.0, 18.0 - (this.waterTableDepth * 2.8));
      this.waterPlane.position.y = targetWaterY;
    }

    // 3. Update Displacement Vectors (scale length with creep)
    if (this.vectorGroup) {
      const scaleFactor = Math.max(1.0, 1.0 + (this.displacementCm * 0.15));
      this.vectorGroup.children.forEach(arrow => {
        arrow.setLength(4.5 * scaleFactor, 1.2 * scaleFactor, 0.6 * scaleFactor);
        // Turn red if failure imminent
        if (fos <= 1.0) {
          arrow.setColor(0xef4444);
        } else if (fos <= 1.2) {
          arrow.setColor(0xf97316);
        } else {
          arrow.setColor(0x38bdf8);
        }
      });
    }

    // 4. Highlight Failure Slip Plane if FoS <= 1.1
    if (this.failureSurface) {
      this.failureSurface.material.opacity = fos <= 1.1 ? 0.65 : 0.15;
    }
  }

  setCameraView(viewName) {
    if (!this.camera || !this.controls) return;
    if (viewName === 'perspective') {
      this.camera.position.set(70, 50, 90);
      this.controls.target.set(0, 15, 0);
    } else if (viewName === 'profile') {
      this.camera.position.set(110, 20, 0);
      this.controls.target.set(0, 15, 0);
    } else if (viewName === 'top') {
      this.camera.position.set(0, 120, 0);
      this.controls.target.set(0, 0, 0);
    }
    this.controls.update();
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

    if (this.controls) {
      this.controls.update();
    }

    // Animate sensor pulse rings
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

// Instantiate global twin
let twinViewer = null;
window.addEventListener('DOMContentLoaded', () => {
  twinViewer = new TerrainDigitalTwin('twin-viewport');
});
