/**
 * Language Module
 * Handles PT-BR / EN language switching
 */

class LanguageManager {
  constructor() {
    this.currentLang = localStorage.getItem('dashboard-lang') || 'pt-BR';
    this.translations = {
      'pt-BR': {
        'nav-reports': 'Relatórios',
        'nav-overview': 'Overview',
        'nav-pacing': 'Pacing',
        'nav-pacing-2025': 'Pacing 2025',
        'nav-pacing-2026': 'Pacing 2026',
        'search-placeholder': 'Buscar...',
        'table-search-placeholder': 'Buscar campanha...',
        'stat-impressions': 'Impressions',
        'stat-clicks': 'Clicks',
        'stat-ctr': 'CTR',
        'stat-views': 'Complete Views',
        'chart-title': 'Performance ao longo do tempo',
        'btn-year': 'Ano',
        'btn-month': 'Mês',
        'btn-week': 'Semana',
        'table-title': 'Campanhas',
        'col-campaign': 'Campanha',
        'col-investment': 'Investimento',
        'col-impressions': 'Impressions',
        'col-clicks': 'Clicks',
        'col-ctr': 'CTR',
        'col-views': 'Views'
      },
      'en': {
        'nav-reports': 'Reports',
        'nav-overview': 'Overview',
        'nav-pacing': 'Pacing',
        'nav-pacing-2025': 'Pacing 2025',
        'nav-pacing-2026': 'Pacing 2026',
        'search-placeholder': 'Search...',
        'table-search-placeholder': 'Search campaign...',
        'stat-impressions': 'Impressions',
        'stat-clicks': 'Clicks',
        'stat-ctr': 'CTR',
        'stat-views': 'Complete Views',
        'chart-title': 'Performance over time',
        'btn-year': 'Year',
        'btn-month': 'Month',
        'btn-week': 'Week',
        'table-title': 'Campaigns',
        'col-campaign': 'Campaign',
        'col-investment': 'Investment',
        'col-impressions': 'Impressions',
        'col-clicks': 'Clicks',
        'col-ctr': 'CTR',
        'col-views': 'Views'
      }
    };
    
    this.init();
  }
  
  init() {
    this.bindEvents();
    this.applyLanguage(this.currentLang);
  }
  
  bindEvents() {
    document.querySelectorAll('[data-lang-switch]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lang = e.target.dataset.langSwitch;
        this.switchLanguage(lang);
      });
    });
  }
  
  switchLanguage(lang) {
    if (lang === this.currentLang) return;
    
    this.currentLang = lang;
    localStorage.setItem('dashboard-lang', lang);
    this.applyLanguage(lang);
    this.updateActiveButton(lang);
  }
  
  applyLanguage(lang) {
    const texts = this.translations[lang];
    if (!texts) return;
    
    // Update all elements with data-lang attribute
    document.querySelectorAll('[data-lang]').forEach(el => {
      const key = el.dataset.lang;
      if (texts[key]) {
        el.textContent = texts[key];
      }
    });
    
    // Update all elements with data-lang-placeholder attribute
    document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
      const key = el.dataset.langPlaceholder;
      if (texts[key]) {
        el.placeholder = texts[key];
      }
    });
  }
  
  updateActiveButton(lang) {
    document.querySelectorAll('[data-lang-switch]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langSwitch === lang);
      btn.classList.toggle('btn-primary', btn.dataset.langSwitch === lang);
      btn.classList.toggle('btn-secondary', btn.dataset.langSwitch !== lang);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.langManager = new LanguageManager();
});

export default LanguageManager;
