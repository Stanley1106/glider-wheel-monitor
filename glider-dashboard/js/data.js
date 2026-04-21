(function () {
  function buildColumnIndex(headers) {
    const normalized = headers.map(header => header.trim().toLowerCase());
    const findColumn = (...names) => normalized.findIndex(header => names.includes(header));

    return {
      ts: findColumn('timestamp', 'ts'),
      laps: findColumn('laps_delta', 'lap_delta', 'total_laps', 'laps_total'),
      temperature: findColumn('temperature', 'temp'),
      humidity: findColumn('humidity'),
      lux: findColumn('lux'),
    };
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
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
      const cols = lines[i].split(',');
      if (cols.length < 5) continue;
      const ts = new Date((cols[index.ts] ?? '').trim());
      const lapsDelta = parseInt((cols[index.laps] ?? '').trim(), 10);
      if (isNaN(ts.getTime()) || isNaN(lapsDelta)) continue;

      const rawTemp = parseFloat((cols[index.temperature] ?? '').trim());
      const rawHumidity = parseFloat((cols[index.humidity] ?? '').trim());
      const rawLux = parseFloat((cols[index.lux] ?? '').trim());

      const temperature = !isNaN(rawTemp) && rawTemp >= 0 && rawTemp <= 50 ? rawTemp : null;
      const humidity = !isNaN(rawHumidity) && rawHumidity > 0 && rawHumidity <= 100 ? rawHumidity : null;
      const lux = !isNaN(rawLux) && rawLux >= 0 && rawLux <= 65535 ? rawLux : null;

      rows.push({ ts, lapsDelta: Math.max(0, lapsDelta), temperature, humidity, lux });
    }
    return rows;
  }

  function todayDateStr() {
    return new Date(Date.now() + 8 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  function rowDateStr(ts) {
    return new Date(ts.getTime() + 8 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
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
      curr.rpm = elapsedMin > 0 ? curr.lapsDelta / elapsedMin : 0;
      const distanceKm = curr.lapsDelta * CONFIG.WHEEL_CIRCUMFERENCE_M / 1000;
      const elapsedHr = elapsedMin / 60;
      curr.speedKmh = elapsedHr > 0 ? distanceKm / elapsedHr : 0;
    }
  }

  function smoothSeries(rows, windowSize) {
    const w = Math.max(1, windowSize);
    for (let i = 0; i < rows.length; i++) {
      const start = Math.max(0, i - w + 1);
      const slice = rows.slice(start, i + 1);
      rows[i].rpmSmooth = slice.reduce((s, r) => s + r.rpm, 0) / slice.length;
      rows[i].speedKmhSmooth = slice.reduce((s, r) => s + r.speedKmh, 0) / slice.length;
    }
  }

  function buildHourly(rows) {
    const today = todayDateStr();
    const todayRows = rows.filter(r => rowDateStr(r.ts) === today);
    const buckets = new Array(24).fill(0);
    for (const r of todayRows) {
      const hour = new Date(r.ts.getTime() + 8 * 3600 * 1000).getUTCHours();
      buckets[hour] += r.lapsDelta ?? 0;
    }
    return buckets;
  }

  function buildDaily(rows) {
    const map = {};
    for (const r of rows) {
      const d = rowDateStr(r.ts);
      map[d] = (map[d] ?? 0) + (r.lapsDelta ?? 0);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, laps]) => ({ date, laps }));
  }

  function classifyActivity(speedKmh) {
    const t = CONFIG.SPEED_THRESHOLDS;
    if (speedKmh === 0)         return { level: 'sleeping',  label: 'sleeping',  icon: '○' };
    if (speedKmh < t.idle)      return { level: 'idle',       label: 'walking',   icon: '◐' };
    if (speedKmh < t.active)    return { level: 'active',     label: 'active',    icon: '◑' };
    if (speedKmh < t.running)   return { level: 'running',    label: 'running',   icon: '●' };
    return                             { level: 'sprinting',  label: 'sprinting', icon: '◉' };
  }

  function computeStats(rows) {
    const today = todayDateStr();
    const todayRows = rows.filter(r => rowDateStr(r.ts) === today);

    const todayLaps = todayRows.reduce((sum, row) => sum + (row.lapsDelta ?? 0), 0);

    const todayDistanceM = todayLaps * CONFIG.WHEEL_CIRCUMFERENCE_M;

    const last = rows[rows.length - 1] || {};
    const currentRPM = last.rpm ?? 0;
    const currentSpeedKmh = last.speedKmhSmooth ?? last.speedKmh ?? 0;
    const activity = classifyActivity(currentSpeedKmh);

    return {
      todayLaps,
      todayDistanceM,
      currentRPM,
      currentSpeedKmh,
      activity,
      latestTemp: last.temperature ?? null,
      latestHumidity: last.humidity ?? null,
      latestLux: last.lux ?? null,
    };
  }

  async function fetchData() {
    const url =
      'https://docs.google.com/spreadsheets/d/' +
      CONFIG.SHEET_ID +
      '/export?format=csv&t=' + Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const rows = parseCsv(text);
    computeRates(rows);
    smoothSeries(rows, CONFIG.SMOOTHING_WINDOW);
    const stats = computeStats(rows);
    const hourly = buildHourly(rows);
    const daily = buildDaily(rows);
    return { rows, stats, hourly, daily };
  }

  window.fetchData = fetchData;
  window.classifyActivity = classifyActivity;
})();
