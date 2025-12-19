#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2.5D Arc Surface Scanning G-code Generator v2
Corrected arc geometry calculations
"""

import math

# ========== ADJUSTABLE PARAMETERS ==========
XC = 0.0            # Arc apex X coordinate
ZC = 0.0            # Arc center Z coordinate
R0 = 22.0           # Initial outer radius

Y0 = 0.0            # Scan start Y
Y1 = 0.4            # Scan end Y

DEPTH_PER_LAYER = 0.1   # Depth increment per layer
TOTAL_LAYERS = 10       # Total number of layers
DX = 0.2                # X step size (arc discretization precision)

X_RANGE = 12.5           # Machining range from apex (±X_RANGE from XC)

FEED_RATE = 20          # Feed rate (mm/min)
SAFE_Z = 0.0            # Safe retract height

# ========== HELPER FUNCTIONS ==========

def calc_arc_z(x, r, z_layer, xc=XC, zc=ZC):
    """
    Calculate Z value on arc surface at position X
    Arc equation (INVERTED 180°): Z = Zc + sqrt(R^2 - (X-Xc)^2)
    Returns: max(Z_arc, Z_layer) to not cut deeper than current layer
    """
    dx = x - xc
    discriminant = r * r - dx * dx

    if discriminant < 0:
        # Point outside arc boundary, use layer depth
        return z_layer

    z_arc = zc + math.sqrt(discriminant)  # Changed from - to +
    return max(z_arc, z_layer)  # Changed from min to max

def calc_x_range(r, z_layer, xc=XC, zc=ZC):
    """
    Calculate valid X range for current layer (INVERTED 180°)
    Limited to ±X_RANGE from apex center
    """
    dz = z_layer - zc
    discriminant = r * r - dz * dz

    if discriminant < 0:
        # No valid X range at this depth
        return xc, xc

    # Calculate maximum possible range based on arc geometry
    max_x_range = math.sqrt(discriminant)

    # Limit to user-specified X_RANGE
    actual_x_range = min(max_x_range, X_RANGE)

    return xc - actual_x_range, xc + actual_x_range

def generate_arc_path(x_start, x_end, y, z_layer, r, direction=1):
    """
    Generate linear approximation of arc path
    direction: 1 = forward, -1 = reverse
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
    iterations = 0
    max_iterations = 1000  # Safety limit

    while iterations < max_iterations:
        # Check termination condition
        if direction > 0 and x_current > x_target:
            break
        if direction < 0 and x_current < x_target:
            break

        z = calc_arc_z(x_current, r, z_layer)
        lines.append(f"G1 X{x_current:.3f} Y{y:.3f} Z{z:.3f}")

        x_current += step
        iterations += 1

    return lines

def generate_layer(layer_num, zigzag=False):
    """Generate single layer scanning path"""
    z_layer = -DEPTH_PER_LAYER * layer_num
    r_layer = R0 - DEPTH_PER_LAYER * layer_num

    if r_layer <= 0:
        return f"; Layer {layer_num}: SKIPPED (R={r_layer:.2f} <= 0)"

    # Calculate X range
    x_start, x_end = calc_x_range(r_layer, z_layer)

    lines = []
    lines.append(f"; ====== Layer {layer_num}: Z = {z_layer:.1f} ======")
    lines.append(f"; R = {r_layer:.1f}, X = [{x_start:.2f}, {x_end:.2f}]")
    lines.append("")

    # Determine scan direction (odd/even optimization)
    is_odd = (layer_num % 2 == 1)

    if is_odd or not zigzag:
        # Odd layer OR no zigzag: Left -> Center -> Right
        # 1) Xc -> X_start @ Y0
        lines.extend(generate_arc_path(XC, x_start, Y0, z_layer, r_layer, -1))
        lines.append("")

        # 2) Y0 -> Y1
        lines.append(f"G1 Y{Y1:.3f}")
        lines.append("")

        # 3) X_start -> Xc @ Y1
        lines.extend(generate_arc_path(x_start, XC, Y1, z_layer, r_layer, 1))
        lines.append("")

        # 4) Xc -> X_end @ Y1
        lines.extend(generate_arc_path(XC, x_end, Y1, z_layer, r_layer, 1))
        lines.append("")

        # 5) Y1 -> Y0
        lines.append(f"G1 Y{Y0:.3f}")
        lines.append("")

        # 6) X_end -> Xc @ Y0
        lines.extend(generate_arc_path(x_end, XC, Y0, z_layer, r_layer, -1))
        lines.append("")

    else:
        # Even layer zigzag: Right -> Center -> Left
        # 1) Xc -> X_end @ Y0
        lines.extend(generate_arc_path(XC, x_end, Y0, z_layer, r_layer, 1))
        lines.append("")

        # 2) Y0 -> Y1
        lines.append(f"G1 Y{Y1:.3f}")
        lines.append("")

        # 3) X_end -> Xc @ Y1
        lines.extend(generate_arc_path(x_end, XC, Y1, z_layer, r_layer, -1))
        lines.append("")

        # 4) Xc -> X_start @ Y1
        lines.extend(generate_arc_path(XC, x_start, Y1, z_layer, r_layer, -1))
        lines.append("")

        # 5) Y1 -> Y0
        lines.append(f"G1 Y{Y0:.3f}")
        lines.append("")

        # 6) X_start -> Xc @ Y0
        lines.extend(generate_arc_path(x_start, XC, Y0, z_layer, r_layer, 1))
        lines.append("")

    return "\n".join(lines)

def generate_gcode(zigzag=True):
    """Generate complete G-code program"""

    output = []

    # Header
    output.append("%")
    output.append("; " + "=" * 60)
    output.append("; 2.5D Arc Surface Constant-Thickness Scanning (INVERTED 180°)")
    output.append("; ")
    output.append(f"; Auto-generated by Python Generator v2")
    output.append(f"; Parameters: R0={R0}mm, Layers={TOTAL_LAYERS}, DX={DX}mm")
    output.append(f"; Arc center: (X={XC}, Z={ZC})")
    output.append(f"; Machining range: X = {XC - X_RANGE:.2f} to {XC + X_RANGE:.2f} (±{X_RANGE}mm from apex)")
    output.append("; Arc orientation: Convex upward (180° inverted)")
    output.append("; " + "=" * 60)
    output.append("")

    # Initialization
    output.append("; ========== INITIALIZATION ==========")
    output.append("G90                 ; Absolute coordinates")
    output.append("G21                 ; Metric units")
    output.append("G40 G49 G80         ; Cancel offsets and cycles")
    output.append("")
    output.append(f"F{FEED_RATE}            ; Set feed rate")
    output.append("")
    output.append(f"G0 Z{SAFE_Z:.1f}         ; Retract to safe height")
    output.append(f"G0 X{XC:.1f} Y{Y0:.1f}    ; Move to start position")
    output.append("")
    output.append("")

    # Layer scanning
    output.append("; ========== MAIN MACHINING LOOP ==========")
    output.append("")

    for k in range(1, TOTAL_LAYERS + 1):
        output.append(generate_layer(k, zigzag))
        output.append("")

    # Finish
    output.append("; ========== MACHINING COMPLETE ==========")
    output.append(f"G0 Z{SAFE_Z:.1f}         ; Retract tool")
    output.append(f"G0 X0.0 Y0.0        ; Return to origin")
    output.append("M30                 ; Program end")
    output.append("%")

    return "\n".join(output)

# ========== MAIN ==========
if __name__ == "__main__":
    import sys

    use_zigzag = True
    if len(sys.argv) > 1 and sys.argv[1] == "--no-zigzag":
        use_zigzag = False

    print(generate_gcode(zigzag=use_zigzag))
