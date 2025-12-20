# 2.5D 弧面等厚掃描加工程式 v2

## 專案說明

本專案提供 **180° 倒置弧面（凸起向上）** 的 2.5D 連續掃描加工 G-code 解決方案，適用於 CNC 加工系統。

### v2 版本重大更新

**核心幾何修正**:
- 修正弧面方程式為 180° 倒置（凸起向上）配置
- Arc equation: `Z = Zc + √(R² - (X-Xc)²)` （從 `-` 改為 `+`）
- 使用 `max(Z_arc, Z_layer)` 替代 `min()` 以符合倒置幾何
- 新增 `X_RANGE` 參數限制加工範圍

### 加工策略核心

- **加工對象**: 180° 倒置弧面薄壁（凸起向上，位於 XZ 平面）
- **弧面配置**: 弧心在 Z=0，弧面向上凸起
- **加工範圍**: 從弧頂（apex）向兩側延伸，可自訂範圍
- **分層策略**: 預設 10 層 × 0.1 mm/層
- **路徑特性**: 連續掃描、不抬刀、沿弧面等厚剝離
- **掃描方向**: Y 軸（0.0 → 0.4 mm）

---

## 檔案清單

| 檔案名稱 | 說明 | 適用情境 |
|---------|------|---------|
| `generate_gcode_v2.py` | **Python 生成器 v2** | ⭐ 最新版本 - 正確的倒置弧面幾何 |
| `generate_gcode.py` | Python 生成器 v1 | ⚠️ 舊版 - 使用 v2 替代 |
| `standard.nc` | 預生成的標準 G-code | 📄 範例輸出檔案 |
| `ver0.nc` | 原始版本 | ❌ 不建議使用 |
| `README.md` | 本說明文件 | 📖 |

---

## 快速開始

### 使用 Python 生成器 v2（推薦）

**安裝需求**: Python 3.x

**基本用法**:

```bash
# 生成 G-code 並輸出到檔案
python generate_gcode_v2.py > output.nc

# 或直接顯示在終端機
python generate_gcode_v2.py
```

**修改參數**（編輯 [generate_gcode_v2.py](generate_gcode_v2.py) 第 11-25 行）:

```python
# ========== ADJUSTABLE PARAMETERS ==========
XC = 0.0            # 弧頂 X 座標（中心點）
ZC = 0.0            # 弧心 Z 座標
R0 = 22.0           # 初始外層半徑

Y0 = 0.0            # 掃描起始 Y
Y1 = 0.4            # 掃描結束 Y

DEPTH_PER_LAYER = 0.1   # 每層深度增量
TOTAL_LAYERS = 10       # 總層數
DX = 0.2                # X 步距（弧面離散化精度）

X_RANGE = 12.5          # 從弧頂向兩側的加工範圍（±X_RANGE）

FEED_RATE = 20          # 進給速率 (mm/min)
SAFE_Z = 0.0            # 安全退刀高度
```

---

## 加工路徑邏輯

### 單層掃描順序

每層執行以下閉合路徑（從弧頂中心開始）:

```
1) 中心 (XC, Y0) → 右側 (X_end, Y0)    [沿弧面向右下]
2) 右側 (X_end, Y0) → (X_end, Y1)      [Y軸前進]
3) 右側 (X_end, Y1) → 中心 (XC, Y1)    [沿弧面回中心]
4) 中心 (XC, Y1) → 左側 (X_start, Y1)  [沿弧面向左下]
5) 左側 (X_start, Y1) → (X_start, Y0)  [Y軸後退]
6) 左側 (X_start, Y0) → 中心 (XC, Y0)  [沿弧面回中心]
```

**路徑特點**:
- 每層都從弧頂中心（XC, Y0）開始和結束
- 完整掃描左右兩側對稱區域
- 確保路徑連續性，層與層之間無需抬刀

---

## 幾何模型（v2 修正版）

### 180° 倒置弧面方程

```
Z_arc(X) = Zc + √(R² - (X - Xc)²)
```

**說明**:
- 弧心位於 (Xc, Zc)
- 弧面向上凸起（180° 倒置配置）
- 弧頂（apex）位於 X=Xc, Z=Zc+R

### 實際加工 Z 值

```python
Z_actual = max(Z_arc, Z_layer)
```

**關鍵修正**: 使用 `max()` 而非 `min()`，確保刀具不會切得比當前層更深。

### 第 k 層參數

```
Z_layer = -DEPTH_PER_LAYER × k
R_layer = R0 - DEPTH_PER_LAYER × k
```

**示例**（R0=22, DEPTH_PER_LAYER=0.1）:
- 第 1 層: Z_layer = -0.1, R_layer = 21.9
- 第 10 層: Z_layer = -1.0, R_layer = 21.0

### X 加工範圍計算

```python
dz = Z_layer - Zc
max_x_range = √(R² - dz²)
actual_x_range = min(max_x_range, X_RANGE)

X_start = Xc - actual_x_range
X_end = Xc + actual_x_range
```

**新功能**: `X_RANGE` 參數限制加工範圍，避免過度延伸。

---

## v1 → v2 主要變更

### 幾何修正

| 項目 | v1 (錯誤) | v2 (正確) |
|-----|----------|----------|
| 弧面方程 | `Z = Zc - √(...)` | `Z = Zc + √(...)` |
| Z值限制 | `min(Z_arc, Z_layer)` | `max(Z_arc, Z_layer)` |
| 弧面方向 | 凹面向下 | 凸面向上（倒置 180°） |

### 新增功能

1. **X_RANGE 參數**: 可自訂從弧頂向兩側的加工範圍
2. **更清晰的註解**: 明確標示 "INVERTED 180°"
3. **改進的路徑說明**: 詳細的步驟註解

### 程式碼改進

```python
# v1 (錯誤)
z_arc = zc - math.sqrt(discriminant)
return min(z_arc, z_layer)

# v2 (正確)
z_arc = zc + math.sqrt(discriminant)  # Changed from - to +
return max(z_arc, z_layer)  # Changed from min to max
```

---

## 使用範例

### 範例 1: 標準錶面加工

```python
XC = 0.0
ZC = 0.0
R0 = 22.0           # 錶面外半徑 22mm
X_RANGE = 12.5      # 加工範圍 ±12.5mm
DEPTH_PER_LAYER = 0.1
TOTAL_LAYERS = 10   # 總深度 1.0mm
```

### 範例 2: 高精度加工

```python
DX = 0.1            # 更小的步距
DEPTH_PER_LAYER = 0.05
TOTAL_LAYERS = 20   # 相同總深度，更多層
FEED_RATE = 15      # 較慢的進給速率
```

### 範例 3: 快速粗加工

```python
DX = 0.5            # 較大步距
DEPTH_PER_LAYER = 0.2
TOTAL_LAYERS = 5
FEED_RATE = 50      # 較快的進給速率
```

---

## 調整建議

### 提高精度

```python
DX = 0.1  # 更小的步距 → 更平滑的弧面
```

⚠️ 副作用: G-code 行數倍增，檔案更大

### 加快速度

```python
FEED_RATE = 50  # 提高進給速率（根據材料調整）
```

⚠️ 注意: 需考慮材料硬度、刀具強度

### 改變深度策略

```python
TOTAL_LAYERS = 20       # 更多層
DEPTH_PER_LAYER = 0.05  # 更淺的下刀
```

**優點**: 更好的表面光潔度，減少刀具負荷

### 調整加工範圍

```python
X_RANGE = 15.0  # 擴大加工範圍
```

⚠️ 確保不超過弧面幾何限制: `X_RANGE ≤ R_layer`

---

## 技術規格

### 輸出格式

- **G-code 標準**: ISO 6983 (RS274)
- **座標系統**: G90 絕對座標
- **單位**: G21 公制 (mm)
- **進給模式**: G1 線性插補

### 程式碼大小估算

以預設參數（DX=0.2, 10層, X_RANGE=12.5）:
- **總行數**: ~1500-2000 行
- **檔案大小**: ~80-100 KB

### 相容性

- ✅ Mach3
- ✅ LinuxCNC
- ✅ GRBL (需確認記憶體)
- ✅ 標準 ISO G-code 控制器

---

## 使用注意事項

### ⚠️ 安全檢查

1. **機台限制確認**
   - X/Y/Z 軸行程範圍
   - 主軸轉速設定（程式未包含，需手動啟動）
   - 確認 SAFE_Z 高度安全

2. **空跑測試**
   ```
   - 使用 CNC 模擬功能
   - Z 軸抬高 50mm 空跑
   - 確認路徑正確
   - 檢查是否有碰撞風險
   ```

3. **材料夾持**
   - 確保工件固定牢靠
   - Y 軸方向僅 0.4mm（預設），需精確定位
   - 考慮使用夾具或真空吸盤

4. **刀具選擇**
   - 建議使用球刀或小直徑平刀
   - 刀具直徑需小於 DX×2 以避免過切
   - 考慮刀具補償（程式未包含）

### 🔧 常見問題

**Q: 弧面方向不對？**
```python
# 如果需要凹面向下（非倒置），修改:
# calc_arc_z() 函數中
z_arc = zc - math.sqrt(discriminant)  # 改回 -
return min(z_arc, z_layer)  # 改回 min
```

**Q: 加工範圍太大或太小？**
```python
X_RANGE = 15.0  # 調整此值（單位: mm）
```

**Q: 第一層沒有切削？**
- 檢查 Z_layer 計算: 應該是負值
- 確認工件 Z=0 對刀位置
- 驗證 SAFE_Z 設定

**Q: 路徑不連續？**
- 檢查 Y0 和 Y1 設定
- 確認 X_RANGE 不超過弧面範圍
- 驗證每層的 X_start 和 X_end 計算

---

## 驗證方法

### 數學驗證

**第 1 層檢查**（預設參數）:
```
Z_layer = -0.1
R_layer = 21.9
dz = -0.1 - 0.0 = -0.1
max_x_range = √(21.9² - 0.01) ≈ 21.9 mm
actual_x_range = min(21.9, 12.5) = 12.5 mm
X_start = 0.0 - 12.5 = -12.5
X_end = 0.0 + 12.5 = 12.5
```

**第 10 層檢查**:
```
Z_layer = -1.0
R_layer = 21.0
dz = -1.0
max_x_range = √(21.0² - 1.0) ≈ 20.976 mm
actual_x_range = min(20.976, 12.5) = 12.5 mm
```

### 路徑連續性檢查

每層應該:
1. 開始於 (XC, Y0, Z_apex)
2. 結束於 (XC, Y0, Z_apex)
3. 下一層從相同 XY 位置但更深的 Z 開始

### 模擬工具

- **CAMotics** (開源, 推薦)
  ```bash
  camotics output.nc
  ```

- **NCViewer** (線上工具)
  - https://ncviewer.com
  - 上傳 .nc 檔案即可視覺化

- **Mach3 內建模擬器**
  - 載入 G-code → 工具路徑視圖

---

## 進階應用

### 刀具補償

程式未包含刀具半徑補償，需手動調整:

```python
# 方法 1: 調整半徑
R0 = 22.0 + TOOL_RADIUS  # 外補償
R0 = 22.0 - TOOL_RADIUS  # 內補償

# 方法 2: 使用 G41/G42（需修改輸出）
# 在 generate_gcode() 中加入:
output.append("G41 D01  ; Cutter compensation left")
```

### 多段掃描

如需掃描更大的 Y 範圍:

```python
# 分段生成
segments = [
    (0.0, 0.4),
    (0.4, 0.8),
    (0.8, 1.2)
]

for Y0, Y1 in segments:
    # 修改參數並重新生成
```

### 變速加工

根據切削深度調整進給:

```python
# 在 generate_layer() 中:
feed_rate = FEED_RATE * (1.0 - 0.3 * layer_num / TOTAL_LAYERS)
lines.append(f"F{feed_rate:.1f}")
```

---

## 故障排除

### 生成錯誤

**錯誤**: `discriminant < 0`
- **原因**: R_layer 小於 |Z_layer - ZC|
- **解決**: 減少 TOTAL_LAYERS 或 DEPTH_PER_LAYER

**錯誤**: 空白輸出
- **檢查**: X_RANGE 是否設定正確
- **檢查**: R0 是否大於 0

### 加工問題

**問題**: 表面不平滑
- **解決**: 減小 DX（如 0.1 或 0.05）
- **解決**: 增加層數，減少每層深度

**問題**: 加工時間過長
- **解決**: 增加 DX（如 0.3 或 0.5）
- **解決**: 提高 FEED_RATE
- **解決**: 減少 X_RANGE

**問題**: 刀具振動
- **解決**: 降低 FEED_RATE
- **解決**: 減少 DEPTH_PER_LAYER
- **解決**: 使用更剛性的刀具

---

## 授權與責任

- 本程式為開源專案，僅供參考
- 使用前請充分測試與驗證
- 實際加工參數需依材料、刀具、機台調整
- 作者不對加工結果或任何損失負責
- 使用者需自行承擔使用風險

---

## 版本歷史

### v2.0 (2025-12-20)
- ✅ 修正弧面幾何為 180° 倒置（凸起向上）
- ✅ 新增 X_RANGE 參數限制加工範圍
- ✅ 改進註解與文件說明
- ✅ 修正 Z 值計算邏輯（max 替代 min）

### v1.0 (2025-12-19)
- 初始版本（幾何有誤）
- 基本弧面掃描功能

---

## 技術支援

若有問題，請提供：
1. 使用的檔案版本（v1 或 v2）
2. Python 版本（`python --version`）
3. 修改的參數設定
4. 錯誤訊息或異常輸出
5. 預期與實際結果差異

**建議**: 先進行模擬驗證，再實際加工

---

**最後更新**: 2025-12-20
**版本**: 2.0
**生成器**: [generate_gcode_v2.py](generate_gcode_v2.py)
