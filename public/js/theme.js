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

    // Update Chart.js chart colors — dark values lifted so axis labels and
    // grid lines stay readable against the blue-black surface.
    const textColor  = isDark ? '#C5D4DB' : '#6B7280';
    const gridColor  = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
    const tooltipBg  = isDark ? '#243848' : '#1A1D2E';

    [window._pacingGaugeChart, window._pacingTrendChart].forEach(chart => {
      if (!chart) return;
      chart.destroy();
    });

    if (window.dashboardCharts && window.dashboardCharts.mainChart) {
      window.dashboardCharts.mainChart.options.scales.x.ticks.color = textColor;
      window.dashboardCharts.mainChart.options.scales.y.ticks.color = textColor;
      window.dashboardCharts.mainChart.options.scales.y.grid.color  = gridColor;
      window.dashboardCharts.mainChart.options.plugins.tooltip.backgroundColor = tooltipBg;
      window.dashboardCharts.mainChart.update();
    }

    // The mini charts (invest / format / channel) and the Pacing trend chart
    // use plugins that read the theme color on draw — force a repaint so the
    // value labels pick up the new foreground color.
    ['investChart', 'formatChart', 'channelChart', 'pacingTrendChart'].forEach(id => {
      const c = Chart.getChart(id);
      if (c) c.update();
    });

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
