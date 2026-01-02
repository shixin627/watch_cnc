/**
 * 3D Viewport Module
 * Manages Three.js scene, camera, renderer, and controls
 */

class Viewport {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.width = canvasElement.clientWidth;
    this.height = canvasElement.clientHeight;

    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Scene objects
    this.modelMesh = null;
    this.gridHelper = null;
    this.axesHelper = null;
    this.lights = [];

    // Animation
    this.animationId = null;

    this.init();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.width / this.height,
      0.1,
      10000
    );
    this.camera.position.set(100, 100, 100);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 5000;

    // Add lights
    this.addLights();

    // Add helpers
    this.addHelpers();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Start animation loop
    this.animate();
  }

  addLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);

    // Directional light 1 (main)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(100, 100, 50);
    dirLight1.castShadow = true;
    dirLight1.shadow.camera.near = 0.1;
    dirLight1.shadow.camera.far = 500;
    dirLight1.shadow.camera.right = 100;
    dirLight1.shadow.camera.left = -100;
    dirLight1.shadow.camera.top = 100;
    dirLight1.shadow.camera.bottom = -100;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    this.scene.add(dirLight1);
    this.lights.push(dirLight1);

    // Directional light 2 (fill)
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-50, 50, -50);
    this.scene.add(dirLight2);
    this.lights.push(dirLight2);

    // Hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 200, 0);
    this.scene.add(hemiLight);
    this.lights.push(hemiLight);
  }

  addHelpers() {
    // Grid helper
    this.gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    this.scene.add(this.gridHelper);

    // Axes helper
    this.axesHelper = new THREE.AxesHelper(50);
    this.scene.add(this.axesHelper);
  }

  /**
   * Load and display STL model
   * @param {THREE.BufferGeometry} geometry
   */
  loadModel(geometry) {
    // Remove existing model
    if (this.modelMesh) {
      this.scene.remove(this.modelMesh);
      this.modelMesh.geometry.dispose();
      this.modelMesh.material.dispose();
    }

    // Create material
    const material = new THREE.MeshPhongMaterial({
      color: 0x3498db,
      specular: 0x111111,
      shininess: 30,
      side: THREE.DoubleSide,
      flatShading: false
    });

    // Create mesh
    this.modelMesh = new THREE.Mesh(geometry, material);
    this.modelMesh.castShadow = true;
    this.modelMesh.receiveShadow = true;

    // Add to scene
    this.scene.add(this.modelMesh);

    // Center and fit camera
    this.fitCameraToModel();
  }

  /**
   * Fit camera to view entire model
   */
  fitCameraToModel() {
    if (!this.modelMesh) return;

    const bbox = new THREE.Box3().setFromObject(this.modelMesh);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());

    // Calculate camera distance
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2.5; // Add some margin

    // Position camera
    this.camera.position.set(
      center.x + cameraZ * 0.5,
      center.y + cameraZ * 0.7,
      center.z + cameraZ * 0.5
    );

    // Update controls target
    this.controls.target.copy(center);
    this.controls.update();

    // Update grid and axes position
    this.gridHelper.position.y = bbox.min.y;
    this.axesHelper.position.copy(center);
  }

  /**
   * Reset camera view
   */
  resetView() {
    this.fitCameraToModel();
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  /**
   * Animation loop
   */
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.modelMesh) {
      this.modelMesh.geometry.dispose();
      this.modelMesh.material.dispose();
    }

    this.renderer.dispose();
    this.controls.dispose();
  }
}

/**
 * Simple Orbit Controls Implementation
 * (Simplified version - for production, use THREE.OrbitControls from examples)
 */
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.target = new THREE.Vector3();
    this.enableDamping = false;
    this.dampingFactor = 0.05;
    this.screenSpacePanning = false;
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // Internal state
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    this.zoomChanged = false;

    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();

    this.panStart = new THREE.Vector2();
    this.panEnd = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();

    this.state = 'NONE';

    this.bindEvents();
  }

  bindEvents() {
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    this.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.domElement.addEventListener('wheel', (e) => this.onWheel(e));
  }

  onPointerDown(event) {
    if (event.button === 0) {
      this.state = 'ROTATE';
      this.rotateStart.set(event.clientX, event.clientY);
    } else if (event.button === 2) {
      this.state = 'PAN';
      this.panStart.set(event.clientX, event.clientY);
    }
  }

  onPointerMove(event) {
    if (this.state === 'ROTATE') {
      this.rotateEnd.set(event.clientX, event.clientY);
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);

      this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / this.domElement.clientHeight;
      this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight;

      this.rotateStart.copy(this.rotateEnd);
    } else if (this.state === 'PAN') {
      this.panEnd.set(event.clientX, event.clientY);
      this.panDelta.subVectors(this.panEnd, this.panStart);

      this.pan(this.panDelta.x, this.panDelta.y);

      this.panStart.copy(this.panEnd);
    }
  }

  onPointerUp() {
    this.state = 'NONE';
  }

  onWheel(event) {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.scale /= 0.95;
    } else {
      this.scale *= 0.95;
    }
  }

  pan(deltaX, deltaY) {
    const offset = new THREE.Vector3();
    const targetDistance = this.camera.position.distanceTo(this.target);

    offset.copy(this.camera.position).sub(this.target);

    const panLeft = new THREE.Vector3();
    panLeft.setFromMatrixColumn(this.camera.matrix, 0);
    panLeft.multiplyScalar(-deltaX * targetDistance / this.domElement.clientHeight);

    const panUp = new THREE.Vector3();
    panUp.setFromMatrixColumn(this.camera.matrix, 1);
    panUp.multiplyScalar(deltaY * targetDistance / this.domElement.clientHeight);

    this.panOffset.add(panLeft).add(panUp);
  }

  update() {
    const offset = new THREE.Vector3();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      this.camera.up,
      new THREE.Vector3(0, 1, 0)
    );
    const quatInverse = quat.clone().invert();

    offset.copy(this.camera.position).sub(this.target);
    offset.applyQuaternion(quat);

    this.spherical.setFromVector3(offset);

    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;

    this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));
    this.spherical.radius *= this.scale;
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

    this.target.add(this.panOffset);

    offset.setFromSpherical(this.spherical);
    offset.applyQuaternion(quatInverse);

    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }

    this.scale = 1;
  }

  dispose() {
    // Remove event listeners
  }
}
