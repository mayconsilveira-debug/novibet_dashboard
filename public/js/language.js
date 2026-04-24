function setLang(lang) {
  if (lang !== 'pt' && lang !== 'en') lang = 'pt';
  window.currentLang = lang;

  document.querySelectorAll('[data-pt]').forEach(el => {
    const val = el.dataset[lang];
    if (val != null) el.textContent = val;
  });

  document.querySelectorAll('[data-lang-btn]').forEach(btn => {
    const isActive = btn.dataset.langBtn === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

window.currentLang = 'pt';
