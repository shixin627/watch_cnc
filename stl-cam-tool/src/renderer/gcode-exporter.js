/**
 * G-code Exporter Module
 * Converts toolpath to G-code format
 */

class GCodeExporter {
  constructor() {
    this.params = {
      feedRate: 100,
      safeZ: 5.0,
      toolDiameter: 1.0
    };
  }

  /**
   * Set parameters
   */
  setParams(params) {
    this.params = { ...this.params, ...params };
  }

  /**
   * Export toolpath to G-code
   * @param {Array} toolpath - Toolpath data from generator
   * @param {Object} options - Export options
   * @returns {string} G-code string
   */
  export(toolpath, options = {}) {
    const lines = [];

    // Header
    lines.push('%');
    lines.push('; ============================================================');
    lines.push('; STL CAM Tool - Auto-generated G-code');
    lines.push('; ============================================================');
    lines.push(`;`);
    lines.push(`; Generated: ${new Date().toISOString()}`);
    lines.push(`; Tool Diameter: ${this.params.toolDiameter} mm`);
    lines.push(`; Feed Rate: ${this.params.feedRate} mm/min`);
    lines.push(`; Safe Z: ${this.params.safeZ} mm`);
    lines.push(`; Total Layers: ${toolpath.length}`);
    lines.push(`; Total Points: ${this.countTotalPoints(toolpath)}`);
    lines.push('; ============================================================');
    lines.push('');

    // Initialization
    lines.push('; ========== INITIALIZATION ==========');
    lines.push('G90                 ; Absolute coordinates');
    lines.push('G21                 ; Metric units (mm)');
    lines.push('G40 G49 G80         ; Cancel offsets and cycles');
    lines.push('G94                 ; Feed per minute mode');
    lines.push('');
    lines.push(`F${this.params.feedRate}       ; Set feed rate`);
    lines.push('');

    // Move to safe position
    lines.push(`G0 Z${this.params.safeZ.toFixed(3)}    ; Retract to safe height`);
    lines.push('G0 X0.000 Y0.000   ; Move to origin');
    lines.push('');

    // Main machining loop
    lines.push('; ========== MACHINING OPERATIONS ==========');
    lines.push('');

    for (let i = 0; i < toolpath.length; i++) {
      const layer = toolpath[i];

      lines.push(`; ====== Layer ${layer.layer + 1}/${toolpath.length} - Z=${layer.z.toFixed(3)} ======`);
      lines.push(`; Points in layer: ${layer.points.length}`);
      lines.push('');

      if (layer.points.length === 0) {
        lines.push('; (No points in this layer)');
        lines.push('');
        continue;
      }

      // Move to first point (rapid)
      const firstPoint = layer.points[0];
      lines.push(`; Move to start position`);
      lines.push(`G0 Z${this.params.safeZ.toFixed(3)}    ; Safe height`);
      lines.push(`G0 X${firstPoint.x.toFixed(3)} Y${firstPoint.y.toFixed(3)}`);
      lines.push(`G1 Z${firstPoint.z.toFixed(3)}   ; Lower to cutting depth`);
      lines.push('');

      // Cutting moves
      lines.push(`; Start cutting`);
      for (let j = 1; j < layer.points.length; j++) {
        const point = layer.points[j];
        lines.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} Z${point.z.toFixed(3)}`);

        // Add periodic comments for readability
        if (j % 50 === 0) {
          lines.push(`; Progress: ${j}/${layer.points.length} points`);
        }
      }

      lines.push('');

      // Retract after layer
      lines.push(`G0 Z${this.params.safeZ.toFixed(3)}    ; Retract`);
      lines.push('');
    }

    // Finish
    lines.push('; ========== PROGRAM END ==========');
    lines.push(`G0 Z${this.params.safeZ.toFixed(3)}    ; Final retract`);
    lines.push('G0 X0.000 Y0.000   ; Return to origin');
    lines.push('M5                  ; Stop spindle (if applicable)');
    lines.push('M30                 ; Program end and rewind');
    lines.push('%');

    return lines.join('\n');
  }

  /**
   * Count total points in toolpath
   */
  countTotalPoints(toolpath) {
    return toolpath.reduce((sum, layer) => sum + layer.points.length, 0);
  }

  /**
   * Estimate file size
   */
  estimateSize(toolpath) {
    const totalPoints = this.countTotalPoints(toolpath);
    const avgBytesPerLine = 40; // Approximate
    const headerFooterBytes = 1000;

    return totalPoints * avgBytesPerLine + headerFooterBytes;
  }
}
