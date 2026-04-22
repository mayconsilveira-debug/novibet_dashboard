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
    this.currentYear = 2026;
    
    // 2026 Data
    this.packageData2026 = [
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
    this.channelData2026 = [
      { name: 'ESPN', investimento: 841225, impressions: 41940000, clicks: 140334, ctr: 0.33, views: 9000000, children: [] },
      { name: 'Globo', investimento: 210629, impressions: 9340000, clicks: 38700, ctr: 0.41, views: 2200000, children: [] },
      { name: 'Logan', investimento: 85189, impressions: 3220000, clicks: 15987, ctr: 0.50, views: 800000, children: [] }
    ];
    this.formatData2026 = [
      { name: 'Digital', investimento: 1012000, impressions: 58600000, clicks: 187800, ctr: 0.32, views: 11600000, children: [] },
      { name: 'Display', investimento: 420000, impressions: 1500000, clicks: 5200, ctr: 0.35, views: 300000, children: [] },
      { name: 'Vídeo', investimento: 236416, impressions: 740000, clicks: 2021, ctr: 0.27, views: 100000, children: [] }
    ];
    
    // 2025 Data
    this.packageData2025 = [
      { name: 'Football 2025 – ESPN', investimento: 545000, impressions: 28500000, clicks: 87500, ctr: 0.31, views: 5400000,
        children: [
          { name: 'Pre-roll 30s', investimento: 275000, impressions: 15500000, clicks: 46500, ctr: 0.30, views: 3500000 },
          { name: 'Display Masthead', investimento: 270000, impressions: 13000000, clicks: 41000, ctr: 0.32, views: 1900000 }
        ]
      },
      { name: 'NBA/NBB 24/25 – ESPN', investimento: 198000, impressions: 8200000, clicks: 38200, ctr: 0.47, views: 2500000, children: [] },
      { name: 'Projeto 2025 – Globo', investimento: 185000, impressions: 8600000, clicks: 35200, ctr: 0.41, views: 2000000, children: [] },
      { name: 'Projeto 2025 – Logan', investimento: 72000, impressions: 2800000, clicks: 14200, ctr: 0.51, views: 700000, children: [] }
    ];
    this.channelData2025 = [
      { name: 'ESPN', investimento: 743000, impressions: 36700000, clicks: 125700, ctr: 0.34, views: 7900000, children: [] },
      { name: 'Globo', investimento: 185000, impressions: 8600000, clicks: 35200, ctr: 0.41, views: 2000000, children: [] },
      { name: 'Logan', investimento: 72000, impressions: 2800000, clicks: 14200, ctr: 0.51, views: 700000, children: [] }
    ];
    this.formatData2025 = [
      { name: 'Digital', investimento: 890000, impressions: 51200000, clicks: 167500, ctr: 0.33, views: 10200000, children: [] },
      { name: 'Display', investimento: 380000, impressions: 1350000, clicks: 4800, ctr: 0.36, views: 280000, children: [] },
      { name: 'Vídeo', investimento: 210000, impressions: 650000, clicks: 1800, ctr: 0.28, views: 85000, children: [] }
    ];
    
    // Set current data based on year
    this.packageData = this.packageData2026;
    this.channelData = this.channelData2026;
    this.formatData = this.formatData2026;
    this.tableData = this.packageData;
    
    this.init();
  }
  
  init() {
    this.initStatCards();
    this.initTable();
    this.initTableDrillButtons();
    this.initYearFilter();
    this.initPageNavigation();
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
   * Initialize year filter buttons (2025/2026)
   */
  initYearFilter() {
    const loadDataForYear = (year) => {
      this.currentYear = year;
      this.expandedRows.clear();
      
      if (year) {
        // Update data references
        this.packageData = year === 2025 ? this.packageData2025 : this.packageData2026;
        this.channelData = year === 2025 ? this.channelData2025 : this.channelData2026;
        this.formatData = year === 2025 ? this.formatData2025 : this.formatData2026;
        
        // Update current table data based on drill level
        if (this.currentDrillLevel === 'package') this.tableData = this.packageData;
        else if (this.currentDrillLevel === 'channel') this.tableData = this.channelData;
        else if (this.currentDrillLevel === 'format') this.tableData = this.formatData;
        
        // Update mini charts with year data
        if (window.dashboardCharts) {
          window.dashboardCharts.updateMiniChartsForYear(year);
        }
      }
      
      // Re-render table
      const searchInput = document.getElementById('table-search');
      if (searchInput && searchInput.value) {
        this.filterTable(searchInput.value.toLowerCase());
      } else {
        this.renderTable();
      }
    };
    
    document.querySelectorAll('.year-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isAlreadyActive = btn.classList.contains('active');
        document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
        if (!isAlreadyActive) {
          btn.classList.add('active');
          loadDataForYear(parseInt(btn.dataset.year));
        } else {
          loadDataForYear(null); // no year selected
        }
      });
    });
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
  
  /**
   * Initialize sidebar page navigation
   */
  initPageNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Switch pages
        const overviewPage = document.getElementById('page-overview');
        const pacingPage = document.getElementById('page-pacing');
        
        if (page === 'overview') {
          if (overviewPage) overviewPage.style.display = '';
          if (pacingPage) pacingPage.style.display = 'none';
        } else if (page === 'pacing-2025' || page === 'pacing-2026') {
          if (overviewPage) overviewPage.style.display = 'none';
          if (pacingPage) pacingPage.style.display = '';
          
          const year = page === 'pacing-2025' ? 2025 : 2026;
          PacingModule.init(year);
          
          // Re-render lucide icons for pacing page
          setTimeout(() => {
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }, 50);
        }
      });
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

// Pacing Module
const PacingModule = {

  mockData: {
    2025: {
      vtr: '16,02%',
      engagement: '16,37%',
      deliveryRate: 154.45,
      packages: [
        { name: 'Football 2026 – ESPN', invested: 619427, goal: 400000, impressions: 32750000, ctr: 0.30 },
        { name: 'NBA/NBB 25/26 – ESPN', invested: 221798, goal: 300000, impressions: 9190000,  ctr: 0.46 },
        { name: 'Projeto 2026 – Globo', invested: 210629, goal: 280000, impressions: 9340000,  ctr: 0.41 },
        { name: 'Projeto 2026 – Logan', invested: 85189,  goal: 120000, impressions: 3220000,  ctr: 0.50 },
      ],
      trend: {
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
        actual:   [619427, 841225, 926414, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        expected: [139035, 278070, 417105, 556140, 695175, 834210, 973245, 1112280, 1251315, 1390350, 1529385, 1668416]
      }
    },
    2026: {
      vtr: '18,50%',
      engagement: '19,20%',
      deliveryRate: 42.10,
      packages: [
        { name: 'Football 2026 – ESPN', invested: 210000, goal: 619427, impressions: 12000000, ctr: 0.28 },
        { name: 'NBA/NBB 25/26 – ESPN', invested: 80000,  goal: 221798, impressions: 3500000,  ctr: 0.40 },
        { name: 'Projeto 2026 – Globo', invested: 70000,  goal: 210629, impressions: 3000000,  ctr: 0.38 },
        { name: 'Projeto 2026 – Logan', invested: 25000,  goal: 85189,  impressions: 1000000,  ctr: 0.45 },
      ],
      trend: {
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
        actual:   [210000, 290000, 385000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        expected: [113004, 226008, 339012, 452016, 565020, 678024, 791028, 904032, 1017036, 1130040, 1243044, 1136043]
      }
    }
  },

  currentYear: 2025,

  init(year) {
    this.currentYear = year;
    const data = this.mockData[year];
    document.getElementById('pacing-title').textContent = `Pacing ${year}`;
    document.getElementById('pacing-vtr').textContent = data.vtr;
    document.getElementById('pacing-engagement').textContent = data.engagement;
    document.getElementById('pacing-gauge-value').textContent = data.deliveryRate.toFixed(2).replace('.', ',') + '%';
    this.renderGauge(data.deliveryRate);
    this.renderBars(data.packages);
    this.renderTrend(data.trend);
    this.renderTable(data.packages);
    this.updateInsight(year);
  },

  renderGauge(value) {
    const ctx = document.getElementById('pacingGauge');
    if (!ctx) return;
    if (window._pacingGaugeChart) window._pacingGaugeChart.destroy();

    // Color: green if >=90, yellow if >=60, red if <60
    const color = value >= 90 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';

    window._pacingGaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [Math.min(value, 200), Math.max(0, 200 - Math.min(value, 200))],
          backgroundColor: [color, '#F3F4F6'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: false,
        cutout: '75%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });
  },

  renderBars(packages) {
    const container = document.getElementById('pacing-bars');
    if (!container) return;
    container.innerHTML = packages.map(pkg => {
      const pct = Math.min((pkg.invested / pkg.goal) * 100, 100).toFixed(0);
      const color = pct >= 90 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--color-text-secondary); margin-bottom:4px;">
            <span>${pkg.name}</span>
            <span style="font-weight:600; color:var(--color-text-primary);">${pct}%</span>
          </div>
          <div style="height:6px; background:#F3F4F6; border-radius:999px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${color}; border-radius:999px; transition:width 0.4s ease;"></div>
          </div>
        </div>`;
    }).join('');
  },

  renderTrend(trend) {
    const ctx = document.getElementById('pacingTrendChart');
    if (!ctx) return;
    if (window._pacingTrendChart) window._pacingTrendChart.destroy();
    window._pacingTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.labels,
        datasets: [
          {
            label: 'Realizado',
            data: trend.actual,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#2563EB',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            spanGaps: false
          },
          {
            label: 'Meta esperada',
            data: trend.expected,
            borderColor: '#9CA3AF',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0,
            pointRadius: 0
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
            labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1A1D2E',
            callbacks: {
              label: ctx => ` R$ ${ctx.parsed.y.toLocaleString('pt-BR')}` 
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9CA3AF' } },
          y: {
            border: { display: false },
            grid: { color: '#F3F4F6' },
            ticks: {
              font: { size: 11 }, color: '#9CA3AF',
              callback: v => 'R$ ' + (v/1000).toFixed(0) + 'k'
            }
          }
        }
      }
    });
  },

  renderTable(packages) {
    const tbody = document.getElementById('pacing-table-body');
    if (!tbody) return;
    const rows = packages.map(pkg => {
      const rate = ((pkg.invested / pkg.goal) * 100).toFixed(1);
      const status = rate >= 90 ? 'On Track' : rate >= 60 ? 'Em risco' : 'Atrasado';
      const badgeColor = rate >= 90 ? 'badge-green' : rate >= 60 ? 'badge-yellow' : 'badge-red';
      return `<tr>
        <td><strong>${pkg.name}</strong></td>
        <td>R$ ${pkg.invested.toLocaleString('pt-BR')}</td>
        <td>R$ ${pkg.goal.toLocaleString('pt-BR')}</td>
        <td>${rate}%</td>
        <td>${(pkg.impressions/1000000).toFixed(2)}M</td>
        <td>${pkg.ctr}%</td>
        <td><span class="badge ${badgeColor}">${status}</span></td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;
  },

  updateInsight(year) {
    const insights = {
      2025: `O investimento acumulado até março representa <strong style="color:var(--color-text-primary);">154,45%</strong>
        da meta esperada para o período — ritmo acima do planejado.
        O pacote <strong style="color:var(--color-text-primary);">Football 2026 – ESPN</strong> lidera a entrega com
        R$ 619k investidos, superando a meta em 54%.
        <strong style="color:#F59E0B;">Atenção:</strong> o pacote
        <strong style="color:var(--color-text-primary);">Projeto 2026 – Logan</strong> está em risco —
        apenas 71% da meta executada. Recomenda-se revisão de alocação para os próximos meses.`,

      2026: `O investimento em 2026 está em fase inicial com <strong style="color:var(--color-text-primary);">42,10%</strong>
        da meta anual executada até março — ritmo dentro do esperado para o primeiro trimestre.
        O pacote <strong style="color:var(--color-text-primary);">Football 2026 – ESPN</strong> concentra
        54% do investimento total realizado.
        <strong style="color:#10B981;">Destaque positivo:</strong> o pacote
        <strong style="color:var(--color-text-primary);">Projeto 2026 – Logan</strong> apresenta
        o maior CTR entre os pacotes (0,45%).
        Monitorar aceleração de entrega a partir de abril para manter o pacing no prazo.`
    };

    const el = document.getElementById('insight-text');
    if (el) el.innerHTML = insights[year];
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});

export default Dashboard;
