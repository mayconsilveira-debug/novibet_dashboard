/**
 * Sidebar Module
 * Handles sidebar collapse/expand functionality
 */

class Sidebar {
  constructor() {
    this.sidebar = document.querySelector('.sidebar');
    this.toggleBtn = document.querySelector('.sidebar-toggle');
    this.mainContent = document.querySelector('.main-content');
    this.isCollapsed = false;
    
    this.init();
  }
  
  init() {
    if (!this.toggleBtn || !this.sidebar) return;
    
    // Load saved state
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState === 'true') {
      this.collapse();
    }
    
    // Event listeners
    this.toggleBtn.addEventListener('click', () => this.toggle());
    
    // Keyboard navigation
    this.toggleBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });
    
    // Mobile: auto-collapse on small screens
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }
  
  toggle() {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.collapse();
    } else {
      this.expand();
    }
    
    // Save state
    localStorage.setItem('sidebar-collapsed', this.isCollapsed);
  }
  
  collapse() {
    this.sidebar.classList.add('sidebar-collapsed');
    if (this.mainContent) {
      this.mainContent.classList.add('sidebar-collapsed');
    }
    this.toggleBtn.setAttribute('aria-expanded', 'false');
    this.isCollapsed = true;
  }
  
  expand() {
    this.sidebar.classList.remove('sidebar-collapsed');
    if (this.mainContent) {
      this.mainContent.classList.remove('sidebar-collapsed');
    }
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    this.isCollapsed = false;
  }
  
  handleResize() {
    if (window.innerWidth <= 768) {
      this.collapse();
    } else {
      // Restore saved state on desktop
      const savedState = localStorage.getItem('sidebar-collapsed');
      if (savedState !== 'true') {
        this.expand();
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Sidebar();
});

export default Sidebar;
