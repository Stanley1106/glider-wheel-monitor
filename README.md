# Glider Dashboard

Monorepo for a sugar glider wheel activity tracker.

The system has four parts:

- [dashboard/](dashboard/) - static web dashboard deployed to GitHub Pages
- [firmware/](firmware/) - ESP32-C3 firmware that counts wheel laps and uploads readings
- [apps-script/](apps-script/) - Google Apps Script that receives uploads and maintains the Google Sheet
- [enclosure/](enclosure/) - OpenSCAD enclosure model for the hardware stack

## Data Flow

```text
ESP32-C3 firmware -> Google Apps Script -> Google Sheet -> static dashboard
```

The firmware uploads interval readings to a Google Apps Script endpoint. The dashboard reads the Google Sheet CSV export, computes activity metrics in the browser, and renders charts.

## Project Folders

### Dashboard

See [dashboard/README.md](dashboard/README.md).

The dashboard is plain HTML/CSS/JavaScript. There is no build step; open [dashboard/index.html](dashboard/index.html) directly or serve the folder with a static file server.

### Firmware

See [firmware/README.md](firmware/README.md).

The firmware is a PlatformIO project for ESP32-C3 using the Arduino framework. Local Wi-Fi credentials and endpoint settings belong in `firmware/src/config.h`, copied from `config.example.h`.

### Apps Script

[apps-script/Code.gs](apps-script/Code.gs) is the Google Apps Script web app deployed as a `doGet` endpoint. On each ESP32 upload it:

1. Appends a raw row to the `live` sheet and prunes rows older than 2 days.
2. Upserts the current hour's aggregate row in `hr_summary` (kept 31 days).
3. Upserts the current day's aggregate row in `daily_summary` (kept forever).

The dashboard reads all three sheets in parallel and routes each time range to the appropriate sheet: `today` uses raw live rows, `7d`/`30d` use hourly aggregates, `all` uses daily aggregates.

All three sheets are created automatically on the first upload — no manual setup required.

### Enclosure

See [enclosure/README.md](enclosure/README.md).

The enclosure is a parametric OpenSCAD model with separate render targets for the base, lid, print layout, and assembly preview.

## Deployment

Pushing dashboard changes to `main` runs [.github/workflows/deploy-dashboard.yml](.github/workflows/deploy-dashboard.yml). The workflow uploads `dashboard/` as a GitHub Pages artifact and deploys it with GitHub Actions.

## Notes

- `firmware/src/config.h` is gitignored because it contains local Wi-Fi and endpoint settings.
- The dashboard groups days using UTC+8 / Asia-Taipei.
- The dashboard currently treats `laps_delta` as interval laps and derives RPM, speed, hourly totals, and daily totals from that value.
