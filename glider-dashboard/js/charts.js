(function () {
  const CHART_THEME = {
    background: '#0d120d',
    foreColor: '#6b7280',
  };
  const GRID = { borderColor: '#1a2a1a', strokeDashArray: 3 };
  const TOOLTIP = { theme: 'dark' };

  const charts = {};

  function initCharts() {
    charts.rpm = new ApexCharts(document.getElementById('chart-rpm'), {
      chart: {
        type: 'scatter',
        height: 180,
        background: CHART_THEME.background,
        foreColor: CHART_THEME.foreColor,
        toolbar: { autoSelected: 'zoom', show: true },
        zoom: { enabled: true },
        animations: { enabled: true, easing: 'easeinout', speed: 350 },
      },
      series: [{ name: 'Laps', data: [] }],
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: { min: 0, labels: { formatter: v => Math.round(v).toString() } },
      markers: { size: 4, colors: ['#39d353'], strokeWidth: 0 },
      colors: ['#39d353'],
      grid: GRID,
      tooltip: {
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
          const ts = w.globals.seriesX[0][dataPointIndex];
          const laps = series[0][dataPointIndex];
          const time = new Date(ts).toLocaleTimeString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });
          return '<div style="padding:8px 12px;background:#0d120d;border:1px solid #1a2a1a;border-radius:4px;font-family:monospace;font-size:12px">' +
            '<div style="color:#39d353">' + laps + ' laps</div>' +
            '<div style="color:#6b7280">' + time + '</div>' +
            '</div>';
        },
      },
      noData: { text: 'No data yet', style: { color: '#6b7280' } },
    });
    charts.rpm.render();

    charts.hourly = new ApexCharts(document.getElementById('chart-hourly'), {
      chart: {
        type: 'bar',
        height: 180,
        background: CHART_THEME.background,
        foreColor: CHART_THEME.foreColor,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 350 },
      },
      series: [{ name: 'Laps', data: new Array(24).fill(0) }],
      xaxis: {
        categories: Array.from({ length: 24 }, (_, i) => i),
        labels: { formatter: v => v + 'h' },
      },
      yaxis: { min: 0 },
      colors: ['#39d353'],
      plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
      grid: GRID,
      tooltip: TOOLTIP,
      noData: { text: 'No data yet', style: { color: '#6b7280' } },
    });
    charts.hourly.render();

    charts.luxRpm = new ApexCharts(document.getElementById('chart-lux-rpm'), {
      chart: {
        type: 'line',
        height: 180,
        background: CHART_THEME.background,
        foreColor: CHART_THEME.foreColor,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 350 },
      },
      series: [
        { name: 'RPM', data: [] },
        { name: 'Lux', data: [] },
      ],
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: [
        { seriesName: 'RPM', min: 0, labels: { formatter: v => v.toFixed(1) } },
        {
          seriesName: 'Lux',
          opposite: true,
          min: 0,
          labels: { formatter: v => v.toFixed(0) },
        },
      ],
      stroke: { curve: 'smooth', width: [2, 2], dashArray: [0, 4] },
      colors: ['#39d353', '#fbbf24'],
      grid: GRID,
      tooltip: { ...TOOLTIP, x: { format: 'HH:mm:ss' }, shared: true },
      legend: { labels: { colors: '#9ca3af' } },
      noData: { text: 'No data yet', style: { color: '#6b7280' } },
    });
    charts.luxRpm.render();

    charts.env = new ApexCharts(document.getElementById('chart-env'), {
      chart: {
        type: 'line',
        height: 180,
        background: CHART_THEME.background,
        foreColor: CHART_THEME.foreColor,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 350 },
      },
      series: [
        { name: 'Temp (°C)', data: [] },
        { name: 'Humidity (%)', data: [] },
      ],
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: [
        {
          seriesName: 'Temp (°C)',
          min: 15,
          max: 35,
          labels: { formatter: v => v.toFixed(1) + '°' },
        },
        {
          seriesName: 'Humidity (%)',
          opposite: true,
          min: 0,
          max: 100,
          labels: { formatter: v => v.toFixed(0) + '%' },
        },
      ],
      stroke: { curve: 'smooth', width: [2, 2], dashArray: [0, 4] },
      colors: ['#f87171', '#60a5fa'],
      grid: GRID,
      tooltip: { ...TOOLTIP, x: { format: 'HH:mm:ss' }, shared: true },
      legend: { labels: { colors: '#9ca3af' } },
      noData: { text: 'No data yet', style: { color: '#6b7280' } },
    });
    charts.env.render();

    charts.daily = new ApexCharts(document.getElementById('chart-daily'), {
      chart: {
        type: 'bar',
        height: 180,
        background: CHART_THEME.background,
        foreColor: CHART_THEME.foreColor,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 350 },
      },
      series: [{ name: 'Laps', data: [] }],
      xaxis: { type: 'category' },
      yaxis: { min: 0 },
      colors: ['#39d353'],
      plotOptions: { bar: { columnWidth: '60%', borderRadius: 2 } },
      grid: GRID,
      tooltip: TOOLTIP,
      noData: { text: 'No data yet', style: { color: '#6b7280' } },
    });
    charts.daily.render();
  }

  window.initCharts = initCharts;

  window.updateCharts = function updateCharts(data, range) {
    if (!data) return;
    const { rows, hourly, daily } = data;

    const now = Date.now();
    const cutoff = {
      '1h': now - 3600000,
      today: (() => {
        const d = new Date(now + 8 * 3600 * 1000);
        d.setUTCHours(0, 0, 0, 0);
        return d.getTime() - 8 * 3600 * 1000;
      })(),
      '7d': now - 7 * 86400000,
      '30d': now - 30 * 86400000,
      all: 0,
    }[range] ?? 0;

    const filtered = rows.filter(r => r.ts.getTime() >= cutoff);

    charts.rpm.updateSeries([{
      name: 'Laps',
      data: filtered.map(r => ({ x: r.ts.getTime(), y: r.lapsDelta ?? 0 })),
    }]);

    charts.hourly.updateSeries([{ name: 'Laps', data: hourly }]);

    charts.luxRpm.updateSeries([
      { name: 'RPM', data: filtered.map(r => ({ x: r.ts.getTime(), y: parseFloat(r.rpm.toFixed(2)) })) },
      { name: 'Lux', data: filtered.filter(r => r.lux !== null).map(r => ({ x: r.ts.getTime(), y: r.lux })) },
    ]);

    charts.env.updateSeries([
      { name: 'Temp (°C)', data: filtered.filter(r => r.temperature !== null).map(r => ({ x: r.ts.getTime(), y: r.temperature })) },
      { name: 'Humidity (%)', data: filtered.filter(r => r.humidity !== null).map(r => ({ x: r.ts.getTime(), y: r.humidity })) },
    ]);

    charts.daily.updateSeries([{
      name: 'Laps',
      data: daily.map(d => ({ x: d.date, y: d.laps })),
    }]);
  };

  window._charts = charts;
})();
