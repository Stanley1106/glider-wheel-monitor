(function () {
  const charts = {};
  let lastData = null;
  let lastRange = 'today';
  let themeListenerRegistered = false;

  function tokens() {
    return Theme.getTokens();
  }

  function commonOptions(height) {
    const t = tokens();
    return {
      chart: {
        height,
        background: t.surface,
        foreColor: t.fg2,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 400 },
      },
      dataLabels: { enabled: false },
      grid: { borderColor: t.border, strokeDashArray: 4 },
      tooltip: { theme: Theme.current() },
      noData: { text: 'No data', style: { color: t.fg2 } },
    };
  }

  function todayStartMs() {
    const now = Date.now();
    const day = new Date(now + 8 * 3600 * 1000);
    day.setUTCHours(0, 0, 0, 0);
    return day.getTime() - 8 * 3600 * 1000;
  }

  function todayStr() {
    return window.todayDateStr ? window.todayDateStr() : new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function rowsForRange(data, range) {
    const now = Date.now();
    const live = data.liveRows || [];
    const hr = data.hrRows || [];
    const summary = data.summaryRows || [];

    if (range === 'today') {
      return live.filter(row => window.rowDateStr(row.ts) === todayStr());
    }
    if (range === '7d') {
      const src = hr.length > 0 ? hr : live;
      return src.filter(row => row.ts.getTime() >= now - 7 * 86400000);
    }
    if (range === '30d') {
      const src = hr.length > 0 ? hr : live;
      return src.filter(row => row.ts.getTime() >= now - 30 * 86400000);
    }
    // all
    return summary.length > 0 ? summary : hr.length > 0 ? hr : live;
  }

  function destroyCharts() {
    Object.values(charts).forEach(chart => {
      try {
        chart.destroy();
      } catch (err) {
      }
    });
    Object.keys(charts).forEach(key => delete charts[key]);
  }

  function renderChart(key, selector, options) {
    const el = document.getElementById(selector);
    if (!el) return;
    el.innerHTML = '';
    charts[key] = new ApexCharts(el, options);
    charts[key].render();
  }

  function hasSeriesData(series) {
    return series.some(item => Array.isArray(item.data) && item.data.some(point => {
      if (point == null) return false;
      if (typeof point === 'object' && 'y' in point) return point.y != null;
      return true;
    }));
  }

  function mergeChartOptions(target, patch) {
    if (!patch) return target;

    for (const [key, value] of Object.entries(patch)) {
      if (Array.isArray(value) || value === null || typeof value !== 'object') {
        target[key] = value;
        continue;
      }

      target[key] = { ...(target[key] || {}), ...value };
    }

    return target;
  }

  function remountChart(key, patch) {
    const chart = charts[key];
    if (!chart?.el || !chart?.w?.config) return;

    const el = chart.el;
    const config = mergeChartOptions(chart.w.config, patch);

    chart.destroy();
    charts[key] = new ApexCharts(el, config);
    return charts[key].render();
  }

  function updateAxisChart(key, series, options) {
    const chart = charts[key];
    if (!chart) return;

    const hasData = hasSeriesData(series);
    const noData = hasData
      ? { ...commonOptions(0).noData, text: '' }
      : commonOptions(0).noData;

    if (chart.w?.globals?.noData !== !hasData) {
      remountChart(key, { ...options, noData, series });
      return;
    }

    if (options) {
      chart.updateOptions(options, false, false, false);
    }

    chart.updateOptions({ noData }, false, false, false);
    chart.updateSeries(series);

    requestAnimationFrame(() => {
      const noDataOverlay = chart.el?.querySelector('.apexcharts-text-nodata');
      if (noDataOverlay) noDataOverlay.style.display = hasData ? 'none' : '';
    });
  }

  function initCharts() {
    const t = tokens();

    destroyCharts();

    renderChart('rpm', 'chart-rpm', {
      ...commonOptions(200),
      chart: { ...commonOptions(200).chart, type: 'area' },
      series: [{ name: 'Laps', data: [] }],
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: { min: 0, labels: { formatter: value => Math.round(value).toString() } },
      stroke: { curve: 'smooth', width: 1.5 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .22, opacityTo: .01, stops: [0, 85] } },
      colors: [t.teal],
      markers: { size: 0 },
      tooltip: { theme: Theme.current(), x: { format: 'HH:mm' } },
    });

    renderChart('luxRpm', 'chart-lux-rpm', {
      ...commonOptions(165),
      chart: { ...commonOptions(165).chart, type: 'line' },
      series: [{ name: 'RPM', data: [] }, { name: 'Lux', data: [] }],
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: [
        { seriesName: 'RPM', min: 0, labels: { formatter: value => value.toFixed(1) } },
        { seriesName: 'Lux', opposite: true, min: 0, labels: { formatter: value => Math.round(value).toString() } },
      ],
      stroke: { curve: 'smooth', width: [1.5, 1.5], dashArray: [0, 5] },
      colors: [t.teal, t.lux],
      tooltip: { theme: Theme.current(), x: { format: 'HH:mm' }, shared: true },
      legend: { labels: { colors: t.fg2 } },
    });

    renderChart('env', 'chart-env', {
      ...commonOptions(165),
      chart: { ...commonOptions(165).chart, type: 'line' },
      series: [{ name: 'Temp (°C)', data: [] }, { name: 'Humidity (%)', data: [] }],
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: [
        { seriesName: 'Temp (°C)', min: 15, max: 35, labels: { formatter: value => value.toFixed(1) + '°C' } },
        { seriesName: 'Humidity (%)', opposite: true, min: 0, max: 100, labels: { formatter: value => Math.round(value) + '%' } },
      ],
      stroke: { curve: 'smooth', width: [1.5, 1.5], dashArray: [0, 5] },
      colors: [t.rose, t.steel],
      tooltip: { theme: Theme.current(), x: { format: 'HH:mm' }, shared: true },
      legend: { labels: { colors: t.fg2 } },
    });

    if (!themeListenerRegistered) {
      Theme.onChange(window.rebuildCharts);
      themeListenerRegistered = true;
    }
  }

  function updateCharts(data, range) {
    if (!data) return;
    lastData = data;
    lastRange = range || lastRange;

    const rangeRows = rowsForRange(data, lastRange);

    updateAxisChart('rpm', [{ name: 'Laps', data: rangeRows.map(row => ({ x: row.ts.getTime(), y: row.lapsDelta || 0 })) }]);

    updateAxisChart('luxRpm', [
      { name: 'RPM', data: rangeRows.map(row => ({ x: row.ts.getTime(), y: Number((row.rpm || 0).toFixed(2)) })) },
      { name: 'Lux', data: rangeRows.filter(row => row.lux != null).map(row => ({ x: row.ts.getTime(), y: row.lux })) },
    ]);

    updateAxisChart('env', [
      { name: 'Temp (°C)', data: rangeRows.map(row => ({ x: row.ts.getTime(), y: row.temperature ?? null })) },
      { name: 'Humidity (%)', data: rangeRows.map(row => ({ x: row.ts.getTime(), y: row.humidity ?? null })) },
    ]);

  }

  function rebuildCharts() {
    destroyCharts();
    initCharts();
    if (lastData) updateCharts(lastData, lastRange);
  }

  window.initCharts = initCharts;
  window.updateCharts = updateCharts;
  window.rebuildCharts = rebuildCharts;
  window._charts = charts;
})();
