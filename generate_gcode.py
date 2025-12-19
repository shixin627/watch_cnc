#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2.5D Arc Surface Scanning G-code Generator
生成完整的 Mach3 弧面掃描 G-code

使用方法:
    python generate_gcode.py > output.nc
"""

import math

# ========== 可調參數 ==========
XC = 0.0            # 弧面頂點 X 座標
ZC = -10.0          # 圓心 Z 座標
R0 = 10.0           # 初始外層半徑

Y0 = 0.0            # 掃描起始 Y
Y1 = 0.4            # 掃描結束 Y

DEPTH_PER_LAYER = 0.1   # 每層深度
TOTAL_LAYERS = 10       # 總層數
DX = 0.2                # X 步距 (弧面離散精度)

FEED_RATE = 20          # 進給速率 (mm/min)
SAFE_Z = 5.0            # 安全高度

# ========== 輔助函數 ==========

def calc_arc_z(x, r, xc=XC, zc=ZC, z_layer=None):
    """
    Calculate Z value on arc surface at X position
    Returns min(Z_arc, Z_layer) to ensure not cutting deeper than current layer
    """
    dx = x - xc
    under_sqrt = r * r - dx * dx
    if under_sqrt < 0:
        under_sqrt = 0
    z_arc = zc - math.sqrt(under_sqrt)

    if z_layer is not None:
        return min(z_arc, z_layer)
    return z_arc

def generate_arc_path(x_start, x_end, y, z_layer, r, direction=1):
    """
    Generate arc surface path
    direction: 1 for forward (x_start -> x_end), -1 for reverse
    """
    if direction > 0:
        x_current = x_start
        x_target = x_end
        step = DX
    else:
        x_current = x_end
        x_target = x_start
        step = -DX

    lines = []
    while (direction > 0 and x_current <= x_target) or \
          (direction < 0 and x_current >= x_target):
        z = calc_arc_z(x_current, r, z_layer=z_layer)
        lines.append(f"G1 X{x_current:.3f} Y{y:.3f} Z{z:.3f}")
        x_current += step

    return lines

def generate_layer(layer_num, zigzag=False):
    """生成單層掃描路徑"""
    z_layer = -DEPTH_PER_LAYER * layer_num
    r_layer = R0 - DEPTH_PER_LAYER * layer_num

    # 計算 X 範圍
    dz = ZC - z_layer
    under_sqrt = r_layer * r_layer - dz * dz
    if under_sqrt < 0:
        under_sqrt = 0
    x_range = math.sqrt(under_sqrt)
    x_start = XC - x_range
    x_end = XC + x_range

    lines = []
    lines.append(f"; ====== 第 {layer_num} 層: Z = {z_layer:.1f} ======")
    lines.append(f"; R = {r_layer:.1f}, X = [{x_start:.2f}, {x_end:.2f}]")
    lines.append("")

    # 判斷掃描方向 (奇偶層優化)
    is_odd = (layer_num % 2 == 1)

    if is_odd or not zigzag:
        # 奇數層 或 不使用鋸齒優化: 左→中→右
        # 1) Xc → X_start @ Y0
        lines.extend(generate_arc_path(XC, x_start, Y0, z_layer, r_layer, -1))
        lines.append("")

        # 2) Y0 → Y1
        lines.append(f"G1 Y{Y1:.3f}")
        lines.append("")

        # 3) X_start → Xc @ Y1
        lines.extend(generate_arc_path(x_start, XC, Y1, z_layer, r_layer, 1))
        lines.append("")

        # 4) Xc → X_end @ Y1
        lines.extend(generate_arc_path(XC, x_end, Y1, z_layer, r_layer, 1))
        lines.append("")

        # 5) Y1 → Y0
        lines.append(f"G1 Y{Y0:.3f}")
        lines.append("")

        # 6) X_end → Xc @ Y0
        lines.extend(generate_arc_path(x_end, XC, Y0, z_layer, r_layer, -1))
        lines.append("")

    else:
        # 偶數層 鋸齒優化: 右→中→左
        # 1) Xc → X_end @ Y0
        lines.extend(generate_arc_path(XC, x_end, Y0, z_layer, r_layer, 1))
        lines.append("")

        # 2) Y0 → Y1
        lines.append(f"G1 Y{Y1:.3f}")
        lines.append("")

        # 3) X_end → Xc @ Y1
        lines.extend(generate_arc_path(x_end, XC, Y1, z_layer, r_layer, -1))
        lines.append("")

        # 4) Xc → X_start @ Y1
        lines.extend(generate_arc_path(XC, x_start, Y1, z_layer, r_layer, -1))
        lines.append("")

        # 5) Y1 → Y0
        lines.append(f"G1 Y{Y0:.3f}")
        lines.append("")

        # 6) X_start → Xc @ Y0
        lines.extend(generate_arc_path(x_start, XC, Y0, z_layer, r_layer, 1))
        lines.append("")

    return "\n".join(lines)

def generate_gcode(zigzag=True):
    """生成完整 G-code"""

    output = []

    # 檔頭
    output.append("%")
    output.append("; " + "=" * 60)
    output.append("; 2.5D 弧面等厚掃描加工程式")
    output.append("; Arc Surface Constant-Thickness Scanning")
    output.append("; ")
    output.append(f"; 自動生成: Python Generator")
    output.append(f"; 參數: R0={R0}, 層數={TOTAL_LAYERS}, 步距={DX}mm")
    output.append("; " + "=" * 60)
    output.append("")

    # 初始化
    output.append("; ========== 初始化 ==========")
    output.append("G90                 ; 絕對座標")
    output.append("G21                 ; 公制單位")
    output.append("G40 G49 G80         ; 取消補償與循環")
    output.append("")
    output.append(f"F{FEED_RATE}            ; 進給速率")
    output.append("")
    output.append(f"G0 Z{SAFE_Z:.1f}         ; 退到安全高度")
    output.append(f"G0 X{XC:.1f} Y{Y0:.1f}    ; 移動到起點")
    output.append("")
    output.append("")

    # 各層掃描
    output.append("; ========== 主加工循環 ==========")
    output.append("")

    for k in range(1, TOTAL_LAYERS + 1):
        output.append(generate_layer(k, zigzag))
        output.append("")

    # 結束
    output.append("; ========== 加工完成 ==========")
    output.append(f"G0 Z{SAFE_Z:.1f}         ; 退刀")
    output.append(f"G0 X0.0 Y0.0        ; 回原點")
    output.append("M30                 ; 程式結束")
    output.append("%")

    return "\n".join(output)

# ========== 主程式 ==========
if __name__ == "__main__":
    import sys

    # 檢查命令列參數
    use_zigzag = True
    if len(sys.argv) > 1 and sys.argv[1] == "--no-zigzag":
        use_zigzag = False

    print(generate_gcode(zigzag=use_zigzag))
