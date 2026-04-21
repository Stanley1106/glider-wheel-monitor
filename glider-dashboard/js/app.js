(function () {
  let currentRange = 'today';
  let lastData = null;
  const rangeButtons = Array.from(document.querySelectorAll('.range-btn'));
  const RANGE_LABELS = {
    '1h': '1h',
    today: 'Today',
    '7d': '7d',
    '30d': '30d',
    all: 'All',
  };

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

  function startOfToday() {
    const now = Date.now();
    const d = new Date(now + 8 * 3600 * 1000);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() - 8 * 3600 * 1000;
  }

  function isRangeAvailable(rows, range) {
    if (!rows.length) return false;

    const firstTs = rows[0].ts.getTime();
    const lastTs = rows[rows.length - 1].ts.getTime();
    const now = Date.now();

    switch (range) {
      case '1h': {
        const cutoff = now - 3600000;
        return firstTs <= cutoff && lastTs >= cutoff;
      }
      case 'today':
        return lastTs >= startOfToday();
      case '7d': {
        const cutoff = now - 7 * 86400000;
        return firstTs <= cutoff && lastTs >= cutoff;
      }
      case '30d': {
        const cutoff = now - 30 * 86400000;
        return firstTs <= cutoff && lastTs >= cutoff;
      }
      case 'all':
        return true;
      default:
        return false;
    }
  }

  function syncRangeButtons(rows) {
    const availableRanges = new Set(
      rangeButtons
        .map(btn => btn.dataset.range)
        .filter(range => isRangeAvailable(rows, range))
    );

    rangeButtons.forEach(btn => {
      const range = btn.dataset.range;
      const enabled = availableRanges.has(range);
      btn.disabled = !enabled;
      btn.classList.toggle('disabled', !enabled);
      btn.title = enabled ? '' : `${RANGE_LABELS[range] ?? range} needs more history`;
    });
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
      syncRangeButtons(data.rows);
      updateCards(data.stats);
      updateCharts(data, currentRange);
      elUpdated.textContent = 'last updated ' + fmtTime(new Date());
    } catch (err) {
      console.error('fetch failed:', err);
      elError.classList.add('visible');
    }
  }

  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      rangeButtons.forEach(b => b.classList.remove('active'));
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
