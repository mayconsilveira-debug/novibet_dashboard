(function() {
  const root = document.documentElement;
  const toggles = document.querySelectorAll('.theme-toggle');

  let isDark = true; // dark is default

  function applyTheme() {
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    // Update all theme toggles (topbar + sidebar) in one go
    const nextIcon  = isDark ? 'sun'   : 'moon';
    const nextLabel = isDark ? 'Light' : 'Dark';
    document.querySelectorAll('.theme-toggle .theme-toggle-icon').forEach(icon => {
      icon.setAttribute('data-lucide', nextIcon);
    });
    document.querySelectorAll('.theme-toggle .theme-toggle-label').forEach(label => {
      label.textContent = nextLabel;
    });
    if (window.lucide && lucide.createIcons) lucide.createIcons();

    // Refresh every live Chart.js instance: legend / axis ticks / grid lines
    // / tooltip — all driven by the same theme-aware palette as the initial
    // render. Keeps every chart legible after a theme toggle without us
    // having to enumerate them by id.
    const text      = isDark ? '#E5EAF0' : '#374151';
    const grid      = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
    const tooltipBg = isDark ? '#243848' : '#1A1D2E';

    if (window.Chart && typeof Chart.instances === 'object') {
      Object.values(Chart.instances).forEach(chart => {
        if (!chart || !chart.options) return;
        const opts = chart.options;
        // Legend
        const legLabels = opts.plugins && opts.plugins.legend && opts.plugins.legend.labels;
        if (legLabels) legLabels.color = text;
        // Tooltip
        if (opts.plugins && opts.plugins.tooltip) {
          opts.plugins.tooltip.backgroundColor = tooltipBg;
        }
        // Scales (x / y, may not exist for doughnut / radial charts)
        ['x', 'y'].forEach(axis => {
          const sc = opts.scales && opts.scales[axis];
          if (!sc) return;
          if (sc.ticks) sc.ticks.color = text;
          if (sc.grid && sc.grid.color != null) sc.grid.color = grid;
        });
        chart.update('none');
      });
    }

    localStorage.setItem('novibet-theme', isDark ? 'dark' : 'light');
  }

  // Load saved preference (default: dark)
  const saved = localStorage.getItem('novibet-theme');
  isDark = saved ? saved === 'dark' : true;

  toggles.forEach(btn => {
    btn.addEventListener('click', () => {
      isDark = !isDark;
      applyTheme();
    });
  });

  // Apply on load
  applyTheme();
})();
