# Wheel Counter Enclosure

Parametric OpenSCAD enclosure for the `wheel-counter/` hardware stack.

Files:

- [glider_counter_case.scad](glider_counter_case.scad)

## Design Intent

This enclosure is designed around a compact perfboard build:

- main body sits flat against the cage as much as possible
- the FC-51 sensor heads are exposed on the cage-facing back
- the perfboard remains the mechanical backbone
- the OLED is readable from the room-facing front
- the DHT22 gets dedicated venting
- the BH1750 gets a dedicated light aperture
- the ESP32-C3 SuperMini gets a side USB-C cutout
- mounting uses zip ties instead of fixed cage clips, so the same print can fit different bar spacing

## Recommended Layout

The model assumes this placement strategy:

- `FC-51` near the left side of the perfboard, bent 90 degrees so the IR pair points toward the cage-facing back wall
- `ESP32-C3 SuperMini` near the right side, with the USB-C port aligned to the right wall cutout
- `OLED` behind the front viewing window
- `DHT22` behind the vent field on the front lid
- `BH1750` behind the small light aperture on the front lid

If your wiring differs, keep the enclosure and just tune the opening coordinates in the parameter section.

## Export Targets

Set `part` in the SCAD file to:

- `"base"` for the rear tray
- `"lid"` for the front cover
- `"print"` for both parts side-by-side
- `"layout"` for an exploded layout preview
- `"assembly"` for the assembled view

Typical CLI exports:

```bash
openscad -o base.stl -D 'part="base"' enclosure/glider_counter_case.scad
openscad -o lid.stl -D 'part="lid"' enclosure/glider_counter_case.scad
openscad -o preview.stl -D 'part="assembly"' enclosure/glider_counter_case.scad
```

## Suggested Print Settings

- Layer height: `0.20 mm`
- Wall/perimeters: `3`
- Top/bottom layers: `5`
- Infill: `15-25%`
- Material: `PETG` preferred for cage use, `PLA` acceptable for indoor prototyping
- Print orientation:
  - base with the flat cage-facing back on the bed
  - lid with the room-facing front on the bed

## Hardware

- `4x` M3 self-tapping screws, about `10-12 mm` long, for the lid
- `2x` or `4x` zip ties for cage mounting

## Parameters You Are Most Likely To Tune

- `sensor_center_x`
- `sensor_center_y`
- `sensor_pitch`
- `sensor_hole_d`
- `usb_center_y`
- `usb_center_z`
- `oled_center`
- `bh1750_center`
- `dht_vent_rect`

## Why The Openings Are Designed This Way

- `FC-51`: short, direct rear openings because IR obstacle sensors are sensitive to angle and ambient IR. A tight opening helps keep the optical path controlled.
- `DHT22`: a vent field instead of a sealed pocket, because humidity sensors need airflow and benefit from a baffle-like opening instead of being boxed in.
- `BH1750`: a dedicated light aperture so the sensor is not shadowed by the enclosure body.
- `Zip-tie mounting`: more robust than fixed cage clips when the bar diameter and spacing are not yet locked down.

## Practical Fit Checks Before Printing Final Parts

Check these with calipers before your final print:

- actual USB-C port center on your ESP32-C3 SuperMini
- actual spacing between the two exposed FC-51 sensor heads after your 90-degree bend
- actual OLED board position relative to the viewing area
- whether your BH1750 board matches the assumed `18.5 x 13.9 mm` breakout size

## Preview Before Printing

Use `layout` mode to confirm the lid, base, and internal component positions before exporting STL files. After adjusting any hardware coordinates, preview both `assembly` and `print` modes to make sure the openings still line up with the board layout.
