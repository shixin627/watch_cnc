# STL CAM Tool

智能 STL 轉 G-code 加工路徑生成工具

## 功能特色

- **STL 檔案載入**: 支援 Binary 與 ASCII 格式
- **3D 視覺化**: 使用 Three.js 進行即時 3D 渲染
- **互動式區域選擇**: 用立方體框選想要加工的區域
- **自動路徑生成**: 自動辨識需切除部位並生成 3D 輪廓銑削路徑
- **路徑預覽**: 即時顯示生成的刀具路徑
- **G-code 匯出**: 輸出標準 G-code 格式

## 安裝

### 前置需求

- Node.js (v16 或更高版本)
- npm

### 安裝步驟

```bash
# 進入專案目錄
cd stl-cam-tool

# 安裝依賴
npm install

# 啟動開發模式
npm run dev
```

### 打包成執行檔

```bash
# 打包 Windows 執行檔
npm run build:win

# 打包後的檔案會在 dist/ 目錄中
```

## 使用方法

### 1. 載入 STL 檔案

點擊「載入 STL 檔案」按鈕,選擇您的 STL 模型檔案。

### 2. 選擇加工區域

1. 點擊「啟用選擇模式」
2. 在 3D 模型上拖曳滑鼠,定義一個立方體區域
3. 選擇完成後,點擊「停用選擇模式」

### 3. 設定加工參數

在右側面板調整:
- **刀具直徑**: 您使用的銑刀直徑 (mm)
- **步距比例**: 路徑間距佔刀具直徑的百分比 (建議 40%)
- **每層深度**: Z 軸每次下刀深度 (mm)
- **進給速度**: 切削速度 (mm/min)
- **安全高度**: 快速移動時的 Z 軸高度 (mm)

### 4. 生成刀具路徑

點擊「生成刀具路徑」,程式會:
- 自動掃描選定區域
- 檢測需要切除的部位
- 生成 3D 輪廓路徑
- 顯示紅色路徑預覽

### 5. 匯出 G-code

點擊「匯出 G-code」,選擇儲存位置即可獲得可用於 CNC 機器的 .nc 檔案。

## 操作提示

### 視角控制

- **左鍵拖曳**: 旋轉視角
- **右鍵拖曳**: 平移視角
- **滾輪**: 縮放視角
- **重置視角**: 點擊「重置視角」按鈕

### 選擇技巧

- 選擇模式下,在模型表面拖曳即可創建選擇框
- 綠色框線表示當前選擇區域
- 可以隨時「清除選擇」重新選擇

## 技術架構

- **前端框架**: Electron
- **3D 渲染**: Three.js
- **檔案處理**: Node.js File System
- **路徑生成**: 自訂 Raycasting 演算法

## 專案結構

```
stl-cam-tool/
├── src/
│   ├── main/           # Electron 主程序
│   │   └── main.js
│   └── renderer/       # 渲染程序
│       ├── index.html
│       ├── styles.css
│       ├── app.js
│       ├── stl-loader.js
│       ├── viewport.js
│       ├── selection-tool.js
│       ├── toolpath-generator.js
│       └── gcode-exporter.js
├── public/             # 靜態資源
├── package.json
└── README.md
```

## 開發說明

### 模組說明

- **stl-loader.js**: STL 檔案解析 (Binary/ASCII)
- **viewport.js**: Three.js 場景管理與渲染
- **selection-tool.js**: 互動式立方體選擇工具
- **toolpath-generator.js**: 刀具路徑生成引擎
- **gcode-exporter.js**: G-code 匯出模組
- **app.js**: 主應用程式協調器

### 擴展功能

可以在以下方向進行擴展:
- 支援更多加工策略 (粗加工、精加工)
- 加入碰撞檢測
- 支援多刀具切換
- 加入刀具庫管理
- 路徑優化演算法

## 授權

MIT License

## 作者

基於 generate_gcode_v2.py 的經驗開發
```
