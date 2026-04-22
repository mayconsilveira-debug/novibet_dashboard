/**
 * Main Dashboard Module
 * Core functionality and interactions
 */

class Dashboard {
  constructor() {
    this.currentSort = { column: null, direction: 'asc' };
    this.statCards = [];
    this.expandedRows = new Set();
    this.currentDrillLevel = 'package';
    this.packageData = [
      { name: 'Football 2026 – ESPN', investimento: 619427, impressions: 32750000, clicks: 98234, ctr: 0.30, views: 6200000,
        children: [
          { name: 'Pre-roll 30s', investimento: 310000, impressions: 18000000, clicks: 52000, ctr: 0.29, views: 4100000 },
          { name: 'Display Masthead', investimento: 309427, impressions: 14750000, clicks: 46234, ctr: 0.31, views: 2100000 }
        ]
      },
      { name: 'NBA/NBB 25/26 – ESPN', investimento: 221798, impressions: 9190000, clicks: 42100, ctr: 0.46, views: 2800000, children: [] },
      { name: 'Projeto 2026 – Globo', investimento: 210629, impressions: 9340000, clicks: 38700, ctr: 0.41, views: 2200000, children: [] },
      { name: 'Projeto 2026 – Logan', investimento: 85189, impressions: 3220000, clicks: 15987, ctr: 0.50, views: 800000, children: [] }
    ];
    this.channelData = [
      { name: 'ESPN', investimento: 841225, impressions: 41940000, clicks: 140334, ctr: 0.33, views: 9000000, children: [] },
      { name: 'Globo', investimento: 210629, impressions: 9340000, clicks: 38700, ctr: 0.41, views: 2200000, children: [] },
      { name: 'Logan', investimento: 85189, impressions: 3220000, clicks: 15987, ctr: 0.50, views: 800000, children: [] }
    ];
    this.formatData = [
      { name: 'Digital', investimento: 1012000, impressions: 58600000, clicks: 187800, ctr: 0.32, views: 11600000, children: [] },
      { name: 'Display', investimento: 420000, impressions: 1500000, clicks: 5200, ctr: 0.35, views: 300000, children: [] },
      { name: 'Vídeo', investimento: 236416, impressions: 740000, clicks: 2021, ctr: 0.27, views: 100000, children: [] }
    ];
    this.tableData = this.packageData;
    
    this.init();
  }
  
  init() {
    this.initStatCards();
    this.initTable();
    this.initTableDrillButtons();
    this.initModal();
    this.initToast();
    this.initSearch();
    this.initDrillButtons();
    
    // Initialize charts after a short delay to ensure Chart.js is loaded
    setTimeout(() => {
      if (window.dashboardCharts) {
        window.dashboardCharts.initMainChart('mainChart');
        window.dashboardCharts.initMiniCharts();
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
   * Initialize table drill buttons (Pacote/Canal/Formato)
   */
  initTableDrillButtons() {
    const drillButtons = {
      package: document.getElementById('drill-package'),
      channel: document.getElementById('drill-channel'),
      format: document.getElementById('drill-format')
    };
    const colLabel = document.getElementById('drill-col-label');
    
    const setActive = (level) => {
      this.currentDrillLevel = level;
      this.expandedRows.clear();
      
      // Update button styles
      Object.keys(drillButtons).forEach(key => {
        const btn = drillButtons[key];
        if (btn) {
          btn.classList.remove('btn-primary', 'btn-secondary');
          btn.classList.add(key === level ? 'btn-primary' : 'btn-secondary');
        }
      });
      
      // Update data
      if (level === 'package') this.tableData = this.packageData;
      else if (level === 'channel') this.tableData = this.channelData;
      else if (level === 'format') this.tableData = this.formatData;
      
      // Update column label
      if (colLabel) {
        const labels = { package: 'Pacote', channel: 'Canal', format: 'Formato' };
        colLabel.textContent = labels[level];
        colLabel.dataset.pt = labels[level];
        colLabel.dataset.en = level === 'package' ? 'Package' : level === 'channel' ? 'Channel' : 'Format';
      }
      
      // Re-apply search filter if exists
      const searchInput = document.getElementById('table-search');
      if (searchInput && searchInput.value) {
        this.filterTable(searchInput.value.toLowerCase());
      } else {
        this.renderTable();
      }
    };
    
    drillButtons.package?.addEventListener('click', () => setActive('package'));
    drillButtons.channel?.addEventListener('click', () => setActive('channel'));
    drillButtons.format?.addEventListener('click', () => setActive('format'));
  }
  
  /**
   * Render table rows with expandable children
   */
  renderTable(data = null) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;
    
    const rows = data || this.tableData;
    let html = '';
    let totalInvest = 0, totalImp = 0, totalClicks = 0, totalViews = 0;
    
    rows.forEach((row, index) => {
      totalInvest += row.investimento;
      totalImp += row.impressions;
      totalClicks += row.clicks;
      totalViews += row.views;
      
      const hasChildren = row.children && row.children.length > 0;
      const isExpanded = this.expandedRows.has(index);
      const toggleIcon = hasChildren ? (isExpanded ? '▾' : '▸') : '';
      
      html += `
        <tr data-row-index="${index}">
          <td>
            ${hasChildren ? `<button class="drill-toggle" style="background:none;border:none;cursor:pointer;padding:0 4px 0 0;font-size:12px;">${toggleIcon}</button>` : '<span style="padding:0 16px 0 0;"></span>'}
            <strong>${row.name}</strong>
          </td>
          <td><span class="badge badge-blue">${this.formatCurrency(row.investimento)}</span></td>
          <td>${this.formatNumber(row.impressions)}</td>
          <td>${this.formatNumber(row.clicks)}</td>
          <td>${row.ctr.toFixed(2)}%</td>
          <td>${this.formatNumber(row.views)}</td>
        </tr>
      `;
      
      // Render children if expanded
      if (isExpanded && hasChildren) {
        row.children.forEach(child => {
          html += `
            <tr class="child-row" style="background:#f8fafc;">
              <td style="padding-left: 32px; color: var(--color-text-muted);">${child.name}</td>
              <td><span class="badge badge-blue">${this.formatCurrency(child.investimento)}</span></td>
              <td>${this.formatNumber(child.impressions)}</td>
              <td>${this.formatNumber(child.clicks)}</td>
              <td>${child.ctr.toFixed(2)}%</td>
              <td>${this.formatNumber(child.views)}</td>
            </tr>
          `;
        });
      }
    });
    
    // Totals row
    const avgCtr = totalClicks / totalImp * 100;
    html += `
      <tr style="font-weight: 600; border-top: 2px solid var(--color-border);">
        <td>Total</td>
        <td><span class="badge badge-blue">${this.formatCurrency(totalInvest)}</span></td>
        <td>${this.formatNumber(totalImp)}</td>
        <td>${this.formatNumber(totalClicks)}</td>
        <td>${avgCtr.toFixed(2)}%</td>
        <td>${this.formatNumber(totalViews)}</td>
      </tr>
    `;
    
    tbody.innerHTML = html;
    
    // Bind toggle click handlers
    tbody.querySelectorAll('.drill-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rowIndex = parseInt(e.target.closest('tr').dataset.rowIndex);
        if (this.expandedRows.has(rowIndex)) {
          this.expandedRows.delete(rowIndex);
        } else {
          this.expandedRows.add(rowIndex);
        }
        
        const searchInput = document.getElementById('table-search');
        if (searchInput && searchInput.value) {
          this.filterTable(searchInput.value.toLowerCase());
        } else {
          this.renderTable();
        }
      });
    });
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
    
    if (filtered.length === 0) {
      const tbody = document.querySelector('.table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center" style="padding: var(--space-8);">
              <p class="text-muted">Nenhum resultado encontrado</p>
            </td>
          </tr>
        `;
      }
      return;
    }
    
    // Use renderTable with filtered data but reset row indices for display
    this.renderTable(filtered.map((row, idx) => ({...row, _origIndex: idx})));
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});

export default Dashboard;
