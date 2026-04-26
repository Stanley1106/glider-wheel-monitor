# Sugar Glider Dashboard

Static dashboard for viewing sugar glider wheel activity and environment data.

The page reads CSV data from a Google Sheet, computes activity metrics in the browser, and renders charts with ApexCharts.

## Files

- [index.html](index.html) - page structure and script load order
- [css/style.css](css/style.css) - dashboard layout and responsive styling
- [js/config.js](js/config.js) - sheet ID, wheel geometry, refresh interval, and thresholds
- [js/data.js](js/data.js) - CSV fetch, parsing, daily/hourly aggregation, and activity classification
- [js/charts.js](js/charts.js) - ApexCharts setup and chart updates
- [js/app.js](js/app.js) - dashboard polling and DOM updates

## Run Locally

There is no build step. Open [index.html](index.html) directly in a browser, or serve this folder with any static HTTP server.

Example:

```bash
cd glider-dashboard
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Configuration

Edit [js/config.js](js/config.js) when the data source or wheel assumptions change.

Important settings:

- `SHEET_ID` - Google Sheet used as the CSV source
- `WHEEL_CIRCUMFERENCE_M` - wheel circumference used for distance and speed
- `UPLOAD_INTERVAL_S` - expected firmware upload cadence
- `REFRESH_INTERVAL_MS` - browser polling interval
- `SPEED_THRESHOLDS` - labels for walking, active, running, and sprinting states

## Expected Sheet Columns

The dashboard reads the Google Sheet CSV export and looks for these columns:

- `timestamp` or `ts`
- `laps_delta`, `lap_delta`, `total_laps`, or `laps_total`
- `temperature` or `temp`
- `humidity`
- `lux`

The current firmware sends interval lap counts as `laps_delta`. The dashboard treats this as laps since the previous upload, then derives RPM, speed, hourly totals, and daily totals in the browser.

All day grouping is calculated for UTC+8 / Asia-Taipei.

## Deployment

Push to `main` to deploy the dashboard through GitHub Pages. The workflow uploads this folder as the Pages artifact, then deploys it with `actions/deploy-pages`.

Official reference:

- [GitHub Pages deploy action](https://github.com/actions/deploy-pages)
