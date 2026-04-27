/**
 * Main Dashboard Module
 * Core functionality and interactions
 */

class Dashboard {
  constructor() {
    this.currentSort = { column: null, direction: 'asc' };
    this.statCards = [];

    // Ordered list of dimensions to drill through, from root to leaf.
    // e.g. ['grupo','categoria','formato'] — root rows are grouped by Grupo,
    // expanding each reveals Categoria within it, expanding again reveals
    // Formato. Must contain at least 1 dimension at all times.
    this.currentDrillPath = ['grupo'];

    // Expanded rows are keyed by their full path, e.g. "ESPN/Digital".
    this.expandedPaths = new Set();

    // No year / date filter active by default — Overview shows everything
    // (2025 + 2026 consolidated). A year is only set when the user clicks a
    // year button; a date range overrides it while active.
    this.currentYear = null;

    // Unified filter descriptor consumed by every Overview aggregation.
    // null   → no filter (consolidated view)
    // { year }                    → year-based filter
    // { dateFrom, dateTo }        → date-range filter (wins over year)
    this.currentPeriod = null;

    // Cross-filter dims set by clicking chart slices / table rows. Shape:
    // { canal: 'ESPN', formato: 'Video', ... }. Every Overview widget
    // respects these alongside currentPeriod.
    this.activeFilters = {};

    // Tree of aggregated rows, shape matches aggregateHierarchicalForYear().
    this.tableData = [];

    this.init();
  }
  
  init() {
    this.initStatCards();
    this.initTable();
    this.initTableDrillButtons();
    this.initYearFilter();
    this.initDateRangeFilter();
    this.initModal();
    this.initToast();
    this.initSearch();
    this.initDrillButtons();
    this.initActiveFiltersBar();
    // Chip labels depend on the active language.
    document.addEventListener('langchange', () => this.renderActiveFilters());

    // Initialize charts after a short delay to ensure Chart.js is loaded
    setTimeout(() => {
      if (window.dashboardCharts) {
        window.dashboardCharts.initMainChart('mainChart');
        window.dashboardCharts.initMiniCharts();
      }
    }, 100);

    // Pull real data for the default period (KPIs + table + mini charts).
    this.loadOverviewData();
  }

  /**
   * Year filter path. Pass a number to filter by that year, or null to clear
   * the year filter and revert to the consolidated (all-years) view. Always
   * clears any active date range.
   */
  async loadYearData(year) {
    this.currentYear = year;
    this.currentPeriod = year ? { year } : null;
    // Clear the date range inputs — year / consolidated takes priority.
    document.querySelectorAll('.date-input').forEach(inp => { inp.value = ''; });
    await this.loadOverviewData();
  }

  /**
   * Returns the merged period used by every Overview widget — combines the
   * currently selected year / date range with the active cross-filter dims
   * into the single period object _filterByPeriod understands.
   */
  getActivePeriod() {
    const hasDims = Object.values(this.activeFilters).some(v => v != null && v !== '');
    if (!this.currentPeriod && !hasDims) return null;
    return { ...(this.currentPeriod || {}), dims: hasDims ? { ...this.activeFilters } : undefined };
  }

  /**
   * Sets a single cross-filter dim to a value (or clears it when value is
   * null / same as current, i.e. toggle-off). Triggers a full Overview
   * re-render + chips re-render.
   */
  setFilter(dim, value) {
    if (!dim) return;
    if (value == null || this.activeFilters[dim] === value) {
      delete this.activeFilters[dim];
    } else {
      this.activeFilters[dim] = value;
    }
    this.renderActiveFilters();
    this.loadOverviewData();
    // Main chart also respects cross-filters.
    if (window.dashboardCharts) window.dashboardCharts.updateChart();
  }

  clearAllFilters() {
    this.activeFilters = {};
    this.renderActiveFilters();
    this.loadOverviewData();
    if (window.dashboardCharts) window.dashboardCharts.updateChart();
  }

  /**
   * Wire the "Limpar tudo" button once at init — its state (enabled/hidden)
   * is then driven by renderActiveFilters().
   */
  initActiveFiltersBar() {
    const clearBtn = document.getElementById('clear-all-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAllFilters());
    }
    this.renderActiveFilters();
  }

  /**
   * Paints the strip of active cross-filter chips. The bar hides itself when
   * no filter is active so it doesn't waste vertical space.
   */
  renderActiveFilters() {
    const bar  = document.getElementById('active-filters-bar');
    const list = document.getElementById('active-filters-list');
    if (!bar || !list) return;

    const DD = window.DashboardData;
    const lang = window.currentLang || 'pt';
    const labels = (DD && DD.DIM_LABELS && DD.DIM_LABELS[lang]) || {};
    const entries = Object.entries(this.activeFilters).filter(([, v]) => v != null && v !== '');

    if (!entries.length) {
      bar.classList.add('is-empty');
      list.innerHTML = '';
      return;
    }
    bar.classList.remove('is-empty');

    list.innerHTML = entries.map(([dim, value]) => {
      const label = labels[dim] || dim;
      const dimAttr = this._escapeAttr(dim);
      const valAttr = this._escapeAttr(value);
      return `
        <span class="filter-chip">
          <span class="filter-chip-dim">${label}:</span>
          <span class="filter-chip-value">${value}</span>
          <button class="filter-chip-remove" data-filter-remove="${dimAttr}" data-filter-value="${valAttr}" aria-label="Remove filter">×</button>
        </span>`;
    }).join('');

    list.querySelectorAll('[data-filter-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dim = btn.dataset.filterRemove;
        this.setFilter(dim, null);
      });
    });
  }

  /**
   * Central Overview loader — respects this.currentPeriod + activeFilters.
   * Re-renders KPIs, the hierarchical table, and the mini charts.
   */
  async loadOverviewData() {
    const DD = window.DashboardData;
    if (!DD) return;
    const period = this.getActivePeriod();
    try {
      const kpis = await DD.fetchOverviewKPIs(period);
      if (DD.renderKPIs) DD.renderKPIs(kpis);
    } catch (err) {
      console.error('[Supabase] KPI load failed:', err);
    }
    await this.loadTableData();
    if (window.dashboardCharts) {
      window.dashboardCharts.updateMiniChartsForYear(period);
    }
  }

  /**
   * Load the hierarchical table data for the currently active drill path +
   * period. Used both on year/date change and on drill-path change.
   */
  async loadTableData() {
    const DD = window.DashboardData;
    if (!DD) return;
    this.expandedPaths.clear();
    try {
      this.tableData = await DD.aggregateHierarchicalForYear(
        this.currentDrillPath,
        this.getActivePeriod()
      );
      const searchInput = document.getElementById('table-search');
      if (searchInput && searchInput.value) {
        this.filterTable(searchInput.value.toLowerCase());
      } else {
        this.renderTable();
      }
    } catch (err) {
      console.error('[Supabase] loadTableData failed:', err);
    }
  }

  /**
   * Wire up the "De" / "Até" date inputs. When either is set the period
   * switches to date-range mode and the year buttons visually deactivate;
   * clearing both inputs reverts to the currently active year, or to the
   * consolidated view if no year was selected.
   */
  initDateRangeFilter() {
    const inputs = document.querySelectorAll('.date-input');
    if (inputs.length < 2) return;
    const [fromInput, toInput] = inputs;
    const onChange = () => {
      const from = fromInput.value || null;
      const to   = toInput.value   || null;
      if (from || to) {
        this.currentPeriod = { dateFrom: from, dateTo: to };
        document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      } else {
        this.currentPeriod = this.currentYear ? { year: this.currentYear } : null;
        document.querySelectorAll('.year-btn').forEach(b => {
          b.classList.toggle('active',
            this.currentYear && parseInt(b.dataset.year) === this.currentYear);
        });
      }
      this.loadOverviewData();
    };
    fromInput.addEventListener('change', onChange);
    toInput.addEventListener('change', onChange);
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
   * Initialize table drill buttons — each [data-drill-dim] becomes a toggle
   * that appends/removes a dimension from the drill path. At least one
   * dimension must remain active at all times. Also maintains the breadcrumb
   * UI that shows the ordered path with per-chip remove buttons.
   */
  initTableDrillButtons() {
    const buttons = document.querySelectorAll('[data-drill-dim]');
    if (!buttons.length) return;

    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const dim = btn.dataset.drillDim;
        if (!dim) return;
        const idx = this.currentDrillPath.indexOf(dim);
        if (idx === -1) {
          this.currentDrillPath.push(dim);
        } else {
          if (this.currentDrillPath.length === 1) return; // keep at least one
          this.currentDrillPath.splice(idx, 1);
        }
        this.syncDrillUI();
        await this.loadTableData();
      });
    });

    // Keep breadcrumb + column label in sync when language changes.
    document.addEventListener('langchange', () => this.syncDrillUI());

    this.syncDrillUI();
  }

  /**
   * Updates button active states, the breadcrumb chips, and the column header
   * label to match this.currentDrillPath.
   */
  syncDrillUI() {
    const DD = window.DashboardData;
    const lang = window.currentLang || 'pt';
    const labels = (DD && DD.DIM_LABELS && DD.DIM_LABELS[lang]) || {};

    document.querySelectorAll('[data-drill-dim]').forEach(b => {
      const isActive = this.currentDrillPath.includes(b.dataset.drillDim);
      b.classList.toggle('btn-primary', isActive);
      b.classList.toggle('btn-secondary', !isActive);
    });

    const colLabel = document.getElementById('drill-col-label');
    if (colLabel && DD && DD.DIM_LABELS) {
      const rootDim = this.currentDrillPath[0];
      colLabel.dataset.pt = DD.DIM_LABELS.pt[rootDim] || '';
      colLabel.dataset.en = DD.DIM_LABELS.en[rootDim] || '';
      colLabel.textContent = labels[rootDim] || '';
    }

    const crumb = document.getElementById('table-drill-path');
    if (crumb) {
      const canRemove = this.currentDrillPath.length > 1;
      crumb.innerHTML = this.currentDrillPath
        .map((dim, i) => {
          const name = labels[dim] || dim;
          const sep = i > 0 ? '<span class="drill-sep">›</span>' : '';
          const remove = canRemove
            ? `<button class="drill-chip-remove" data-drill-remove="${dim}" aria-label="Remove ${name}">×</button>`
            : '';
          return `${sep}<span class="drill-chip">${name}${remove}</span>`;
        })
        .join('');
      crumb.querySelectorAll('[data-drill-remove]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const dim = btn.dataset.drillRemove;
          if (this.currentDrillPath.length <= 1) return;
          this.currentDrillPath = this.currentDrillPath.filter(d => d !== dim);
          this.syncDrillUI();
          await this.loadTableData();
        });
      });
    }
  }
  
  /**
   * Initialize year filter buttons (2025/2026).
   * Behaviour:
   *  - Click an inactive year → becomes the active filter (mutually exclusive).
   *  - Click the already-active year → deactivates it, reverting Overview to
   *    the consolidated (all-years) view.
   */
  initYearFilter() {
    document.querySelectorAll('.year-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('active');
        document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
        if (wasActive) {
          this.loadYearData(null);
        } else {
          btn.classList.add('active');
          this.loadYearData(parseInt(btn.dataset.year));
        }
      });
    });
  }
  
  /**
   * Render the hierarchical table. Each row's indentation reflects its depth
   * in the drill path; expandable rows show a ▸/▾ toggle that drills one
   * level deeper using the next dimension. Totals are summed from the
   * top-level rows only (subtotals of root groups already = top-level sums).
   */
  renderTable(data = null) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    const rows = data || this.tableData;
    const chunks = [];
    let totalInvest = 0, totalImp = 0, totalClicks = 0, totalViews = 0;

    const walk = (nodes, depth, parentPath) => {
      for (const node of nodes) {
        if (depth === 0) {
          totalInvest += node.investimento;
          totalImp    += node.impressions;
          totalClicks += node.clicks;
          totalViews  += node.views;
        }
        const path = parentPath ? `${parentPath}/${node.name}` : String(node.name);
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded  = hasChildren && this.expandedPaths.has(path);
        const toggle = hasChildren
          ? `<button class="drill-toggle" aria-label="Toggle">${isExpanded ? '▾' : '▸'}</button>`
          : `<span class="drill-toggle-spacer"></span>`;
        const indentPx = depth * 20;
        const rowClass = depth === 0 ? '' : `child-row depth-${depth}`;

        chunks.push(`
          <tr data-path="${this._escapeAttr(path)}" class="${rowClass}">
            <td style="padding-left:${indentPx}px;">
              ${toggle}
              <strong>${node.name}</strong>
            </td>
            <td><span class="badge badge-blue">${this.formatCurrency(node.investimento)}</span></td>
            <td>${this.formatNumber(node.impressions)}</td>
            <td>${this.formatNumber(node.clicks)}</td>
            <td>${node.ctr.toFixed(2)}%</td>
            <td>${this.formatNumber(node.views)}</td>
          </tr>
        `);

        if (isExpanded) walk(node.children, depth + 1, path);
      }
    };

    walk(rows, 0, '');

    const avgCtr = totalImp > 0 ? (totalClicks / totalImp) * 100 : 0;
    chunks.push(`
      <tr style="font-weight:600;border-top:2px solid var(--color-border);">
        <td>Total</td>
        <td><span class="badge badge-blue">${this.formatCurrency(totalInvest)}</span></td>
        <td>${this.formatNumber(totalImp)}</td>
        <td>${this.formatNumber(totalClicks)}</td>
        <td>${avgCtr.toFixed(2)}%</td>
        <td>${this.formatNumber(totalViews)}</td>
      </tr>
    `);

    tbody.innerHTML = chunks.join('');

    tbody.querySelectorAll('.drill-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const path = e.target.closest('tr').dataset.path;
        if (!path) return;
        if (this.expandedPaths.has(path)) this.expandedPaths.delete(path);
        else this.expandedPaths.add(path);

        const searchInput = document.getElementById('table-search');
        if (searchInput && searchInput.value) {
          this.filterTable(searchInput.value.toLowerCase());
        } else {
          this.renderTable();
        }
      });
    });
  }

  _escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
    // Search only matches root-level names. Sub-nodes (children) inside each
    // matched root are preserved untouched so the expanded hierarchy still
    // works on filtered results.
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

    this.renderTable(filtered);
  }
}

// Pacing Module
const PacingModule = {

  currentYear: 2025,
  // The drill is a period filter for the entire page (cards + trend chart):
  //   year    — full year of the selected pacing page
  //   quarter — latest active quarter of that year
  //   month   — latest active month of that year
  currentDrill: 'year',
  _drillBound: false,
  _langBound: false,
  _lastData: null,

  async init(year) {
    this.currentYear = year;
    this.initDrillButtons();
    this.initLangListener();
    await this.loadData();
  },

  // Fetches + renders both cards and trend, respecting currentYear + currentDrill.
  // Called by init() and by the drill button handler (so switching drill
  // refreshes the whole page, not just the chart).
  async loadData() {
    const title = document.getElementById('pacing-title');
    const lang = window.currentLang || 'pt';
    const year = this.currentYear;
    const loadingText = lang === 'en'
      ? `Pacing ${year} — loading…`
      : `Pacing ${year} — carregando…`;
    if (title) title.textContent = loadingText;

    let data;
    try {
      data = await window.DashboardData.computePacingForYear(year, {
        lang,
        drill: this.currentDrill
      });
    } catch (err) {
      console.error('[Pacing] load failed:', err);
      if (title) {
        title.textContent = lang === 'en'
          ? `Pacing ${year} — load failed`
          : `Pacing ${year} — erro ao carregar`;
      }
      return;
    }

    this._lastData = data;
    if (title) title.textContent = `Pacing ${year}`;

    this.renderChannelCards(data.channels);
    this.renderTrend(data.trend);
    lucide.createIcons();
  },

  initLangListener() {
    if (this._langBound) return;
    document.addEventListener('langchange', (e) => {
      const lang = (e.detail && e.detail.lang) || 'pt';
      this.refreshInsightsForLang(lang);
    });
    this._langBound = true;
  },

  refreshInsightsForLang(lang) {
    if (!this._lastData) return;
    const DD = window.DashboardData;
    if (!DD) return;
    const data = this._lastData;
    // Regenerate insights without refetching data — delivery rates were
    // stashed on each channel as `_deliveryRate` for exactly this path.
    data.channels.forEach(ch => {
      const dr = ch._deliveryRate != null ? ch._deliveryRate : 0;
      ch.insight = DD.channelInsight(ch.grupo, dr, ch._vtrRaw, ch._engRaw, lang);
    });
    // Re-render the top-level KPI cards (insight lives in their footer).
    this.renderChannelCards(data.channels);
    lucide.createIcons();
  },

  initDrillButtons() {
    if (this._drillBound) return;
    const buttons = document.querySelectorAll('[data-pacing-drill]');
    if (!buttons.length) return;
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const drill = btn.dataset.pacingDrill;
        if (drill === this.currentDrill) return;
        this.currentDrill = drill;
        buttons.forEach(b => {
          const isActive = b.dataset.pacingDrill === drill;
          b.classList.toggle('btn-primary', isActive);
          b.classList.toggle('btn-secondary', !isActive);
        });
        // Drill now filters the whole page — reload cards + trend together.
        this.loadData();
      });
    });
    // Sync initial visual state with this.currentDrill.
    buttons.forEach(b => {
      const isActive = b.dataset.pacingDrill === this.currentDrill;
      b.classList.toggle('btn-primary', isActive);
      b.classList.toggle('btn-secondary', !isActive);
    });
    this._drillBound = true;
  },

  /**
   * Render one KPI card per channel at the top of the Pacing page. Each card
   * shows VTR, Engagement, a semicircle gauge with Delivery Rate in the
   * middle, and a footer insight bar. Gauge Chart instances are tracked so
   * they can be destroyed before re-rendering.
   */
  renderChannelCards(channels) {
    const container = document.getElementById('pacing-channel-cards');
    if (!container) return;

    // Clean up any previously mounted gauge charts.
    if (this._channelGauges) this._channelGauges.forEach(c => { try { c.destroy(); } catch (_) {} });
    this._channelGauges = [];

    if (!channels || !channels.length) {
      container.innerHTML = '';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'pacing-channel-grid';

    channels.forEach((ch, idx) => {
      const canvasId = `pacingGauge-ch-${idx}`;
      const dr = ch._deliveryRate != null ? ch._deliveryRate : 0;
      const drText = dr.toFixed(1).replace('.', ',') + '%';
      const fmtNum = (n) => Math.round(n || 0).toLocaleString('pt-BR');

      // Packages of this group by delivered impressions (desc) — each row
      // shows the delivered value with a proportional bar against the group's
      // goal so users can read how much of the goal each package has already
      // covered. Capped at top 5 to keep the card compact. Packages with zero
      // delivered impressions are hidden from the list (they come from the
      // pacing/goals table without a matching actuals row, e.g. goals set but
      // delivery hasn't started yet) — their goal is still counted in
      // estimateTotal so the contracted total remains correct.
      const sortedPkgs = [...(ch.packages || [])]
        .filter(p => (p.impressions || 0) > 0)
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
      const topPkgs = sortedPkgs.slice(0, 5);
      const goalBase = ch.estimateTotal || topPkgs.reduce((m, p) => Math.max(m, p.impressions || 0), 0);

      const estItemsHtml = topPkgs.map(p => {
        const pct = goalBase > 0 ? Math.min(100, ((p.impressions || 0) / goalBase) * 100) : 0;
        return `
          <div class="pc-estimate-item">
            <span class="pc-estimate-item-fill" style="width:${pct}%;"></span>
            <span class="pc-estimate-item-name">${p.name}</span>
            <span class="pc-estimate-item-value">${fmtNum(p.impressions)}</span>
          </div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'card pacing-channel-card';
      card.innerHTML = `
        <div class="pc-body">
          <h3 class="pc-name">${ch.grupo}</h3>
          <div class="pc-kpi">
            <span class="pc-kpi-value">${ch.vtr}</span>
            <span class="pc-kpi-label" data-pt="VTR" data-en="VTR">VTR</span>
          </div>
          <div class="pc-kpi">
            <span class="pc-kpi-value">${ch.engagement}</span>
            <span class="pc-kpi-label" data-pt="Engajamento" data-en="Engagement">Engajamento</span>
          </div>
          <div class="pc-gauge">
            <span class="pc-gauge-label" data-pt="Delivery Rate" data-en="Delivery Rate">Delivery Rate</span>
            <canvas id="${canvasId}" width="200" height="110" aria-label="Delivery rate gauge"></canvas>
            <span class="pc-gauge-value">${drText}</span>
          </div>
          <div class="pc-estimate">
            <div class="pc-estimate-header">
              <span class="pc-estimate-label" data-pt="Estimate" data-en="Estimate">Estimate</span>
              <div class="pc-estimate-total">${fmtNum(ch.estimateTotal)}</div>
            </div>
            <div class="pc-estimate-items">${estItemsHtml}</div>
          </div>
        </div>
        <div class="pc-footer">
          <div class="pc-insight-icon"><i data-lucide="sparkles"></i></div>
          <div class="pc-insight-text">${ch.insight || ''}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);

    // Mount the gauges only after the canvases are in the DOM.
    channels.forEach((ch, idx) => {
      const dr = ch._deliveryRate != null ? ch._deliveryRate : 0;
      const chart = this.renderGaugeCanvas(`pacingGauge-ch-${idx}`, dr);
      if (chart) this._channelGauges.push(chart);
    });
  },

  /**
   * Standalone semicircle gauge renderer — pass the canvas id and a
   * delivery-rate number. Returns the Chart instance so the caller can
   * destroy it later.
   */
  renderGaugeCanvas(canvasId, value) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const color = value >= 90 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';
    // Scale tops out at 100%. Values above 100% keep the arc fully filled
    // (and green via the color threshold above); only the center label
    // reflects the real percentage.
    const capped = Math.min(Math.max(value, 0), 100);
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [capped, 100 - capped],
          backgroundColor: [color, 'rgba(156,163,175,0.15)'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 600 }
      }
    });
  },

  renderChannels(channels) {
    const container = document.getElementById('pacing-channels');
    if (!container) return;
    container.innerHTML = '';

    channels.forEach(ch => {
      const totalImpr = ch.packages.reduce((s, p) => s + (p.impressions || 0), 0);
      const totalGoal = ch.packages.reduce((s, p) => s + (p.goal || 0), 0);
      const deliveryRate = totalGoal > 0
        ? ((totalImpr / totalGoal) * 100).toFixed(1)
        : '0.0';
      const estFmt = ch.estimateTotal >= 1000000
        ? (ch.estimateTotal / 1000000).toFixed(1) + 'Mi'
        : (ch.estimateTotal / 1000).toFixed(0) + 'k';
      const drColor = deliveryRate >= 90 ? 'var(--color-success)'
                    : deliveryRate >= 60 ? 'var(--color-warning)'
                    : 'var(--color-danger)';

      const section = document.createElement('div');
      section.style.marginBottom = 'var(--space-6)';
      section.innerHTML = `
        <!-- Channel header -->
        <div style="display:flex;align-items:center;gap:var(--space-3);
          margin-bottom:var(--space-3);">
          <h3 style="font-size:14px;font-weight:600;
            color:var(--color-text-primary);margin:0;">${ch.canal}</h3>
          <div style="display:flex;gap:var(--space-3);">
            <span style="font-size:11px;color:var(--color-text-muted);">
              VTR <strong style="color:var(--color-text-primary);">
                ${ch.vtr}
              </strong>
            </span>
            <span style="font-size:11px;color:var(--color-text-muted);">
              Engajamento <strong style="color:var(--color-text-primary);">
                ${ch.engagement}
              </strong>
            </span>
            <span style="font-size:11px;color:var(--color-text-muted);">
              Estimate <strong style="color:var(--color-text-primary);">
                ${estFmt}
              </strong>
            </span>
            <span style="font-size:11px;color:var(--color-text-muted);">
              Delivery <strong style="color:${drColor};">
                ${deliveryRate}%
              </strong>
            </span>
          </div>
        </div>

        <!-- Package rows -->
        <div class="card" style="margin-bottom:var(--space-3);">
          <div class="card-body" style="padding:0;">
            <table class="table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Pacote</th>
                  <th>Investimento</th>
                  <th>Meta</th>
                  <th>Delivery</th>
                  <th>Impressões</th>
                  <th>CTR</th>
                  <th>VTR</th>
                  <th>Engajamento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${ch.packages.map(pkg => {
                  const rate = pkg.goal > 0
                    ? ((pkg.impressions / pkg.goal) * 100).toFixed(1)
                    : '0.0';
                  const status = rate >= 90 ? 'On Track'
                               : rate >= 60 ? 'Em risco' : 'Atrasado';
                  const badgeStyle = rate >= 90
                    ? 'background:var(--color-success-light);color:var(--color-success);'
                    : rate >= 60
                    ? 'background:var(--color-warning-light);color:var(--color-warning);'
                    : 'background:var(--color-danger-light);color:var(--color-danger);';
                  return `<tr>
                    <td><strong>${pkg.name}</strong></td>
                    <td>R$ ${pkg.invested.toLocaleString('pt-BR')}</td>
                    <td>${pkg.goal.toLocaleString('pt-BR')}</td>
                    <td style="font-weight:600;">${rate}%</td>
                    <td>${pkg.impressions.toLocaleString('pt-BR')}</td>
                    <td>${pkg.ctr.toFixed(2).replace('.', ',')}%</td>
                    <td>${pkg.vtr.toFixed(2).replace('.', ',')}%</td>
                    <td>${pkg.engagement.toFixed(2).replace('.', ',')}%</td>
                    <td>
                      <span class="badge" style="${badgeStyle}padding:3px 8px;
                        border-radius:var(--radius-sm);">
                        ${status}
                      </span>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Channel insight -->
        <div class="card" style="margin-bottom:var(--space-2);">
          <div class="card-body" style="display:flex;gap:var(--space-3);
            align-items:flex-start;padding:var(--space-4);">
            <div style="width:30px;height:30px;border-radius:var(--radius-md);
              background:var(--color-accent-light);display:flex;
              align-items:center;justify-content:center;flex-shrink:0;">
              <i data-lucide="sparkles"
                style="width:14px;height:14px;
                color:var(--color-accent);"></i>
            </div>
            <div>
              <div style="font-size:12px;font-weight:600;
                color:var(--color-text-primary);margin-bottom:4px;">
                Análise — ${ch.canal}
              </div>
              <p style="font-size:12px;color:var(--color-text-secondary);
                line-height:1.6;margin:0;">${ch.insight}</p>
            </div>
          </div>
        </div>`;

      container.appendChild(section);
    });
  },

  renderTrend(trend) {
    const ctx = document.getElementById('pacingTrendChart');
    if (!ctx) return;

    // Populate the comparative totals strip in the chart header: actual
    // delivered, expected goal, and the delta as a % of goal. Numbers reflect
    // the currently active drill period (year / quarter / month).
    const expectedTotal = trend.expectedTotal != null
      ? trend.expectedTotal
      : (trend.expected && trend.expected.length
          ? trend.expected[trend.expected.length - 1]
          : 0);
    const actualTotal = trend.actualTotal != null ? trend.actualTotal : 0;
    const fmtBR = (n) => Math.round(n || 0).toLocaleString('pt-BR');

    const actualEl   = document.getElementById('pacing-actual-total-value');
    const expectedEl = document.getElementById('pacing-meta-total-value');
    const deltaEl    = document.getElementById('pacing-delta-value');
    if (actualEl)   actualEl.textContent   = fmtBR(actualTotal);
    if (expectedEl) expectedEl.textContent = fmtBR(expectedTotal);
    if (deltaEl) {
      if (expectedTotal > 0) {
        const pct = (actualTotal / expectedTotal) * 100;
        deltaEl.textContent = pct.toFixed(1).replace('.', ',') + '%';
        // Green if on/above pace, amber if within 10pp, red otherwise.
        deltaEl.style.color = pct >= 95
          ? 'var(--color-success)'
          : pct >= 80
          ? 'var(--color-warning)'
          : 'var(--color-danger)';
      } else {
        deltaEl.textContent = '—';
        deltaEl.style.color = '';
      }
    }

    // Abbreviated formatter for the data-labels that sit above each point on
    // the "Realizado" line. Local to this function so it doesn't depend on
    // the (non-exported) helpers in charts.js.
    const fmtAbbrev = (n) => {
      const abs = Math.abs(n || 0);
      if (abs >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + 'B';
      if (abs >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + 'M';
      if (abs >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + 'k';
      return String(Math.round(n));
    };

    // Plugin: writes an abbreviated absolute value above each point of the
    // first dataset (Realizado). The meta-line is intentionally left
    // un-annotated since its total is shown in the header.
    const realizadoValueLabels = {
      id: 'realizadoValueLabels',
      afterDatasetsDraw(chart) {
        const ctx2 = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;
        const data = chart.data.datasets[0].data || [];
        ctx2.save();
        ctx2.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx2.fillStyle = '#2563EB';
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'bottom';
        meta.data.forEach((point, i) => {
          const value = data[i];
          if (!value || value <= 0) return;
          ctx2.fillText(fmtAbbrev(value), point.x, point.y - 8);
        });
        ctx2.restore();
      }
    };

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
            borderWidth: 2, fill: true, tension: 0.4,
            pointRadius: 4, pointBackgroundColor: '#2563EB',
            pointBorderColor: '#fff', pointBorderWidth: 2,
            spanGaps: false
          },
          {
            label: 'Meta esperada',
            data: trend.expected,
            borderColor: '#9CA3AF', borderWidth: 2,
            borderDash: [6, 4], fill: false, tension: 0,
            pointRadius: 0
          }
        ]
      },
      plugins: [realizadoValueLabels],
      options: {
        responsive: true, maintainAspectRatio: false,
        // Extra top padding so the value label above the tallest point
        // doesn't clip against the chart edge.
        layout: { padding: { top: 18 } },
        plugins: {
          legend: {
            display: true, position: 'top', align: 'end',
            labels: { usePointStyle: true, pointStyle: 'circle',
              padding: 16, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1A1D2E',
            callbacks: {
              label: c => ` ${c.parsed.y.toLocaleString('pt-BR')} impressões`
            }
          }
        },
        scales: {
          x: { grid: { display: false },
               ticks: { font: { size: 11 }, color: '#9CA3AF' } },
          y: { border: { display: false }, grid: { color: '#F3F4F6' },
               ticks: { font: { size: 11 }, color: '#9CA3AF',
                 callback: v => {
                   if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
                   if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k';
                   return v;
                 } } }
        }
      }
    });
  },

  renderTable(channels) {
    const tbody = document.getElementById('pacing-table-body');
    if (!tbody) return;
    tbody.innerHTML = channels.flatMap(ch =>
      ch.packages.map(pkg => {
        const rate = pkg.goal > 0
          ? ((pkg.impressions / pkg.goal) * 100).toFixed(1)
          : '0.0';
        const status = rate >= 90 ? 'On Track'
                     : rate >= 60 ? 'Em risco' : 'Atrasado';
        const badgeStyle = rate >= 90
          ? 'background:var(--color-success-light);color:var(--color-success);'
          : rate >= 60
          ? 'background:var(--color-warning-light);color:var(--color-warning);'
          : 'background:var(--color-danger-light);color:var(--color-danger);';
        return `<tr>
          <td>${ch.canal}</td>
          <td><strong>${pkg.name}</strong></td>
          <td>R$ ${pkg.invested.toLocaleString('pt-BR')}</td>
          <td>${pkg.goal.toLocaleString('pt-BR')}</td>
          <td style="font-weight:600;">${rate}%</td>
          <td>${pkg.impressions.toLocaleString('pt-BR')}</td>
          <td>${pkg.ctr.toFixed(2).replace('.', ',')}%</td>
          <td>${pkg.vtr.toFixed(2).replace('.', ',')}%</td>
          <td>${pkg.engagement.toFixed(2).replace('.', ',')}%</td>
          <td>
            <span class="badge" style="${badgeStyle}padding:3px 8px;
              border-radius:var(--radius-sm);">${status}</span>
          </td>
        </tr>`;
      })
    ).join('');
  }
};

window.PacingModule = PacingModule;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});
