/**
 * Toolpath Generator Module
 * Generates 3D contour milling toolpaths for selected regions
 */

class ToolpathGenerator {
  constructor() {
    this.mesh = null;
    this.bounds = null;
    this.params = {
      toolDiameter: 1.0,
      stepover: 0.4, // 40% of tool diameter
      stepdown: 0.5,
      feedRate: 100,
      safeZ: 5.0
    };

    this.toolpath = [];
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Set parameters
   */
  setParams(params) {
    this.params = { ...this.params, ...params };
  }

  /**
   * Generate toolpath for selected region
   * @param {THREE.Mesh} mesh - STL model mesh
   * @param {Object} bounds - Selection bounds {min, max}
   * @param {Function} progressCallback - Progress callback function
   */
  async generate(mesh, bounds, progressCallback = null) {
    this.mesh = mesh;
    this.bounds = bounds;
    this.toolpath = [];

    const toolRadius = this.params.toolDiameter / 2;
    const stepover = this.params.toolDiameter * this.params.stepover;

    // Calculate layers (Z slices)
    const zStart = bounds.max.z;
    const zEnd = bounds.min.z;
    const numLayers = Math.ceil((zStart - zEnd) / this.params.stepdown);

    console.log(`Generating toolpath: ${numLayers} layers`);

    // Generate toolpath layer by layer
    for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
      const zLevel = zStart - layerIdx * this.params.stepdown;
      const actualZ = Math.max(zLevel, zEnd);

      if (progressCallback) {
        progressCallback((layerIdx + 1) / numLayers);
      }

      // Generate contour for this Z level
      const contourPoints = await this.generateContourAtZ(actualZ, stepover, toolRadius);

      if (contourPoints.length > 0) {
        this.toolpath.push({
          layer: layerIdx,
          z: actualZ,
          points: contourPoints
        });
      }

      // Allow UI to update
      await this.sleep(0);
    }

    console.log(`Toolpath generated: ${this.toolpath.length} layers, ${this.getTotalPoints()} points`);

    return this.toolpath;
  }

  /**
   * Generate contour points at specific Z level
   * Uses parallel scanning with raycasting
   */
  async generateContourAtZ(zLevel, stepover, toolRadius) {
    const points = [];

    // Scan in X direction
    const xStart = this.bounds.min.x;
    const xEnd = this.bounds.max.x;
    const yStart = this.bounds.min.y;
    const yEnd = this.bounds.max.y;

    const numScans = Math.ceil((yEnd - yStart) / stepover);

    for (let scanIdx = 0; scanIdx < numScans; scanIdx++) {
      const y = yStart + scanIdx * stepover;

      if (y > yEnd) break;

      // Scan along X axis at this Y position
      const scanPoints = this.scanLine(xStart, xEnd, y, zLevel, toolRadius);

      // Alternate direction for zigzag pattern
      if (scanIdx % 2 === 1) {
        scanPoints.reverse();
      }

      points.push(...scanPoints);
    }

    return points;
  }

  /**
   * Scan a line and find intersection points with mesh
   */
  scanLine(xStart, xEnd, y, z, toolRadius) {
    const points = [];
    const scanStep = this.params.toolDiameter * 0.2; // Fine resolution

    const numSteps = Math.ceil((xEnd - xStart) / scanStep);

    for (let i = 0; i <= numSteps; i++) {
      const x = xStart + i * scanStep;

      // Raycast downward to find surface
      const surfaceZ = this.findSurfaceAtPoint(x, y, z);

      if (surfaceZ !== null) {
        // Check if this point needs machining
        const needsMachining = this.checkNeedsMachining(x, y, surfaceZ);

        if (needsMachining) {
          points.push(new THREE.Vector3(x, y, surfaceZ + toolRadius));
        }
      }
    }

    return points;
  }

  /**
   * Find surface Z coordinate at XY position using raycasting
   */
  findSurfaceAtPoint(x, y, maxZ) {
    // Cast ray downward from above
    const origin = new THREE.Vector3(x, y, maxZ + 100);
    const direction = new THREE.Vector3(0, 0, -1);

    this.raycaster.set(origin, direction);

    const intersects = this.raycaster.intersectObject(this.mesh);

    if (intersects.length > 0) {
      // Find first intersection within bounds
      for (let hit of intersects) {
        if (hit.point.z <= maxZ && hit.point.z >= this.bounds.min.z) {
          return hit.point.z;
        }
      }
    }

    return null;
  }

  /**
   * Check if a point needs machining (is inside selection and above minimum Z)
   */
  checkNeedsMachining(x, y, z) {
    // Check if inside selection bounds
    if (
      x < this.bounds.min.x || x > this.bounds.max.x ||
      y < this.bounds.min.y || y > this.bounds.max.y ||
      z < this.bounds.min.z || z > this.bounds.max.z
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get total number of toolpath points
   */
  getTotalPoints() {
    return this.toolpath.reduce((sum, layer) => sum + layer.points.length, 0);
  }

  /**
   * Get toolpath data
   */
  getToolpath() {
    return this.toolpath;
  }

  /**
   * Estimate machining time
   * @returns {number} Time in minutes
   */
  estimateTime() {
    let totalDistance = 0;

    for (let layer of this.toolpath) {
      for (let i = 1; i < layer.points.length; i++) {
        totalDistance += layer.points[i].distanceTo(layer.points[i - 1]);
      }
    }

    // Add rapid moves between layers
    const rapidMoves = this.toolpath.length * this.params.safeZ * 2;
    totalDistance += rapidMoves;

    // Time = distance / feed rate
    const timeMinutes = totalDistance / this.params.feedRate;

    return timeMinutes;
  }

  /**
   * Sleep utility for async operations
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear toolpath
   */
  clear() {
    this.toolpath = [];
    this.mesh = null;
    this.bounds = null;
  }
}
