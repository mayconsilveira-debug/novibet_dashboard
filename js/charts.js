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
    
    // Default 6 months data if none provided
    const chartData = data || this.generateSixMonthData();
    
    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Impressions',
            data: chartData.impressions,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#2563EB',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6
          },
          {
            label: 'Clicks',
            data: chartData.clicks,
            borderColor: '#7C6FF7',
            backgroundColor: 'rgba(124, 111, 247, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#7C6FF7',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6
          }
        ]
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
              padding: 20,
              font: {
                family: 'Plus Jakarta Sans',
                size: 12
              }
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
   * Generate 6 months mock data for Impressions and Clicks
   */
  generateSixMonthData() {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    
    // Mock data for Impressions (in millions)
    const impressions = [45.2, 48.5, 52.1, 55.8, 58.3, 60.8].map(v => v * 1000000);
    
    // Mock data for Clicks (proportional to impressions)
    const clicks = [142000, 158000, 172000, 185000, 192000, 195021];
    
    return { labels: months, impressions, clicks };
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
