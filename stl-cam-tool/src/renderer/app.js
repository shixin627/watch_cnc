/**
 * Main Application
 * Coordinates all modules and handles UI interactions
 */

const { ipcRenderer } = require('electron');

// Global instances
let viewport = null;
let stlLoader = null;
let selectionTool = null;
let toolpathGenerator = null;
let gcodeExporter = null;

// State
let currentModel = null;
let currentToolpath = null;
let toolpathPreview = null;

// Initialize application
window.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
});

function initializeApp() {
  // Initialize Three.js viewport
  const canvas = document.getElementById('three-canvas');
  viewport = new Viewport(canvas);

  // Initialize modules
  stlLoader = new STLLoader();
  selectionTool = new SelectionTool(viewport);
  toolpathGenerator = new ToolpathGenerator();
  gcodeExporter = new GCodeExporter();

  updateStatus('就緒 - 請載入 STL 檔案');
  console.log('Application initialized');
}

function setupEventListeners() {
  // Load STL button
  document.getElementById('load-stl-btn').addEventListener('click', loadSTLFile);

  // Selection mode toggle
  document.getElementById('toggle-selection-btn').addEventListener('click', toggleSelectionMode);

  // Reset view
  document.getElementById('reset-view-btn').addEventListener('click', () => {
    viewport.resetView();
  });

  // Clear selection
  document.getElementById('clear-selection-btn').addEventListener('click', () => {
    selectionTool.clear();
    updateSelectionInfo();
    updateButtonStates();
  });

  // Generate toolpath
  document.getElementById('generate-toolpath-btn').addEventListener('click', generateToolpath);

  // Export G-code
  document.getElementById('export-gcode-btn').addEventListener('click', exportGCode);

  // Parameter inputs
  const paramInputs = ['tool-diameter', 'stepover', 'stepdown', 'feed-rate', 'safe-z'];
  paramInputs.forEach(id => {
    document.getElementById(id).addEventListener('change', updateParameters);
  });
}

async function loadSTLFile() {
  try {
    updateStatus('選擇 STL 檔案...');

    const fileData = await ipcRenderer.invoke('open-stl-file');

    if (!fileData) {
      updateStatus('已取消');
      return;
    }

    updateStatus('載入中...');

    // Parse STL
    const geometry = stlLoader.load(fileData.data);
    const stats = stlLoader.getStats();

    // Display model
    viewport.loadModel(geometry);
    currentModel = geometry;

    // Update UI
    document.getElementById('file-name').textContent = fileData.name;
    document.getElementById('triangle-count').textContent = stats.triangleCount.toLocaleString();
    document.getElementById('model-dimensions').textContent =
      `${stats.dimensions.x.toFixed(1)} × ${stats.dimensions.y.toFixed(1)} × ${stats.dimensions.z.toFixed(1)} mm`;

    // Hide overlay
    document.getElementById('viewport-info').style.display = 'none';

    updateStatus(`已載入: ${fileData.name}`);
    updateButtonStates();

    console.log('Model loaded:', stats);
  } catch (error) {
    console.error('Error loading STL:', error);
    updateStatus('載入失敗: ' + error.message);
  }
}

function toggleSelectionMode() {
  if (selectionTool.enabled) {
    selectionTool.disable();
    document.getElementById('selection-mode-text').textContent = '啟用選擇模式';
    updateStatus('選擇模式已關閉');
  } else {
    selectionTool.enable();
    document.getElementById('selection-mode-text').textContent = '停用選擇模式';
    updateStatus('選擇模式: 在模型上拖曳以定義加工區域');
  }
}

function updateSelectionInfo() {
  const bounds = selectionTool.getBounds();
  const volume = selectionTool.getVolume();

  if (volume > 0) {
    const size = {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z
    };

    document.getElementById('selection-status').textContent = '已選擇';
    document.getElementById('selection-bounds').textContent =
      `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;
    document.getElementById('estimated-volume').textContent =
      `${volume.toFixed(2)} mm³`;
  } else {
    document.getElementById('selection-status').textContent = '未選擇';
    document.getElementById('selection-bounds').textContent = '-';
    document.getElementById('estimated-volume').textContent = '-';
  }
}

function updateParameters() {
  const params = {
    toolDiameter: parseFloat(document.getElementById('tool-diameter').value),
    stepover: parseFloat(document.getElementById('stepover').value) / 100,
    stepdown: parseFloat(document.getElementById('stepdown').value),
    feedRate: parseFloat(document.getElementById('feed-rate').value),
    safeZ: parseFloat(document.getElementById('safe-z').value)
  };

  toolpathGenerator.setParams(params);
  gcodeExporter.setParams(params);

  console.log('Parameters updated:', params);
}

async function generateToolpath() {
  try {
    if (!currentModel || selectionTool.getVolume() <= 0) {
      updateStatus('請先載入模型並選擇加工區域');
      return;
    }

    // Update parameters
    updateParameters();

    // Show progress
    document.getElementById('generation-progress').style.display = 'block';
    document.getElementById('generate-toolpath-btn').disabled = true;
    updateStatus('正在生成刀具路徑...');

    // Get selection bounds
    const bounds = selectionTool.getBounds();

    // Generate toolpath
    currentToolpath = await toolpathGenerator.generate(
      viewport.modelMesh,
      bounds,
      (progress) => {
        const percent = Math.round(progress * 100);
        document.getElementById('progress-fill').style.width = `${percent}%`;
        updateStatus(`生成中... ${percent}%`);
      }
    );

    // Hide progress
    document.getElementById('generation-progress').style.display = 'none';

    // Update info
    const totalPoints = toolpathGenerator.getTotalPoints();
    const estimatedTime = toolpathGenerator.estimateTime();

    document.getElementById('toolpath-points').textContent = totalPoints.toLocaleString();
    document.getElementById('estimated-time').textContent =
      `${Math.round(estimatedTime)} 分鐘 (${(estimatedTime / 60).toFixed(1)} 小時)`;

    // Display toolpath preview
    displayToolpathPreview(currentToolpath);

    updateStatus(`路徑生成完成: ${totalPoints.toLocaleString()} 點`);
    updateButtonStates();

    console.log('Toolpath generated:', currentToolpath);
  } catch (error) {
    console.error('Error generating toolpath:', error);
    updateStatus('生成失敗: ' + error.message);
    document.getElementById('generation-progress').style.display = 'none';
  } finally {
    document.getElementById('generate-toolpath-btn').disabled = false;
  }
}

function displayToolpathPreview(toolpath) {
  // Remove existing preview
  if (toolpathPreview) {
    viewport.scene.remove(toolpathPreview);
    toolpathPreview.geometry.dispose();
    toolpathPreview.material.dispose();
  }

  // Create line geometry for toolpath
  const points = [];

  for (let layer of toolpath) {
    for (let point of layer.points) {
      points.push(point);
    }
  }

  if (points.length === 0) return;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xff0000,
    linewidth: 2
  });

  toolpathPreview = new THREE.Line(geometry, material);
  viewport.scene.add(toolpathPreview);
}

async function exportGCode() {
  try {
    if (!currentToolpath || currentToolpath.length === 0) {
      updateStatus('請先生成刀具路徑');
      return;
    }

    updateStatus('正在匯出 G-code...');

    // Generate G-code
    const gcode = gcodeExporter.export(currentToolpath);

    // Save file
    const fileName = document.getElementById('file-name').textContent.replace('.stl', '') + '_output.nc';
    const success = await ipcRenderer.invoke('save-gcode', gcode, fileName);

    if (success) {
      updateStatus('G-code 匯出成功');
    } else {
      updateStatus('匯出已取消');
    }

    console.log('G-code exported, size:', gcode.length, 'bytes');
  } catch (error) {
    console.error('Error exporting G-code:', error);
    updateStatus('匯出失敗: ' + error.message);
  }
}

function updateButtonStates() {
  const hasModel = currentModel !== null;
  const hasSelection = selectionTool.getVolume() > 0;
  const hasToolpath = currentToolpath !== null && currentToolpath.length > 0;

  document.getElementById('toggle-selection-btn').disabled = !hasModel;
  document.getElementById('clear-selection-btn').disabled = !hasSelection;
  document.getElementById('generate-toolpath-btn').disabled = !hasModel || !hasSelection;
  document.getElementById('export-gcode-btn').disabled = !hasToolpath;
}

function updateStatus(message) {
  document.getElementById('status-text').textContent = message;
  console.log('Status:', message);
}

// Listen for selection updates (called from selection-tool.js if needed)
setInterval(() => {
  if (selectionTool && selectionTool.enabled) {
    updateSelectionInfo();
    updateButtonStates();
  }
}, 500);
