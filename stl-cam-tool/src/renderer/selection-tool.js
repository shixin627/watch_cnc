/**
 * Selection Tool Module
 * Interactive bounding box selection for defining machining regions
 */

class SelectionTool {
  constructor(viewport) {
    this.viewport = viewport;
    this.scene = viewport.scene;
    this.camera = viewport.camera;
    this.renderer = viewport.renderer;

    // Selection state
    this.enabled = false;
    this.isSelecting = false;
    this.selectionBox = null;
    this.selectionHelper = null;

    // Bounding box
    this.bounds = {
      min: new THREE.Vector3(),
      max: new THREE.Vector3()
    };

    // Mouse state
    this.mouse = new THREE.Vector2();
    this.startPoint = new THREE.Vector3();
    this.endPoint = new THREE.Vector3();

    // Raycaster
    this.raycaster = new THREE.Raycaster();

    // Bind events
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  /**
   * Enable selection mode
   */
  enable() {
    if (this.enabled) return;
    this.enabled = true;

    // Disable orbit controls
    if (this.viewport.controls) {
      this.viewport.controls.enabled = false;
    }

    // Add event listeners
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);

    // Change cursor
    this.renderer.domElement.style.cursor = 'crosshair';
  }

  /**
   * Disable selection mode
   */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    // Re-enable orbit controls
    if (this.viewport.controls) {
      this.viewport.controls.enabled = true;
    }

    // Remove event listeners
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);

    // Reset cursor
    this.renderer.domElement.style.cursor = 'default';
  }

  /**
   * Clear selection
   */
  clear() {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.geometry.dispose();
      this.selectionHelper.material.dispose();
      this.selectionHelper = null;
    }

    this.bounds.min.set(0, 0, 0);
    this.bounds.max.set(0, 0, 0);
  }

  /**
   * Pointer down handler
   */
  onPointerDown(event) {
    if (!this.enabled || !this.viewport.modelMesh) return;

    this.isSelecting = true;

    // Get intersection with model
    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.viewport.modelMesh);

    if (intersects.length > 0) {
      this.startPoint.copy(intersects[0].point);

      // Create selection box helper
      this.createSelectionHelper();
    }
  }

  /**
   * Pointer move handler
   */
  onPointerMove(event) {
    if (!this.enabled || !this.isSelecting || !this.viewport.modelMesh) return;

    // Get intersection with model
    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.viewport.modelMesh);

    if (intersects.length > 0) {
      this.endPoint.copy(intersects[0].point);
      this.updateSelectionHelper();
    }
  }

  /**
   * Pointer up handler
   */
  onPointerUp(event) {
    if (!this.enabled || !this.isSelecting) return;

    this.isSelecting = false;

    // Finalize selection
    this.finalizeSelection();
  }

  /**
   * Update mouse coordinates
   */
  updateMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Create selection box helper
   */
  createSelectionHelper() {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.geometry.dispose();
      this.selectionHelper.material.dispose();
    }

    // Create box geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geometry);

    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });

    this.selectionHelper = new THREE.LineSegments(edges, material);
    this.scene.add(this.selectionHelper);

    // Also create a semi-transparent fill
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide
    });

    this.selectionFill = new THREE.Mesh(geometry, fillMaterial);
    this.scene.add(this.selectionFill);
  }

  /**
   * Update selection box helper
   */
  updateSelectionHelper() {
    if (!this.selectionHelper) return;

    // Calculate bounds
    this.bounds.min.set(
      Math.min(this.startPoint.x, this.endPoint.x),
      Math.min(this.startPoint.y, this.endPoint.y),
      Math.min(this.startPoint.z, this.endPoint.z)
    );

    this.bounds.max.set(
      Math.max(this.startPoint.x, this.endPoint.x),
      Math.max(this.startPoint.y, this.endPoint.y),
      Math.max(this.startPoint.z, this.endPoint.z)
    );

    // Calculate center and size
    const center = new THREE.Vector3();
    center.addVectors(this.bounds.min, this.bounds.max).multiplyScalar(0.5);

    const size = new THREE.Vector3();
    size.subVectors(this.bounds.max, this.bounds.min);

    // Update helper
    this.selectionHelper.position.copy(center);
    this.selectionHelper.scale.copy(size);

    if (this.selectionFill) {
      this.selectionFill.position.copy(center);
      this.selectionFill.scale.copy(size);
    }
  }

  /**
   * Finalize selection
   */
  finalizeSelection() {
    // Ensure minimum size
    const size = new THREE.Vector3();
    size.subVectors(this.bounds.max, this.bounds.min);

    const minSize = 0.1;
    if (size.x < minSize || size.y < minSize || size.z < minSize) {
      this.clear();
      return false;
    }

    return true;
  }

  /**
   * Get selection bounds
   */
  getBounds() {
    return {
      min: this.bounds.min.clone(),
      max: this.bounds.max.clone()
    };
  }

  /**
   * Get selection volume
   */
  getVolume() {
    const size = new THREE.Vector3();
    size.subVectors(this.bounds.max, this.bounds.min);
    return size.x * size.y * size.z;
  }

  /**
   * Check if point is inside selection
   */
  containsPoint(point) {
    return (
      point.x >= this.bounds.min.x && point.x <= this.bounds.max.x &&
      point.y >= this.bounds.min.y && point.y <= this.bounds.max.y &&
      point.z >= this.bounds.min.z && point.z <= this.bounds.max.z
    );
  }

  /**
   * Set bounds manually
   */
  setBounds(min, max) {
    this.bounds.min.copy(min);
    this.bounds.max.copy(max);

    this.startPoint.copy(min);
    this.endPoint.copy(max);

    this.createSelectionHelper();
    this.updateSelectionHelper();
  }
}
