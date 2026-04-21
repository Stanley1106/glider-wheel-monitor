(function () {
  let currentRange = 'today';
  let lastData = null;

  const elLaps       = document.getElementById('stat-laps');
  const elDistance   = document.getElementById('stat-distance');
  const elRpm        = document.getElementById('stat-rpm');
  const elTemp       = document.getElementById('stat-temp');
  const elHumidity   = document.getElementById('stat-humidity');
  const elLux        = document.getElementById('stat-lux');
  const elUpdated    = document.getElementById('last-updated');
  const elStatus     = document.getElementById('status-pill');
  const elError      = document.getElementById('error-banner');

  function fmtDistance(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(0) + ' m';
  }

  function fmtTime(date) {
    return date.toLocaleTimeString('zh-TW', { hour12: false });
  }

  function updateCards(stats) {
    elLaps.textContent     = stats.todayLaps.toLocaleString();
    elDistance.textContent = fmtDistance(stats.todayDistanceM);
    elRpm.textContent      = stats.currentSpeedKmh.toFixed(1) + ' km/h';
    elTemp.textContent     = stats.latestTemp !== null ? stats.latestTemp.toFixed(1) + '°C' : '—';
    elHumidity.textContent = stats.latestHumidity !== null ? stats.latestHumidity.toFixed(0) + '%' : '—';
    elLux.textContent      = stats.latestLux !== null ? stats.latestLux.toFixed(0) + ' lux' : '—';
    elStatus.textContent = stats.activity.icon + ' ' + stats.activity.label;
    elStatus.className = 'status-pill ' + stats.activity.level;
    document.body.classList.toggle('is-active', stats.currentSpeedKmh >= CONFIG.SPEED_THRESHOLDS.idle);
  }

  async function refresh() {
    try {
      const data = await fetchData();
      lastData = data;
      elError.classList.remove('visible');
      updateCards(data.stats);
      updateCharts(data, currentRange);
      elUpdated.textContent = 'last updated ' + fmtTime(new Date());
    } catch (err) {
      console.error('fetch failed:', err);
      elError.classList.add('visible');
    }
  }

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      if (lastData) updateCharts(lastData, currentRange);
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
      initCharts();
      refresh();
      setInterval(refresh, CONFIG.REFRESH_INTERVAL_MS);
    });
  });
})();
