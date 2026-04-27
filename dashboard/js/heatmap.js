(function () {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  let annualData = { byDate: {}, years: [], maxLaps: 1 };
  let selectedYear = new Date().getFullYear();
  let themeListenerRegistered = false;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function displayDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function heatLevel(val, max) {
    if (!val) return 0;
    const r = val / max;
    if (r < 0.15) return 1;
    if (r < 0.35) return 2;
    if (r < 0.60) return 3;
    if (r < 0.80) return 4;
    return 5;
  }

  function chooseYear(years) {
    const current = new Date().getFullYear();
    if (years.includes(selectedYear)) return selectedYear;
    if (years.includes(current)) return current;
    if (years.length) return years[years.length - 1];
    return current;
  }

  function latestDataDateForYear(year) {
    const dates = Object.entries(annualData.byDate || {})
      .filter(([key, laps]) => laps > 0 && Number(key.slice(0, 4)) === year)
      .map(([key]) => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
      })
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => b - a);

    return dates[0] || new Date(year, 0, 1);
  }

  function weeksToRender(year, offset) {
    const today = new Date();
    const jan1 = new Date(year, 0, 1);
    const latest = latestDataDateForYear(year);
    const end = year === today.getFullYear() && latest > today ? today : latest;
    const dayIndex = Math.max(0, Math.floor((end - jan1) / 86400000));
    return Math.max(1, Math.ceil((offset + dayIndex + 1) / 7));
  }

  function renderYearSwitcher() {
    const switcher = document.getElementById('year-switcher');
    if (!switcher) return;

    const years = annualData.years.length ? annualData.years : [selectedYear];
    switcher.innerHTML = '';

    years.forEach(year => {
      const button = document.createElement('button');
      button.className = 'year-btn' + (year === selectedYear ? ' active' : '');
      button.textContent = year;
      button.addEventListener('click', () => {
        selectedYear = year;
        render();
      });
      switcher.appendChild(button);
    });
  }

  function renderLegend() {
    const legend = document.getElementById('hmap-legend');
    if (!legend) return;

    const levels = Theme.getTokens().heatLevels;
    legend.innerHTML = '';

    levels.forEach(color => {
      const cell = document.createElement('div');
      cell.className = 'hmap-legend-cell';
      cell.style.background = color;
      legend.appendChild(cell);
    });
  }

  function attachTooltip(cell, date, value) {
    const tooltip = document.getElementById('hmap-tooltip');
    if (!tooltip) return;

    cell.addEventListener('mousemove', event => {
      tooltip.innerHTML = value
        ? '<span>' + displayDate(date) + '</span><br><b>' + value.toLocaleString() + '</b> laps'
        : '<span>' + displayDate(date) + '</span><br><span>no activity</span>';
      tooltip.classList.add('visible');
      tooltip.style.left = event.clientX + 14 + 'px';
      tooltip.style.top = event.clientY - 14 + 'px';
    });

    cell.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  }

  function renderGrid() {
    const outer = document.getElementById('heatmap-outer');
    if (!outer) return;

    const tokens = Theme.getTokens();
    const cellPx = CONFIG.HEATMAP.CELL_PX;
    const gapPx = CONFIG.HEATMAP.GAP_PX;
    const today = new Date();
    const jan1 = new Date(selectedYear, 0, 1);
    const offset = jan1.getDay();
    const weekCount = weeksToRender(selectedYear, offset);
    let lastMonth = -1;

    outer.innerHTML = '';

    const frame = document.createElement('div');
    frame.className = 'heatmap-frame';

    const labels = document.createElement('div');
    labels.className = 'heatmap-ylabels';
    labels.style.gap = gapPx + 'px';
    DOW_LABELS.forEach(label => {
      const el = document.createElement('div');
      el.className = 'heatmap-ylabel';
      el.style.height = cellPx + 'px';
      el.style.lineHeight = cellPx + 'px';
      el.textContent = label;
      labels.appendChild(el);
    });
    frame.appendChild(labels);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    const months = document.createElement('div');
    months.className = 'heatmap-months';
    months.style.gap = gapPx + 'px';

    const weeks = document.createElement('div');
    weeks.className = 'heatmap-weeks';
    weeks.style.gap = gapPx + 'px';

    for (let week = 0; week < weekCount; week++) {
      const weekStartIndex = week * 7 - offset;
      const monthLabel = document.createElement('div');
      monthLabel.className = 'heatmap-month';
      monthLabel.style.width = cellPx + 'px';

      const col = document.createElement('div');
      col.className = 'heatmap-week';
      col.style.gap = gapPx + 'px';

      let firstDateInWeek = null;

      for (let dow = 0; dow < 7; dow++) {
        const date = new Date(selectedYear, 0, 1 + weekStartIndex + dow);
        const cell = document.createElement('div');
        cell.className = 'hmap-cell';
        cell.style.width = cellPx + 'px';
        cell.style.height = cellPx + 'px';

        if (date.getFullYear() !== selectedYear || date > today) {
          cell.style.background = 'transparent';
        } else {
          if (!firstDateInWeek) firstDateInWeek = date;
          const key = dateKey(date);
          const laps = annualData.byDate[key] || 0;
          cell.style.background = tokens.heatLevels[heatLevel(laps, annualData.maxLaps || 1)];
          attachTooltip(cell, date, laps);
        }

        col.appendChild(cell);
      }

      if (firstDateInWeek) {
        const month = firstDateInWeek.getMonth();
        if (month !== lastMonth) {
          monthLabel.textContent = MONTHS[month];
          lastMonth = month;
        }
      }

      months.appendChild(monthLabel);
      weeks.appendChild(col);
    }

    grid.appendChild(months);
    grid.appendChild(weeks);
    frame.appendChild(grid);
    outer.appendChild(frame);
  }

  function render() {
    selectedYear = chooseYear(annualData.years || []);
    renderYearSwitcher();
    renderGrid();
    renderLegend();
  }

  window.Heatmap = {
    init(annual) {
      annualData = annual || annualData;
      selectedYear = chooseYear(annualData.years || []);
      render();

      if (!themeListenerRegistered) {
        Theme.onChange(() => window.Heatmap.rebuild());
        themeListenerRegistered = true;
      }
    },
    update(annual) {
      annualData = annual || { byDate: {}, years: [], maxLaps: 1 };
      selectedYear = chooseYear(annualData.years || []);
      render();
    },
    rebuild() {
      render();
    },
  };
})();
