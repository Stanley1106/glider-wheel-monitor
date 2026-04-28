(function () {
  function buildColumnIndex(headers) {
    const normalized = headers.map(h => h.trim().toLowerCase());
    return {
      ts: normalized.indexOf('timestamp'),
      laps: normalized.indexOf('laps_delta'),
      temperature: normalized.indexOf('temperature'),
      humidity: normalized.indexOf('humidity'),
      lux: normalized.indexOf('lux'),
    };
  }

  function unquote(s) {
    return s.trim().replace(/^"|"$/g, '');
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(unquote);
    const inferredIndex = buildColumnIndex(headers);
    const index = {
      ts: inferredIndex.ts !== -1 ? inferredIndex.ts : 0,
      laps: inferredIndex.laps !== -1 ? inferredIndex.laps : 1,
      temperature: inferredIndex.temperature !== -1 ? inferredIndex.temperature : 2,
      humidity: inferredIndex.humidity !== -1 ? inferredIndex.humidity : 3,
      lux: inferredIndex.lux !== -1 ? inferredIndex.lux : 4,
    };

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(unquote);
      if (cols.length < 2) continue;

      const ts = new Date((cols[index.ts] || '').trim());
      const lapsDelta = parseInt((cols[index.laps] || '').trim(), 10);
      if (Number.isNaN(ts.getTime()) || Number.isNaN(lapsDelta)) continue;

      const rawTemp = parseFloat((cols[index.temperature] || '').trim());
      const rawHumidity = parseFloat((cols[index.humidity] || '').trim());
      const rawLux = parseFloat((cols[index.lux] || '').trim());

      rows.push({
        ts,
        lapsDelta: Math.max(0, lapsDelta),
        temperature: !Number.isNaN(rawTemp) && rawTemp >= 0 && rawTemp <= 50 ? rawTemp : null,
        humidity: !Number.isNaN(rawHumidity) && rawHumidity > 0 && rawHumidity <= 100 ? rawHumidity : null,
        lux: !Number.isNaN(rawLux) && rawLux >= 0 && rawLux <= 65535 ? rawLux : null,
      });
    }

    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }

  function sheetUrl(sheetId, sheetName) {
    return 'https://docs.google.com/spreadsheets/d/' + sheetId +
      '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(sheetName) +
      '&t=' + Date.now();
  }

  async function fetchSheet(sheetId, sheetName) {
    const res = await fetch(sheetUrl(sheetId, sheetName));
    if (!res.ok) throw new Error('HTTP ' + res.status + ' (' + sheetName + ')');
    return res.text();
  }

  function todayDateStr() {
    return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function rowDateStr(ts) {
    return new Date(ts.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function computeRates(rows) {
    for (let i = 0; i < rows.length; i++) {
      if (i === 0) {
        rows[i].rpm = 0;
        rows[i].speedKmh = 0;
        continue;
      }

      const prev = rows[i - 1];
      const curr = rows[i];
      const elapsedMin = (curr.ts - prev.ts) / 60000;
      const elapsedHr = elapsedMin / 60;
      const distanceKm = curr.lapsDelta * CONFIG.WHEEL_CIRCUMFERENCE_M / 1000;

      curr.rpm = elapsedMin > 0 ? curr.lapsDelta / elapsedMin : 0;
      curr.speedKmh = elapsedHr > 0 ? distanceKm / elapsedHr : 0;
    }
  }

  function smoothSeries(rows, windowSize) {
    const w = Math.max(1, windowSize);
    for (let i = 0; i < rows.length; i++) {
      const start = Math.max(0, i - w + 1);
      const slice = rows.slice(start, i + 1);
      rows[i].rpmSmooth = slice.reduce((sum, row) => sum + row.rpm, 0) / slice.length;
      rows[i].speedKmhSmooth = slice.reduce((sum, row) => sum + row.speedKmh, 0) / slice.length;
    }
  }

  function buildHourly(rows) {
    const today = todayDateStr();
    const buckets = new Array(24).fill(0);

    rows.forEach(row => {
      if (rowDateStr(row.ts) !== today) return;
      const hour = new Date(row.ts.getTime() + 8 * 3600 * 1000).getUTCHours();
      buckets[hour] += row.lapsDelta || 0;
    });

    return buckets;
  }

  function buildDaily(rows) {
    const map = {};

    rows.forEach(row => {
      const date = rowDateStr(row.ts);
      map[date] = (map[date] || 0) + (row.lapsDelta || 0);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, laps]) => ({ date, laps }));
  }

  function buildAnnualHeatmap(rows) {
    if (!rows.length) return { byDate: {}, years: [], maxLaps: 1 };

    const byDate = {};
    rows.forEach(row => {
      const date = rowDateStr(row.ts);
      byDate[date] = (byDate[date] || 0) + (row.lapsDelta || 0);
    });

    const years = Object.entries(byDate)
      .filter(([, laps]) => laps > 0)
      .map(([date]) => Number(date.slice(0, 4)))
      .filter(Number.isFinite)
      .filter((year, index, all) => all.indexOf(year) === index)
      .sort((a, b) => a - b);

    const maxLaps = Math.max(1, ...Object.values(byDate));
    return { byDate, years, maxLaps };
  }

  function classifyActivity(speedKmh) {
    if (!speedKmh || speedKmh < CONFIG.SPEED_THRESHOLDS.active) {
      return { level: 'sleeping', label: 'sleeping' };
    }
    if (speedKmh < CONFIG.SPEED_THRESHOLDS.sprinting) {
      return { level: 'active', label: 'active' };
    }
    return { level: 'sprinting', label: 'sprinting' };
  }

  function computeStats(rows) {
    const today = todayDateStr();
    const todayRows = rows.filter(row => rowDateStr(row.ts) === today);
    const todayLaps = todayRows.reduce((sum, row) => sum + (row.lapsDelta || 0), 0);
    const todayDistanceM = todayLaps * CONFIG.WHEEL_CIRCUMFERENCE_M;
    const last = rows[rows.length - 1] || {};
    const currentRPM = last.rpm || 0;
    const currentSpeedKmh = last.speedKmhSmooth || last.speedKmh || 0;

    return {
      todayLaps,
      todayDistanceM,
      currentRPM,
      currentSpeedKmh,
      activity: classifyActivity(currentSpeedKmh),
      latestTemp: last.temperature ?? null,
      latestHumidity: last.humidity ?? null,
      latestLux: last.lux ?? null,
    };
  }

  async function fetchData() {
    const id = CONFIG.SHEET_ID;

    const [liveResult, hrResult, summaryResult] = await Promise.allSettled([
      fetchSheet(id, 'live'),
      fetchSheet(id, 'hr_summary'),
      fetchSheet(id, 'daily_summary'),
    ]);

    if (liveResult.status === 'rejected') throw liveResult.reason;

    const liveRows = parseCsv(liveResult.value);
    const hrRows = hrResult.status === 'fulfilled' ? parseCsv(hrResult.value) : [];
    const summaryRows = summaryResult.status === 'fulfilled' ? parseCsv(summaryResult.value) : [];

    computeRates(liveRows);
    smoothSeries(liveRows, CONFIG.SMOOTHING_WINDOW);
    computeRates(hrRows);
    computeRates(summaryRows);

    const stats = computeStats(liveRows);
    const hourly = buildHourly(liveRows);

    // daily bar chart: prefer daily_summary, fall back to hr_summary, then live
    const dailySrc = summaryRows.length > 0 ? summaryRows : hrRows.length > 0 ? hrRows : liveRows;
    const daily = buildDaily(dailySrc).slice(-7);

    // heatmap: same priority
    const annual = buildAnnualHeatmap(summaryRows.length > 0 ? summaryRows : hrRows.length > 0 ? hrRows : liveRows);

    return { liveRows, hrRows, summaryRows, stats, hourly, daily, annual };
  }

  window.fetchData = fetchData;
  window.classifyActivity = classifyActivity;
  window.buildAnnualHeatmap = buildAnnualHeatmap;
  window.rowDateStr = rowDateStr;
  window.todayDateStr = todayDateStr;
})();
