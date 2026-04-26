# Glider Dashboard

Monorepo for a sugar glider wheel activity tracker.

The system has three parts:

- [glider-dashboard/](glider-dashboard/) - static web dashboard deployed to GitHub Pages
- [wheel-counter/](wheel-counter/) - ESP32-C3 firmware that counts wheel laps and uploads readings
- [enclosure/](enclosure/) - OpenSCAD enclosure model for the hardware stack

## Data Flow

```text
ESP32-C3 firmware -> Google Apps Script -> Google Sheet -> static dashboard
```

The firmware uploads interval readings to a Google Apps Script endpoint. The dashboard reads the Google Sheet CSV export, computes activity metrics in the browser, and renders charts.

## Project Folders

### Dashboard

See [glider-dashboard/README.md](glider-dashboard/README.md).

The dashboard is plain HTML/CSS/JavaScript. There is no build step; open [glider-dashboard/index.html](glider-dashboard/index.html) directly or serve the folder with a static file server.

### Firmware

See [wheel-counter/README.md](wheel-counter/README.md).

The firmware is a PlatformIO project for ESP32-C3 using the Arduino framework. Local Wi-Fi credentials and endpoint settings belong in `wheel-counter/src/config.h`, copied from `config.example.h`.

### Enclosure

See [enclosure/README.md](enclosure/README.md).

The enclosure is a parametric OpenSCAD model with separate render targets for the base, lid, print layout, and assembly preview.

## Deployment

Pushing dashboard changes to `main` runs [.github/workflows/deploy-dashboard.yml](.github/workflows/deploy-dashboard.yml). The workflow uploads `glider-dashboard/` as a GitHub Pages artifact and deploys it with GitHub Actions.

## Notes

- `wheel-counter/src/config.h` is gitignored because it contains local Wi-Fi and endpoint settings.
- The dashboard groups days using UTC+8 / Asia-Taipei.
- The dashboard currently treats `laps_delta` as interval laps and derives RPM, speed, hourly totals, and daily totals from that value.
