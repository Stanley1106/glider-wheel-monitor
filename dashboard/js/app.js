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
        if (lastData) updateCharts(lastData, currentRange);
      });
    });
  }

  function resizeVisibleCharts() {
    setTimeout(() => {
      Object.values(window._charts || {}).forEach(chart => {
        try {
          chart.updateOptions({}, true, false);
        } catch (err) {
        }
      });
    }, 50);
  }

  function wireTabs() {
    document.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-tab]').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
          pane.style.display = 'none';
        });

        button.classList.add('active');
        const pane = document.getElementById('tab-' + button.dataset.tab);
        if (pane) {
          pane.classList.add('active');
          pane.style.display = pane.classList.contains('chart-grid') ? 'grid' : 'block';
        }
        resizeVisibleCharts();
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
    wireTabs();
    wireThemeToggle();
    poll();
    setInterval(poll, CONFIG.REFRESH_INTERVAL_MS);
  });
})();
