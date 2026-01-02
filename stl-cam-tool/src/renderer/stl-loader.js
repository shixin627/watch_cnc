/**
 * STL File Loader Module
 * Handles loading and parsing of both ASCII and Binary STL files
 */

class STLLoader {
  constructor() {
    this.model = null;
    this.geometry = null;
  }

  /**
   * Load STL file from ArrayBuffer
   * @param {ArrayBuffer} buffer - STL file data
   * @returns {THREE.BufferGeometry} - Parsed geometry
   */
  load(buffer) {
    const isBinary = this.isBinarySTL(buffer);

    if (isBinary) {
      this.geometry = this.parseBinary(buffer);
    } else {
      this.geometry = this.parseASCII(buffer);
    }

    // Compute normals and bounding box
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();

    return this.geometry;
  }

  /**
   * Check if STL file is binary format
   * @param {ArrayBuffer} buffer
   * @returns {boolean}
   */
  isBinarySTL(buffer) {
    const view = new DataView(buffer);
    const numTriangles = view.getUint32(80, true);
    const expectedSize = 84 + numTriangles * 50;

    // If size matches binary format, it's likely binary
    return buffer.byteLength === expectedSize;
  }

  /**
   * Parse Binary STL
   * Binary STL format:
   * - 80 bytes header
   * - 4 bytes: number of triangles (uint32)
   * - For each triangle (50 bytes):
   *   - 12 bytes: normal vector (3 floats)
   *   - 12 bytes: vertex 1 (3 floats)
   *   - 12 bytes: vertex 2 (3 floats)
   *   - 12 bytes: vertex 3 (3 floats)
   *   - 2 bytes: attribute byte count (uint16)
   */
  parseBinary(buffer) {
    const view = new DataView(buffer);
    const numTriangles = view.getUint32(80, true);

    const positions = new Float32Array(numTriangles * 9);
    const normals = new Float32Array(numTriangles * 9);

    let offset = 84;

    for (let i = 0; i < numTriangles; i++) {
      const normalOffset = offset;
      const v1Offset = offset + 12;
      const v2Offset = offset + 24;
      const v3Offset = offset + 36;

      // Read normal
      const nx = view.getFloat32(normalOffset, true);
      const ny = view.getFloat32(normalOffset + 4, true);
      const nz = view.getFloat32(normalOffset + 8, true);

      // Read vertices
      const v1x = view.getFloat32(v1Offset, true);
      const v1y = view.getFloat32(v1Offset + 4, true);
      const v1z = view.getFloat32(v1Offset + 8, true);

      const v2x = view.getFloat32(v2Offset, true);
      const v2y = view.getFloat32(v2Offset + 4, true);
      const v2z = view.getFloat32(v2Offset + 8, true);

      const v3x = view.getFloat32(v3Offset, true);
      const v3y = view.getFloat32(v3Offset + 4, true);
      const v3z = view.getFloat32(v3Offset + 8, true);

      // Store positions
      const posIndex = i * 9;
      positions[posIndex] = v1x;
      positions[posIndex + 1] = v1y;
      positions[posIndex + 2] = v1z;
      positions[posIndex + 3] = v2x;
      positions[posIndex + 4] = v2y;
      positions[posIndex + 5] = v2z;
      positions[posIndex + 6] = v3x;
      positions[posIndex + 7] = v3y;
      positions[posIndex + 8] = v3z;

      // Store normals (same for all 3 vertices)
      normals[posIndex] = nx;
      normals[posIndex + 1] = ny;
      normals[posIndex + 2] = nz;
      normals[posIndex + 3] = nx;
      normals[posIndex + 4] = ny;
      normals[posIndex + 5] = nz;
      normals[posIndex + 6] = nx;
      normals[posIndex + 7] = ny;
      normals[posIndex + 8] = nz;

      offset += 50;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    return geometry;
  }

  /**
   * Parse ASCII STL
   * ASCII STL format:
   * solid name
   *   facet normal ni nj nk
   *     outer loop
   *       vertex v1x v1y v1z
   *       vertex v2x v2y v2z
   *       vertex v3x v3y v3z
   *     endloop
   *   endfacet
   * endsolid name
   */
  parseASCII(buffer) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split('\n');

    const positions = [];
    const normals = [];

    let currentNormal = null;

    for (let line of lines) {
      line = line.trim();

      if (line.startsWith('facet normal')) {
        const parts = line.split(/\s+/);
        currentNormal = [
          parseFloat(parts[2]),
          parseFloat(parts[3]),
          parseFloat(parts[4])
        ];
      } else if (line.startsWith('vertex')) {
        const parts = line.split(/\s+/);
        positions.push(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        );

        if (currentNormal) {
          normals.push(...currentNormal);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

    return geometry;
  }

  /**
   * Get model statistics
   */
  getStats() {
    if (!this.geometry) return null;

    const bbox = this.geometry.boundingBox;
    const positions = this.geometry.attributes.position;

    return {
      triangleCount: positions.count / 3,
      vertexCount: positions.count,
      dimensions: {
        x: bbox.max.x - bbox.min.x,
        y: bbox.max.y - bbox.min.y,
        z: bbox.max.z - bbox.min.z
      },
      center: {
        x: (bbox.max.x + bbox.min.x) / 2,
        y: (bbox.max.y + bbox.min.y) / 2,
        z: (bbox.max.z + bbox.min.z) / 2
      },
      min: { ...bbox.min },
      max: { ...bbox.max }
    };
  }
}
