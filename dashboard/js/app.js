(function () {
  let currentRange = 'today';
  let lastData = null;

  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateThemeButton() {
    text('theme-btn', Theme.current() === 'dark' ? 'light' : 'dark');
  }

  function renderStats(stats) {
    text('stat-laps', stats.todayLaps.toLocaleString());
    text('stat-distance', (stats.todayDistanceM / 1000).toFixed(2) + ' km');
    text('stat-rpm', stats.currentSpeedKmh.toFixed(1) + ' km/h');
    text('stat-temp', stats.latestTemp == null ? '--' : stats.latestTemp.toFixed(1) + '\u00b0C');
    text('stat-humidity', stats.latestHumidity == null ? '--' : Math.round(stats.latestHumidity) + '%');
    text('stat-lux', stats.latestLux == null ? '--' : Math.round(stats.latestLux) + ' lux');

    const pill = document.getElementById('status-pill');
    if (pill) {
      pill.classList.remove('sleeping', 'active', 'sprinting');
      pill.classList.add(stats.activity.level);
    }
    text('status-text', stats.activity.label);
    document.body.classList.toggle('is-active', stats.activity.level !== 'sleeping');
  }

  function setLastUpdated() {
    const stamp = new Date().toLocaleTimeString('zh-TW', {
      hour12: false,
      timeZone: 'Asia/Taipei',
    });
    text('last-updated', 'upd ' + stamp);
  }

  function showErrorBanner() {
    const el = document.getElementById('error-banner');
    if (el) el.classList.add('visible');
  }

  function hideErrorBanner() {
    const el = document.getElementById('error-banner');
    if (el) el.classList.remove('visible');
  }

  async function poll() {
    try {
      const data = await fetchData();
      lastData = data;
      renderStats(data.stats);
      updateCharts(data, currentRange);
      Heatmap.update(data.annual);
      hideErrorBanner();
      setLastUpdated();
    } catch (err) {
      console.error('fetch failed:', err);
      showErrorBanner();
    }
  }

  function wireRangeButtons() {
    document.querySelectorAll('[data-range]').forEach(button => {
      button.addEventListener('click', () => {
        currentRange = button.dataset.range;
        document.querySelectorAll('[data-range]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        const rangeLabel = document.querySelector('.chart-range');
        if (rangeLabel) rangeLabel.textContent = currentRange;
        if (lastData) updateCharts(lastData, currentRange);
      });
    });
  }

  function wireThemeToggle() {
    updateThemeButton();
    Theme.onChange(updateThemeButton);

    const button = document.getElementById('theme-btn');
    if (button) button.addEventListener('click', () => Theme.toggle());
  }

  document.addEventListener('DOMContentLoaded', () => {
    Theme.init();
    initCharts();
    Heatmap.init({ byDate: {}, years: [], maxLaps: 1 });
    wireRangeButtons();
    wireThemeToggle();
    poll();
    setInterval(poll, CONFIG.REFRESH_INTERVAL_MS);
  });
})();
