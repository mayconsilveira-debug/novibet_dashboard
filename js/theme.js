(function() {
  const root = document.documentElement;
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');

  let isDark = true; // dark is default

  function applyTheme() {
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      icon.setAttribute('data-lucide', 'sun');
      label.textContent = 'Light';
    } else {
      root.removeAttribute('data-theme');
      icon.setAttribute('data-lucide', 'moon');
      label.textContent = 'Dark';
    }
    lucide.createIcons();

    // Update Chart.js chart colors
    const textColor  = isDark ? '#8BA5B0' : '#6B7280';
    const gridColor  = isDark ? 'rgba(255,255,255,0.05)' : '#E5E7EB';
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

    localStorage.setItem('novibet-theme', isDark ? 'dark' : 'light');
  }

  // Load saved preference (default: dark)
  const saved = localStorage.getItem('novibet-theme');
  isDark = saved ? saved === 'dark' : true;

  btn.addEventListener('click', () => {
    isDark = !isDark;
    applyTheme();
  });

  // Apply on load
  applyTheme();
})();
