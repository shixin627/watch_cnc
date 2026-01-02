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
Y1 = 0.0            # Scan end Y

DEPTH_PER_LAYER = 0.1   # Depth increment per layer
TOTAL_LAYERS = 15       # Total number of layers
DX = 0.2                # X step size (arc discretization precision)

TOOL_RADIUS = 0.5
TARGET_X_RANGE = 15.0           # Machining range from apex (±X_RANGE from XC)
X_RANGE = TARGET_X_RANGE - TOOL_RADIUS           # Machining range from apex (±X_RANGE from XC)

FEED_RATE = 20          # Feed rate (mm/min)
SAFE_Z = 0.0            # Safe retract height

# ========== HELPER FUNCTIONS ==========

def calc_arc_z(x, r, z_layer, xc=XC, zc=ZC):
    """
    Calculate Z value on arc surface at position X
    Arc equation (INVERTED 180°): Z = Zc + sqrt(R^2 - (X-Xc)^2) - R0
    Returns: max(Z_arc, Z_layer) to not cut deeper than current layer
    All Z values are offset by -R0 to lower the entire toolpath
    """
    dx = x - xc
    discriminant = r * r - dx * dx

    if discriminant < 0:
        # Point outside arc boundary, use layer depth
        return z_layer - R0

    z_arc = zc + math.sqrt(discriminant) - R0  # Subtract R0 to lower the path
    return max(z_arc, z_layer - R0)  # Changed from min to max, with R0 offset

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

def generate_arc_path(x_start, x_end, y, z_layer, r):
    """
    Generate arc path from x_start to x_end at constant Y
    """
    lines = []

    # Calculate number of X steps
    x_distance = abs(x_end - x_start)
    num_steps = max(1, int(x_distance / DX))

    if num_steps == 0:
        return lines

    x_step = (x_end - x_start) / num_steps

    for i in range(num_steps + 1):
        x_current = x_start + i * x_step
        z = calc_arc_z(x_current, r, z_layer)
        lines.append(f"G1 X{x_current:.3f} Y{y:.3f} Z{z:.3f}")

    return lines

def generate_layer(layer_num, y_position=Y0):
    """Generate single layer scanning path with zigzag pattern
    Layer 1: Move to right along surface, cut down, then cut left (ends at left)
    Layer 2: Cut down at left, then cut right (ends at right)
    Layer 3: Cut down at right, then cut left (ends at left)
    And so on...
    """
    z_layer = -DEPTH_PER_LAYER * layer_num
    r_layer = R0 - DEPTH_PER_LAYER * layer_num

    if r_layer <= 0:
        return f"; Layer {layer_num}: SKIPPED (R={r_layer:.2f} <= 0)", None

    # Calculate X range
    x_start, x_end = calc_x_range(r_layer, z_layer)

    lines = []
    lines.append(f"; ====== Layer {layer_num}: Z = {z_layer:.1f} ======")
    lines.append(f"; R = {r_layer:.1f}, X = [{x_start:.2f}, {x_end:.2f}]")

    # Determine direction based on layer number
    if layer_num % 2 == 1:  # Odd layers: Right to Left
        lines.append(f"; Path: Right -> Left (zigzag)")
        lines.append("")

        if layer_num == 1:
            # First layer: start from center, move to right edge along surface
            lines.append("; Move from center to right edge along arc surface (no cutting)")
            lines.extend(generate_arc_path(XC, x_end, y_position, z_layer, R0))
            lines.append("")

        # Cut down at right edge
        lines.append(f"; Cut down to layer depth at right edge")
        z_right = calc_arc_z(x_end, r_layer, z_layer)
        lines.append(f"G1 Z{z_right:.3f}")
        lines.append("")

        # Cut from right to left along arc
        lines.append("; Cut along arc from right to left")
        lines.extend(generate_arc_path(x_end, x_start, y_position, z_layer, r_layer))
        lines.append("")

        end_position = x_start  # End at left

    else:  # Even layers: Left to Right
        lines.append(f"; Path: Left -> Right (zigzag)")
        lines.append("")

        # Cut down at left edge
        lines.append(f"; Cut down to layer depth at left edge")
        z_left = calc_arc_z(x_start, r_layer, z_layer)
        lines.append(f"G1 Z{z_left:.3f}")
        lines.append("")

        # Cut from left to right along arc
        lines.append("; Cut along arc from left to right")
        lines.extend(generate_arc_path(x_start, x_end, y_position, z_layer, r_layer))
        lines.append("")

        end_position = x_end  # End at right

    return "\n".join(lines), end_position

def generate_gcode():
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

    # Calculate arc apex (highest point on inverted arc)
    # Origin stays at Z = ZC
    z_apex_origin = ZC

    output.append(f"G0 Z{SAFE_Z:.1f}         ; Retract to safe height")
    output.append(f"G0 X{XC:.1f} Y{Y0:.1f}    ; Move to apex X,Y position")
    output.append(f"G0 Z{z_apex_origin:.3f}        ; Lower to origin (Z = ZC + R0)")
    output.append("")
    output.append("; NOTE: All subsequent machining paths have Z offset by -R0")
    output.append("")

    # Layer scanning
    output.append("; ========== MAIN MACHINING LOOP ==========")
    output.append("")

    for k in range(1, TOTAL_LAYERS + 1):
        layer_gcode, _ = generate_layer(k)
        output.append(layer_gcode)
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
    print(generate_gcode())
