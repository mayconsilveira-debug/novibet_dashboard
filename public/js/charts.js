/**
 * Charts Module
 * Chart.js integration for dashboard
 */

// Theme-aware text color for canvas-drawn labels (plugins that use ctx.fillText).
// Read at draw time so theme switches pick up the new color on next update.
function _pluginTextColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? '#C5D4DB'
    : '#374151';
}

// Custom Chart.js plugin: each slice gets an "abs (pct%)" label outside the
// donut connected by a 2-segment leader line — short radial out from the arc
// edge, then a horizontal elbow to where the label sits. Same-side labels
// are forced to a 16px minimum vertical gap so adjacent small slices don't
// pile up. Slices below 3% drop to a smaller font so they fit alongside the
// larger labels.
const doughnutCallouts = {
  id: 'doughnutCallouts',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!meta || !meta.data || !meta.data.length) return;

    const dataArr = dataset.data || [];
    const labels = chart.data.labels || [];
    const total = meta.total || dataArr.reduce((a, b) => a + (b || 0), 0);
    if (!total) return;

    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;

    // Geometry per slice: anchor on arc edge, a radial bend a few pixels out,
    // and an initial elbow y at the natural radial projection (we'll adjust
    // it with the collision pass below).
    const radialOffset = 6;     // length of the first (radial) leader segment
    const elbowOffset  = 14;    // horizontal distance from donut to label x

    const slices = meta.data.map((arc, i) => {
      const value = dataArr[i];
      if (!value || value <= 0) return null;
      const mid  = (arc.startAngle + arc.endAngle) / 2;
      const cosA = Math.cos(mid);
      const sinA = Math.sin(mid);
      const outer = arc.outerRadius;
      return {
        i,
        value,
        pct: (value / total) * 100,
        label: labels[i] || '',
        cosA,
        sinA,
        outer,
        anchorX: cx + cosA * outer,
        anchorY: cy + sinA * outer,
        radialX: cx + cosA * (outer + radialOffset),
        radialY: cy + sinA * (outer + radialOffset),
        // initial label y = a touch further out radially; collision pass below
        // adjusts this without changing the anchor / radial points.
        y: cy + sinA * (outer + elbowOffset),
        isRight: cosA >= 0
      };
    }).filter(Boolean);

    if (!slices.length) return;

    // Distribute labels on each side enforcing a minimum vertical gap. Two
    // passes (top-down + bottom-up) cover both ends without compressing back
    // into a stack.
    const minGap = 16;
    const top    = chartArea.top + 4;
    const bottom = chartArea.bottom - 4;
    const distribute = (list) => {
      if (list.length === 0) return;
      list.sort((a, b) => a.y - b.y);
      list.forEach(s => { s.y = Math.max(top, Math.min(bottom, s.y)); });
      for (let i = 1; i < list.length; i++) {
        const floor = list[i - 1].y + minGap;
        if (list[i].y < floor) list[i].y = floor;
      }
      for (let i = list.length - 2; i >= 0; i--) {
        const ceil = list[i + 1].y - minGap;
        if (list[i].y > ceil) list[i].y = ceil;
      }
    };
    distribute(slices.filter(s => !s.isRight));
    distribute(slices.filter(s =>  s.isRight));

    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(156,163,175,0.7)';
    ctx.textBaseline = 'middle';

    slices.forEach(s => {
      const elbowX = cx + (s.isRight ? 1 : -1) * (s.outer + elbowOffset);
      const elbowY = s.y;

      // Leader: arc edge → radial bend → elbow at the (possibly nudged) y.
      ctx.beginPath();
      ctx.moveTo(s.anchorX, s.anchorY);
      ctx.lineTo(s.radialX, s.radialY);
      ctx.lineTo(elbowX, elbowY);
      ctx.stroke();

      // Smaller font for tiny slices so they don't crowd larger labels.
      const fontSize = s.pct < 3 ? 10 : 11;
      ctx.font = `${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillStyle = _pluginTextColor();
      ctx.textAlign = s.isRight ? 'left' : 'right';

      const abs  = Math.round(s.value).toLocaleString('pt-BR');
      const text = `${abs} (${s.pct.toFixed(0)}%)`;
      const labelPad = 4;
      ctx.fillText(text, elbowX + (s.isRight ? labelPad : -labelPad), elbowY);
    });

    ctx.restore();
  }
};

// Abbreviated money formatter for bar value labels: 1234 → "R$ 1,2k".
function _fmtAbbrevBRL(n) {
  const abs = Math.abs(n || 0);
  if (abs >= 1e9) return 'R$ ' + (n / 1e9).toFixed(1).replace('.', ',') + 'B';
  if (abs >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (abs >= 1e3) return 'R$ ' + (n / 1e3).toFixed(1).replace('.', ',') + 'k';
  return 'R$ ' + Math.round(n);
}

// Abbreviated plain-number formatter for bar value labels: 1234 → "1,2k".
function _fmtAbbrevNum(n) {
  const abs = Math.abs(n || 0);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + 'k';
  return String(Math.round(n));
}

// Chart.js plugin: writes an abbreviated value on each bar of a HORIZONTAL
// bar chart. If the bar is wide enough to hold the text, the label sits
// inside (white, right-aligned); otherwise it sits just outside the bar's
// end (dark, left-aligned).
const hBarValueLabels = {
  id: 'hBarValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = (chart.data.datasets[0] && chart.data.datasets[0].data) || [];
    if (!meta || !meta.data || !meta.data.length) return;

    ctx.save();
    ctx.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    meta.data.forEach((bar, i) => {
      const value = data[i];
      if (!value || value <= 0) return;
      const text = _fmtAbbrevNum(value);
      const textWidth = ctx.measureText(text).width;
      const barWidth = bar.x - bar.base;
      const pad = 6;

      if (barWidth >= textWidth + pad * 2) {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(text, bar.x - pad, bar.y);
      } else {
        ctx.fillStyle = _pluginTextColor();
        ctx.textAlign = 'left';
        ctx.fillText(text, bar.x + 4, bar.y);
      }
    });

    ctx.restore();
  }
};

// Chart.js plugin: writes an abbreviated value above each bar of a vertical
// bar chart. Zero-values are skipped so empty months don't get a "R$ 0".
const barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = (chart.data.datasets[0] && chart.data.datasets[0].data) || [];
    if (!meta || !meta.data || !meta.data.length) return;

    ctx.save();
    ctx.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = _pluginTextColor();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    meta.data.forEach((bar, i) => {
      const value = data[i];
      if (!value || value <= 0) return;
      ctx.fillText(_fmtAbbrevBRL(value), bar.x, bar.y - 4);
    });

    ctx.restore();
  }
};

class DashboardCharts {
  constructor() {
    this.mainChart = null;
    this.currentMetric = 'impressions';
    this.currentDrill = 'mes';

    // KPI colors
    this.kpiColors = {
      impressions: { border: '#A89CF7', bg: 'rgba(168, 156, 247, 0.12)' },
      clicks: { border: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
      ctr: { border: '#FB923C', bg: 'rgba(251, 146, 60, 0.12)' },
      views: { border: '#34D399', bg: 'rgba(52, 211, 153, 0.12)' }
    };

    this.colors = {
      grid: '#E5E7EB',
      text: '#6B7280'
    };

    // Populated async from Supabase; until it arrives the main chart renders
    // with empty data.
    this._rows = null;

    if (window.DashboardData && typeof window.DashboardData.onDataReady === 'function') {
      window.DashboardData.onDataReady((rows) => {
        this._rows = rows;
        this.updateChart();
      });
    }
  }
  
  /**
   * Initialize main area chart
   */
  initMainChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const data = this.getDataForMetricAndDrill(this.currentMetric, this.currentDrill);
    const colors = this.kpiColors[this.currentMetric];
    
    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: this.getMetricLabel(this.currentMetric),
          data: data.values,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: colors.border,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              padding: 12,
              color: this.colors.text,
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '500' }
            }
          },
          tooltip: {
            backgroundColor: '#1A1D2E',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => {
                let val = context.parsed.y;
                if (this.currentMetric === 'ctr') return ` ${val.toFixed(2)}%`;
                if (val >= 1000000) return ` ${(val / 1000000).toFixed(1)}M`;
                if (val >= 1000) return ` ${(val / 1000).toFixed(0)}k`;
                return ` ${val.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: this.colors.text,
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            border: { display: false },
            grid: { color: this.colors.grid, drawBorder: false },
            ticks: {
              color: this.colors.text,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (value) => {
                if (this.currentMetric === 'ctr') return value.toFixed(1) + '%';
                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
                return value;
              }
            }
          }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });
    
    return this.mainChart;
  }
  
  /**
   * Get metric label
   */
  getMetricLabel(metric) {
    const labels = { impressions: 'Impressions', clicks: 'Clicks', ctr: 'CTR', views: 'Complete Views' };
    return labels[metric] || metric;
  }
  
  /**
   * Get data for specific metric and drill level, aggregated live from
   * Supabase. Applies the Dashboard's current period + cross-filter dims so
   * the main chart stays in sync with the rest of Overview. Returns empty
   * series until the row cache has been populated by data.js.
   */
  getDataForMetricAndDrill(metric, drill) {
    const DD = window.DashboardData;
    if (!this._rows || !DD) return { labels: [], values: [] };
    const period = (window.dashboard && typeof window.dashboard.getActivePeriod === 'function')
      ? window.dashboard.getActivePeriod()
      : null;
    const rows = DD.applyFilters ? DD.applyFilters(this._rows, period) : this._rows;
    if (drill === 'ano') return DD.aggregateByYear(rows, metric);
    if (drill === 'mes') return DD.aggregateByMonth(rows, metric);
    if (drill === 'semana') return DD.aggregateByWeek(rows, metric, 12);
    return { labels: [], values: [] };
  }
  
  /**
   * Update chart for metric (called from main.js)
   */
  updateChartForMetric(metric) {
    this.currentMetric = metric;
    this.updateChart();
  }
  
  /**
   * Update chart for drill level
   */
  updateChartForDrill(drill) {
    this.currentDrill = drill;
    this.updateChart();
  }
  
  /**
   * Update chart with current state
   */
  updateChart() {
    if (!this.mainChart) return;
    
    const data = this.getDataForMetricAndDrill(this.currentMetric, this.currentDrill);
    const colors = this.kpiColors[this.currentMetric];
    
    this.mainChart.data.labels = data.labels;
    this.mainChart.data.datasets[0].label = this.getMetricLabel(this.currentMetric);
    this.mainChart.data.datasets[0].data = data.values;
    this.mainChart.data.datasets[0].borderColor = colors.border;
    this.mainChart.data.datasets[0].backgroundColor = colors.bg;
    this.mainChart.data.datasets[0].pointBackgroundColor = colors.border;
    
    this.mainChart.update();
  }
  
  /**
   * Initialize empty mini charts (investChart, formatChart, channelChart).
   * Values are filled in by updateMiniChartsForYear() once Supabase data
   * arrives.
   */
  initMiniCharts() {
    // Compact legend preset for the mini charts — small font, tight spacing,
    // circle markers so they feel in proportion to the smaller canvases.
    const miniLegend = {
      display: true,
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 6,
        boxHeight: 6,
        padding: 8,
        font: { size: 10 },
        color: '#6B7280'
      }
    };

    const investCtx = document.getElementById('investChart');
    if (investCtx) {
      new Chart(investCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{
          label: 'Investimento (R$)',
          data: [],
          backgroundColor: '#2563EB',
          borderRadius: 6,
          borderSkipped: false
        }] },
        plugins: [barValueLabels],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // Extra top padding so the label above the tallest bar doesn't
          // clip against the card border.
          layout: { padding: { top: 16 } },
          plugins: {
            legend: miniLegend,
            tooltip: {
              callbacks: {
                label: (ctx) => ' R$ ' + Math.round(ctx.parsed.y).toLocaleString('pt-BR')
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { display: false }
          }
        }
      });
    }

    const formatCtx = document.getElementById('formatChart');
    if (formatCtx) {
      new Chart(formatCtx, {
        type: 'doughnut',
        data: { labels: [], datasets: [{
          data: [],
          // Distinct colour per format — stable order so the same format
          // keeps the same hue between sessions.
          backgroundColor: [
            '#2563EB', // blue
            '#7C6FF7', // violet
            '#34D399', // green
            '#FB923C', // orange
            '#F43F5E', // pink
            '#06B6D4', // cyan
            '#EAB308', // yellow
            '#A855F7'  // purple
          ],
          borderWidth: 0,
          hoverOffset: 4,
          radius: '80%'
        }] },
        plugins: [doughnutCallouts],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          // Horizontal padding for callout text, vertical padding so top/
          // bottom labels don't collide with the title or the legend.
          layout: { padding: { left: 60, right: 60, top: 12, bottom: 16 } },
          onClick: (evt, elements, chart) => {
            if (!elements || !elements.length) return;
            const label = chart.data.labels[elements[0].index];
            if (label && window.dashboard) window.dashboard.setFilter('formato', label);
          },
          onHover: (evt, elements) => {
            evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
          },
          plugins: {
            // Legend kept on a single row — smaller box + tight padding so
            // up to ~8 formats fit without wrapping.
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 6,
                boxHeight: 6,
                padding: 10,
                font: { size: 11 },
                color: '#6B7280'
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = ctx.chart.getDatasetMeta(0).total || 1;
                  const pct = (ctx.parsed / total) * 100;
                  const abs = Math.round(ctx.parsed).toLocaleString('pt-BR');
                  return ` ${ctx.label}: ${abs} (${pct.toFixed(1)}%)`;
                }
              }
            }
          }
        }
      });
    }

    const channelCtx = document.getElementById('channelChart');
    if (channelCtx) {
      new Chart(channelCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{
          label: 'Views',
          data: [],
          backgroundColor: '#059669',
          borderRadius: 6,
          borderSkipped: false
        }] },
        plugins: [hBarValueLabels],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          // Right padding reserves room for value labels that sit outside
          // small bars.
          layout: { padding: { right: 36 } },
          onClick: (evt, elements, chart) => {
            if (!elements || !elements.length) return;
            const label = chart.data.labels[elements[0].index];
            if (label && window.dashboard) window.dashboard.setFilter('canal', label);
          },
          onHover: (evt, elements) => {
            evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
          },
          plugins: {
            legend: miniLegend,
            tooltip: {
              callbacks: {
                label: (ctx) => ' ' + ctx.parsed.x.toLocaleString('pt-BR') + ' views'
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 11 },
                callback: (v) => {
                  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
                  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k';
                  return v;
                }
              }
            },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  }

  /**
   * Refresh all three mini charts for the given year using Supabase data.
   */
  async updateMiniChartsForYear(year) {
    const DD = window.DashboardData;
    if (!DD) return;

    try {
      const [invest, share, channels] = await Promise.all([
        DD.aggregateInvestByMonthForYear(year),
        DD.aggregateFormatShareForYear(year),
        DD.aggregateChannelsByViewsForYear(year, 6)
      ]);

      const investChart = Chart.getChart('investChart');
      if (investChart) {
        investChart.data.labels = invest.labels;
        investChart.data.datasets[0].data = invest.values;
        investChart.update();
      }

      const formatChart = Chart.getChart('formatChart');
      if (formatChart) {
        formatChart.data.labels = share.labels;
        formatChart.data.datasets[0].data = share.values; // absolute values
        formatChart.update();

        // Center overlay: name + % of the largest slice
        let topIdx = -1, topVal = -1;
        share.values.forEach((v, i) => { if (v > topVal) { topVal = v; topIdx = i; } });
        const nameEl = document.querySelector('#formatChartCenter div:first-child');
        const pctEl  = document.querySelector('#formatChartCenter div:last-child');
        if (nameEl) nameEl.textContent = topIdx >= 0 ? share.labels[topIdx] : '—';
        if (pctEl) {
          const pct = topIdx >= 0 ? share.percents[topIdx] : null;
          pctEl.textContent = pct != null ? pct.toFixed(1).replace('.', ',') + '%' : '—';
        }
      }

      const channelChart = Chart.getChart('channelChart');
      if (channelChart) {
        channelChart.data.labels = channels.labels;
        channelChart.data.datasets[0].data = channels.values;
        channelChart.update();
      }
    } catch (err) {
      console.error('[Supabase] updateMiniChartsForYear failed:', err);
    }
  }
  
  /**
   * Create a mini doughnut chart
   */
  createDoughnutChart(canvasId, data, labels) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            this.colors.primary,
            this.colors.success,
            this.colors.warning
          ],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
  
  /**
   * Create a bar chart
   */
  createBarChart(canvasId, data, labels) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: this.colors.primary,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            border: {
              display: false
            },
            grid: {
              color: this.colors.grid
            }
          }
        }
      }
    });
  }
  
  /**
   * Destroy chart instance
   */
  destroy() {
    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardCharts = new DashboardCharts();
});
