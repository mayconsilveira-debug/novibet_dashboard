const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('sidebar-toggle');

toggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  window.dispatchEvent(new Event('resize'));
});

function showPage(pageId) {
  document.getElementById('page-overview').style.display = 'none';
  document.getElementById('page-pacing').style.display   = 'none';

  const target = document.getElementById(pageId);
  if (target) target.style.display = 'block';
}

document.querySelectorAll('.nav-item[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();

    // Update active state
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    link.classList.add('active');

    const page = link.dataset.page;

    if (page === 'overview') {
      showPage('page-overview');
    }

    if (page === 'pacing-2025') {
      showPage('page-pacing');
      if (window.PacingModule) PacingModule.init(2025);
    }

    if (page === 'pacing-2026') {
      showPage('page-pacing');
      if (window.PacingModule) PacingModule.init(2026);
    }
  });
});
