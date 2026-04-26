/*
  Sugar glider wheel counter enclosure
  ------------------------------------
  Parametric two-part enclosure for:
  - 70 x 30 mm perfboard
  - ESP32-C3 SuperMini
  - FC-51 IR sensor module (sensor heads exposed on cage-facing side)
  - JMD0.96D-1 OLED
  - DHT22
  - BH1750 GY-302 / GY-320 sized board

  Coordinate system:
  - X: case length
  - Y: case width
  - Z: cage-facing back -> room-facing front

  Render targets:
  - part = "assembly"
  - part = "base"
  - part = "lid"
  - part = "print"
  - part = "layout"
*/

part = "assembly"; // ["assembly", "base", "lid", "print", "layout"]

$fn = 48;
eps = 0.01;

// ---- Core print / fit parameters -----------------------------------------
wall = 2.2;
back_wall = 2.4;
lid_plate = 2.2;
lid_overlap = 4.5;
lip_clearance = 0.25;
lip_ring = 1.6;
corner_r = 4.0;

// ---- Overall enclosure ----------------------------------------------------
// The shell is wider than the perfboard so the lid screws sit outside the
// electronics area.
case_outer = [96, 56, 24];
base_depth = case_outer[2] - lid_plate;
base_inner = [case_outer[0] - 2 * wall, case_outer[1] - 2 * wall, base_depth - back_wall];

// ---- Electronics ----------------------------------------------------------
perfboard = [70, 30, 1.6];
perfboard_pos = [
  (case_outer[0] - perfboard[0]) / 2,
  (case_outer[1] - perfboard[1]) / 2,
  back_wall + 8.0  // clearance for the FC-51 body under the board
];

esp32 = [22.5, 18.0, 6.5];
dht22 = [12, 28, 10]; // rotated footprint for the recommended layout
bh1750 = [18.5, 13.9, 4.5];
oled_board = [24.74, 16.9, 3.42];
oled_view = [21.74, 10.86];
fc51_module = [31, 14, 7]; // module envelope used by the assembly preview

// ---- Recommended internal layout anchors ---------------------------------
// Move these anchors if the sensors are wired to different board positions.
oled_center = [perfboard_pos[0] + 42, perfboard_pos[1] + 11];
bh1750_center = [perfboard_pos[0] + 60, perfboard_pos[1] + 25];
dht_vent_rect = [perfboard_pos[0] + 2, perfboard_pos[1] + 5, 12, 18]; // x, y, width, height on lid

usb_cutout = [10.8, 7.2];
usb_center_y = perfboard_pos[1] + 12.0;
usb_center_z = perfboard_pos[2] + perfboard[2] + 3.8;

sensor_center_x = perfboard_pos[0] + 8.0;
sensor_center_y = case_outer[1] / 2;
sensor_hole_d = 5.4;
sensor_pitch = 6.2;

// ---- Base retention / screws ---------------------------------------------
boss_d = 7.0;
boss_pilot_d = 2.7;   // M3 self-tapping / conservative pilot
lid_clear_d = 3.4;    // M3 clearance
boss_offset = 9.0;    // keeps screw bosses clear of the lid lip

vent_slot_len = 12;
vent_slot_w = 2.0;

// ---- Rear zip-tie slots ---------------------------------------------------
zip_tie_slot_len = 16;
zip_tie_slot_w = 4.2;
zip_tie_x_positions = [14, case_outer[0] - 14 - zip_tie_slot_len];
zip_tie_y_positions = [6.5, case_outer[1] - 6.5 - zip_tie_slot_w];

// ---- Perfboard mounting ---------------------------------------------------
// The board rests on four round pads with locating pegs for common perfboard
// corner holes. Tune the edge offset if your board has a different drill grid.
perf_mount_edge_offset = [
  2.0,
  2.0
];
perf_mount_pedestal_d = 8.0;
perf_mount_peg_d = 2.0;
perf_mount_peg_h = 5.5;
perf_mount_peg_fillet_r = 0.8;

// ---- Helper geometry ------------------------------------------------------
module rounded_rect_2d(size = [10, 10], r = 2) {
  offset(r = r)
    offset(delta = -r)
      square(size, center = false);
}

module rounded_box(size = [10, 10, 10], r = 2) {
  linear_extrude(height = size[2])
    rounded_rect_2d([size[0], size[1]], r);
}

module slot_2d(length = 10, width = 4) {
  hull() {
    translate([width / 2, width / 2]) circle(d = width);
    translate([length - width / 2, width / 2]) circle(d = width);
  }
}

module slot_cut(length = 10, width = 4, height = 5) {
  linear_extrude(height = height)
    slot_2d(length, width);
}

module vent_field(origin = [0, 0], size = [18, 20], slot_w = 1.8, pitch = 3.3, depth = 6) {
  slot_count = floor(size[1] / pitch);
  for (i = [0 : slot_count - 1]) {
    translate([origin[0], origin[1] + i * pitch, 0])
      slot_cut(size[0], slot_w, depth);
  }
}

module screw_boss(h) {
  difference() {
    cylinder(h = h, d = boss_d);
    translate([0, 0, -eps]) cylinder(h = h + 2 * eps, d = boss_pilot_d);
  }
}

module perf_mount_boss(h) {
  r  = perf_mount_peg_d / 2;
  fr = perf_mount_peg_fillet_r;
  cylinder(h = h, d = perf_mount_peg_d);
  // Rounded peg base to reduce stress at the pedestal transition.
  rotate_extrude($fn = $fn)
    difference() {
      translate([r, 0]) square([fr, fr]);
      translate([r + fr, fr]) circle(r = fr);
    }
}

module perfboard_supports() {
  pedestal_h = perfboard_pos[2] - back_wall + eps;

  // Four round riser pads, each with a 2 mm locating peg on top.
  for (mx = [perf_mount_edge_offset[0], perfboard[0] - perf_mount_edge_offset[0]]) {
    for (my = [perf_mount_edge_offset[1], perfboard[1] - perf_mount_edge_offset[1]]) {
      translate([perfboard_pos[0] + mx, perfboard_pos[1] + my, back_wall - eps])
        cylinder(h = pedestal_h, d = perf_mount_pedestal_d);
      translate([perfboard_pos[0] + mx, perfboard_pos[1] + my, perfboard_pos[2] - eps])
        perf_mount_boss(perf_mount_peg_h + eps);
    }
  }
}

module base_body() {
  difference() {
    union() {
      difference() {
        union() {
          rounded_box([case_outer[0], case_outer[1], base_depth], corner_r);
        }

        // Hollow interior
        translate([wall, wall, back_wall])
          rounded_box([base_inner[0], base_inner[1], base_inner[2] + eps], max(corner_r - wall, 1));
      }

      // Lid screw bosses
      for (p = [
        [boss_offset, boss_offset],
        [case_outer[0] - boss_offset, boss_offset],
        [boss_offset, case_outer[1] - boss_offset],
        [case_outer[0] - boss_offset, case_outer[1] - boss_offset]
      ]) {
        translate([p[0], p[1], back_wall - eps]) screw_boss(base_depth - back_wall - 0.8 + eps);
      }

      perfboard_supports();
    }

    // Zip-tie slots on the cage-facing back
    for (sx = zip_tie_x_positions) {
      for (sy = zip_tie_y_positions) {
        translate([sx, sy, -eps])
          slot_cut(zip_tie_slot_len, zip_tie_slot_w, back_wall + 2 * eps);
      }
    }

    // FC-51 emitter/receiver openings
    for (dy = [-sensor_pitch / 2, sensor_pitch / 2]) {
      translate([sensor_center_x, sensor_center_y + dy, -eps])
        cylinder(h = back_wall + 2 * eps, d = sensor_hole_d);
    }

    // Access slot for the FC-51 trim pot area
    translate([sensor_center_x + 9.5, sensor_center_y - 7.5, -eps])
      cube([8, 9, back_wall + 2 * eps]);

    // USB-C access on the right wall
    translate([case_outer[0] - wall - eps, usb_center_y - usb_cutout[0] / 2, usb_center_z - usb_cutout[1] / 2])
      cube([wall + 2 * eps, usb_cutout[0], usb_cutout[1]]);

    // Passive side vents
    for (z = [8.0, 11.5, 15.0]) {
      translate([-eps, 10, z])
        rotate([0, 90, 0])
          slot_cut(vent_slot_len, vent_slot_w, wall + 2 * eps);
    }
  }
}

module lid_body() {
  lid_total = lid_overlap + lid_plate;
  lip_outer = [base_inner[0] - 2 * lip_clearance, base_inner[1] - 2 * lip_clearance];
  lip_inner = [lip_outer[0] - 2 * lip_ring, lip_outer[1] - 2 * lip_ring];

  difference() {
    union() {
      translate([0, 0, lid_overlap - eps])
        rounded_box([case_outer[0], case_outer[1], lid_plate + eps], corner_r);

      translate([wall + lip_clearance, wall + lip_clearance, 0])
        difference() {
          rounded_box([lip_outer[0], lip_outer[1], lid_overlap], max(corner_r - wall - lip_clearance, 1));
          translate([lip_ring, lip_ring, -eps])
            rounded_box([lip_inner[0], lip_inner[1], lid_overlap + 2 * eps], max(corner_r - wall - lip_clearance - lip_ring, 0.8));
        }
    }

    // OLED viewing window
    translate([
      oled_center[0] - (oled_view[0] + 2.2) / 2,
      oled_center[1] - (oled_view[1] + 2.0) / 2,
      -eps
    ])
      rounded_box([oled_view[0] + 2.2, oled_view[1] + 2.0, lid_total + 2 * eps], 1.5);

    // DHT22 ventilation slots through the lid
    translate([dht_vent_rect[0], dht_vent_rect[1], -eps])
      vent_field([0, 0], [dht_vent_rect[2], dht_vent_rect[3]], 1.8, 3.4, lid_total + 2 * eps);

    // BH1750 ambient-light aperture
    translate([bh1750_center[0] - 3.2, bh1750_center[1] - 3.2, -eps])
      rounded_box([6.4, 6.4, lid_total + 2 * eps], 1.2);

    // Lid screw clearance holes
    for (p = [
      [boss_offset, boss_offset],
      [case_outer[0] - boss_offset, boss_offset],
      [boss_offset, case_outer[1] - boss_offset],
      [case_outer[0] - boss_offset, case_outer[1] - boss_offset]
    ]) {
      translate([p[0], p[1], -eps]) cylinder(h = lid_total + 2 * eps, d = lid_clear_d);
    }
  }
}

module component_preview() {
  // Translucent component blocks make assembly alignment easier to inspect.
  color([0.70, 0.45, 0.18, 0.65])
    translate(perfboard_pos)
      cube(perfboard);

  color([0.07, 0.13, 0.14, 0.70])
    translate([
      oled_center[0] - oled_board[0] / 2,
      oled_center[1] - oled_board[1] / 2,
      base_depth - oled_board[2]
    ])
      cube(oled_board);

  color([0.95, 0.95, 0.98, 0.65])
    translate([
      dht_vent_rect[0] + 2,
      dht_vent_rect[1] + 2,
      perfboard_pos[2] + perfboard[2]
    ])
      cube(dht22);

  color([0.05, 0.35, 0.48, 0.70])
    translate([
      bh1750_center[0] - bh1750[0] / 2,
      bh1750_center[1] - bh1750[1] / 2,
      base_depth - bh1750[2]
    ])
      cube(bh1750);

  color([0.10, 0.45, 0.18, 0.65])
    translate([
      perfboard_pos[0] + 42,
      perfboard_pos[1] + 6,
      perfboard_pos[2] + perfboard[2]
    ])
      cube(esp32);

  color([0.10, 0.20, 0.50, 0.55])
    translate([
      sensor_center_x - fc51_module[0] / 2,
      sensor_center_y - fc51_module[1] / 2,
      back_wall
    ])
      cube(fc51_module);
}

module base() {
  base_body();
}

module lid() {
  lid_body();
}

module assembly() {
  base();
  translate([0, 0, base_depth - lid_overlap]) lid();
  component_preview();
}

module print_layout() {
  translate([0, 0, 0]) base();
  translate([case_outer[0] + 10, 0, 0]) lid();
}

module layout_view() {
  explode = 14;
  color([0.20, 0.23, 0.26, 1.0]) base();
  color([0.32, 0.35, 0.38, 0.85])
    translate([0, 0, base_depth - lid_overlap + explode]) lid();
  component_preview();
}

if (part == "base") {
  base();
} else if (part == "lid") {
  lid();
} else if (part == "print") {
  print_layout();
} else if (part == "layout") {
  layout_view();
} else {
  assembly();
}
