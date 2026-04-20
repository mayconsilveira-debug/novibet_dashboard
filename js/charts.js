/**
 * Charts Module
 * Chart.js integration for dashboard
 */

class DashboardCharts {
  constructor() {
    this.mainChart = null;
    this.colors = {
      primary: '#7C6FF7',
      primaryLight: 'rgba(124, 111, 247, 0.1)',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      grid: '#E5E7EB',
      text: '#6B7280'
    };
  }
  
  /**
   * Initialize main area chart
   */
  initMainChart(canvasId, data = null) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Default data if none provided
    const chartData = data || this.generateSampleData();
    
    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Performance',
          data: chartData.values,
          borderColor: this.colors.primary,
          backgroundColor: this.colors.primaryLight,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: this.colors.primary,
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
                return ` ${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: this.colors.text,
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
            }
          },
          y: {
            border: {
              display: false
            },
            grid: {
              color: this.colors.grid,
              drawBorder: false
            },
            ticks: {
              color: this.colors.text,
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              },
              callback: (value) => {
                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
                return value;
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
    
    return this.mainChart;
  }
  
  /**
   * Generate sample data for the chart
   */
  generateSampleData() {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const values = months.map(() => Math.floor(Math.random() * 5000000) + 1000000);
    
    return { labels: months, values };
  }
  
  /**
   * Update chart data
   */
  updateChartData(newData) {
    if (!this.mainChart) return;
    
    this.mainChart.data.labels = newData.labels;
    this.mainChart.data.datasets[0].data = newData.values;
    this.mainChart.update();
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
