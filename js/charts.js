/**
 * Charts Module
 * Chart.js integration for dashboard
 */

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

    // Drill labels
    this.drillLabels = {
      ano: ['2023', '2024', '2025', '2026'],
      mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      semana: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
    };
    
    this.colors = {
      grid: '#E5E7EB',
      text: '#6B7280'
    };
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
            display: false
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
   * Get data for specific metric and drill level
   */
  getDataForMetricAndDrill(metric, drill) {
    const labels = this.drillLabels[drill];
    let values = [];
    
    // Generate realistic mock data based on metric and drill
    switch (metric) {
      case 'impressions':
        if (drill === 'ano') values = [52000000, 58000000, 65000000, 72000000];
        else if (drill === 'mes') values = [45, 48, 52, 55, 58, 60, 63, 65, 68, 70, 72, 75].map(v => v * 1000000);
        else values = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34].map(v => v * 1000000);
        break;
      case 'clicks':
        if (drill === 'ano') values = [165000, 182000, 210000, 235000];
        else if (drill === 'mes') values = [142000, 158000, 172000, 185000, 192000, 195000, 198000, 201000, 204000, 207000, 210000, 213000];
        else values = [12000, 13500, 15000, 16500, 18000, 19500, 21000, 22500, 24000, 25500, 27000, 28500];
        break;
      case 'ctr':
        if (drill === 'ano') values = [0.32, 0.31, 0.32, 0.33];
        else if (drill === 'mes') values = [0.32, 0.33, 0.33, 0.34, 0.33, 0.33, 0.31, 0.31, 0.30, 0.30, 0.29, 0.28];
        else values = [0.30, 0.31, 0.32, 0.33, 0.32, 0.31, 0.30, 0.31, 0.32, 0.33, 0.32, 0.31];
        break;
      case 'views':
        if (drill === 'ano') values = [9800000, 11200000, 12800000, 14500000];
        else if (drill === 'mes') values = [2800000, 3100000, 3400000, 3700000, 4000000, 4200000, 4400000, 4600000, 4800000, 5000000, 5200000, 5400000];
        else values = [210000, 235000, 260000, 285000, 310000, 335000, 360000, 385000, 410000, 435000, 460000, 485000];
        break;
    }
    
    return { labels, values };
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
   * Initialize mini charts (investChart, formatChart, channelChart)
   */
  initMiniCharts() {
    // a) investChart — vertical bar chart
    const investCtx = document.getElementById('investChart');
    if (investCtx) {
      new Chart(investCtx, {
        type: 'bar',
        data: {
          labels: ['Jan', 'Fev', 'Mar'],
          datasets: [{
            data: [619427, 221798, 85189],
            backgroundColor: ['#2563EB', '#2563EB', 'rgba(37, 99, 235, 0.25)'],
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { 
              grid: { display: false },
              ticks: { font: { size: 11 } }
            },
            y: { display: false }
          }
        }
      });
    }
    
    // b) formatChart — doughnut chart with center text
    const formatCtx = document.getElementById('formatChart');
    if (formatCtx) {
      new Chart(formatCtx, {
        type: 'doughnut',
        data: {
          labels: ['Digital', 'Display', 'Vídeo'],
          datasets: [{
            data: [96.24, 2.5, 1.26],
            backgroundColor: ['#2563EB', '#7C6FF7', '#E5E7EB'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.parsed}%`
              }
            }
          }
        }
      });
    }
    
    // c) channelChart — horizontal bar chart
    const channelCtx = document.getElementById('channelChart');
    if (channelCtx) {
      new Chart(channelCtx, {
        type: 'bar',
        data: {
          labels: ['ESPN', 'Globo', 'Logan', 'SporTV'],
          datasets: [{
            data: [5.2, 3.8, 1.8, 1.2],
            backgroundColor: '#059669',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { 
              grid: { display: false },
              ticks: { font: { size: 11 } }
            },
            y: { 
              grid: { display: false },
              ticks: { font: { size: 11 } }
            }
          }
        }
      });
    }
  }
  
  /**
   * Update mini charts data based on selected year
   */
  updateMiniChartsForYear(year) {
    // Update investChart
    const investChart = Chart.getChart('investChart');
    if (investChart) {
      if (year === 2025) {
        investChart.data.datasets[0].data = [485000, 198000, 72000];
      } else {
        investChart.data.datasets[0].data = [619427, 221798, 85189];
      }
      investChart.update();
    }
    
    // Update formatChart
    const formatChart = Chart.getChart('formatChart');
    if (formatChart) {
      if (year === 2025) {
        formatChart.data.datasets[0].data = [94.5, 3.8, 1.7];
        document.querySelector('#formatChartCenter div:last-child').textContent = '94.5%';
      } else {
        formatChart.data.datasets[0].data = [96.24, 2.5, 1.26];
        document.querySelector('#formatChartCenter div:last-child').textContent = '96%';
      }
      formatChart.update();
    }
    
    // Update channelChart
    const channelChart = Chart.getChart('channelChart');
    if (channelChart) {
      if (year === 2025) {
        channelChart.data.datasets[0].data = [4.8, 3.2, 1.5, 1.0];
      } else {
        channelChart.data.datasets[0].data = [5.2, 3.8, 1.8, 1.2];
      }
      channelChart.update();
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

export default DashboardCharts;
