/**
 * Main Dashboard Module
 * Core functionality and interactions
 */

class Dashboard {
  constructor() {
    this.currentSort = { column: null, direction: 'asc' };
    this.statCards = [];
    this.tableData = this.generateTableData();
    
    this.init();
  }
  
  init() {
    this.initStatCards();
    this.initTable();
    this.initModal();
    this.initToast();
    this.initSearch();
    this.initDrillButtons();
    
    // Initialize charts after a short delay to ensure Chart.js is loaded
    setTimeout(() => {
      if (window.dashboardCharts) {
        window.dashboardCharts.initMainChart('mainChart');
      }
    }, 100);
  }
  
  /**
   * Initialize stat cards with click interactions
   */
  initStatCards() {
    const cards = document.querySelectorAll('.stat-card');
    
    cards.forEach((card, index) => {
      card.addEventListener('click', () => {
        // Remove active from all
        cards.forEach(c => c.classList.remove('active'));
        // Add active to clicked
        card.classList.add('active');
        
        // Update chart data based on selected metric
        this.updateChartForMetric(index);
      });
      
      // Keyboard accessibility
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
      
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
    });
    
    // Activate first card by default
    if (cards.length > 0) {
      cards[0].classList.add('active');
    }
  }
  
  /**
   * Update chart based on selected metric
   */
  updateChartForMetric(metricIndex) {
    if (!window.dashboardCharts) return;
    
    const metrics = ['impressions', 'clicks', 'ctr', 'views'];
    const metricLabels = ['Impressões', 'Cliques', 'CTR', 'Visualizações Completas'];
    const metric = metrics[metricIndex];
    
    // Update chart data and color
    window.dashboardCharts.updateChartForMetric(metric);
    
    // Update chart title
    const titleEl = document.querySelector('.chart-title');
    if (titleEl) {
      titleEl.textContent = metricLabels[metricIndex];
    }
  }
  
  /**
   * Initialize drill buttons (Ano/Mês/Semana)
   */
  initDrillButtons() {
    const buttons = document.querySelectorAll('.chart-header button');
    const drillMap = ['ano', 'mes', 'semana'];
    
    buttons.forEach((btn, index) => {
      if (index >= 3) return; // Only first 3 buttons
      
      btn.addEventListener('click', () => {
        // Update button styles
        buttons.forEach((b, i) => {
          if (i >= 3) return;
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        
        // Update chart
        if (window.dashboardCharts) {
          window.dashboardCharts.updateChartForDrill(drillMap[index]);
        }
      });
    });
    
    // Set initial active state (Mês is default)
    if (buttons[1]) {
      buttons[1].classList.remove('btn-secondary');
      buttons[1].classList.add('btn-primary');
    }
  }
  
  /**
   * Initialize data table with sorting
   */
  initTable() {
    const table = document.querySelector('.table');
    if (!table) return;
    
    const headers = table.querySelectorAll('th[data-sort]');
    
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const column = header.dataset.sort;
        this.sortTable(column, header);
      });
      
      // Add sort indicator
      header.style.cursor = 'pointer';
    });
    
    this.renderTable();
  }
  
  /**
   * Sort table by column
   */
  sortTable(column, headerElement) {
    // Toggle direction
    if (this.currentSort.column === column) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort.column = column;
      this.currentSort.direction = 'asc';
    }
    
    // Sort data
    this.tableData.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];
      
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      
      if (valA < valB) return this.currentSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return this.currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Update sort indicators
    document.querySelectorAll('th[data-sort]').forEach(th => {
      const icon = th.querySelector('.table-sort-icon');
      if (icon) icon.textContent = '';
    });
    
    const currentIcon = headerElement.querySelector('.table-sort-icon');
    if (currentIcon) {
      currentIcon.textContent = this.currentSort.direction === 'asc' ? ' ↑' : ' ↓';
    }
    
    this.renderTable();
  }
  
  /**
   * Render table rows
   */
  renderTable() {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = this.tableData.map(row => `
      <tr>
        <td><strong>${row.name}</strong></td>
        <td><span class="badge badge-blue">${this.formatCurrency(row.investimento)}</span></td>
        <td>${this.formatNumber(row.impressions)}</td>
        <td>${this.formatNumber(row.clicks)}</td>
        <td>${row.ctr}%</td>
        <td>${this.formatNumber(row.views)}</td>
      </tr>
    `).join('');
  }
  
  /**
   * Generate sample table data
   */
  generateTableData() {
    return [
      { name: 'Q1 2025', investimento: 125000, impressions: 12500000, clicks: 45000, ctr: 0.36, views: 2800000 },
      { name: 'Q2 2025', investimento: 185000, impressions: 18500000, clicks: 68000, ctr: 0.37, views: 4200000 },
      { name: 'Q3 2025', investimento: 95000, impressions: 9500000, clicks: 32000, ctr: 0.34, views: 1900000 },
      { name: 'Q4 2025', investimento: 220000, impressions: 22000000, clicks: 85000, ctr: 0.39, views: 5500000 },
      { name: 'Black Friday 2025', investimento: 350000, impressions: 45000000, clicks: 165000, ctr: 0.37, views: 9800000 },
    ];
  }
  
  /**
   * Format number with suffix
   */
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
    return num.toString();
  }
  
  /**
   * Format currency
   */
  formatCurrency(value) {
    return 'R$ ' + (value / 1000).toFixed(0) + 'k';
  }
  
  /**
   * Initialize modal functionality
   */
  initModal() {
    // Modal open buttons
    document.querySelectorAll('[data-modal-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modalOpen;
        this.openModal(modalId);
      });
    });
    
    // Modal close buttons
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });
    
    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeAllModals();
        }
      });
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }
  
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Focus first focusable element
      const focusable = modal.querySelector('button, input, select, textarea');
      if (focusable) focusable.focus();
    }
  }
  
  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
  
  /**
   * Initialize toast notifications
   */
  initToast() {
    // Toast demo button
    const toastBtn = document.getElementById('toast-demo');
    if (toastBtn) {
      toastBtn.addEventListener('click', () => {
        this.showToast('Success', 'Operation completed successfully!', 'success');
      });
    }
  }
  
  showToast(title, message, type = 'success') {
    const container = document.querySelector('.toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        }
      </svg>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Auto dismiss
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
  
  /**
   * Initialize search functionality
   */
  initSearch() {
    const searchInput = document.getElementById('table-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      this.filterTable(query);
    });
  }
  
  filterTable(query) {
    const filtered = this.tableData.filter(row => 
      row.name.toLowerCase().includes(query)
    );
    
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;
    
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="padding: var(--space-8);">
            <p class="text-muted">Nenhum resultado encontrado</p>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = filtered.map(row => `
      <tr>
        <td><strong>${row.name}</strong></td>
        <td><span class="badge badge-blue">${this.formatCurrency(row.investimento)}</span></td>
        <td>${this.formatNumber(row.impressions)}</td>
        <td>${this.formatNumber(row.clicks)}</td>
        <td>${row.ctr}%</td>
        <td>${this.formatNumber(row.views)}</td>
      </tr>
    `).join('');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});

export default Dashboard;
