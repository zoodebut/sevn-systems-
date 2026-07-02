/* ============================================================
   SEVN SYSTEMS — script global (toutes les pages)
   ============================================================ */

/* ---- Scroll reveal ----
   Auto-tags common repeating blocks (cards, sector tiles, blog posts,
   testimonials, case rows, stats) so every page gets the fade/rise-in
   effect without needing data-reveal hardcoded everywhere. Elements
   that already carry data-reveal in the markup are respected too. */
(function () {
  var autoSelectors = '.card, .seccard, .post, .tcard, .caserow, .stat, .sysstep, .qa';
  document.querySelectorAll(autoSelectors).forEach(function (el, i) {
    if (!el.hasAttribute('data-reveal')) {
      el.setAttribute('data-reveal', '');
      el.style.transitionDelay = Math.min(i % 4, 3) * 0.08 + 's';
    }
  });

  var els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || !els.length) {
    els.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

/* ---- Animated counters: <span data-count-to="500000" data-suffix="+"> ---- */
(function () {
  var els = document.querySelectorAll('[data-count-to]');
  if (!els.length) return;
  function animate(el) {
    var target = parseFloat(el.getAttribute('data-count-to'));
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1400;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = Math.floor(eased * target);
      el.textContent = val.toLocaleString('fr-FR') + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('fr-FR') + suffix;
    }
    requestAnimationFrame(step);
  }
  if (!('IntersectionObserver' in window)) {
    els.forEach(animate);
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  els.forEach(function (el) { io.observe(el); });
})();

/* ---- FR / EN toggle ----
   Any element with data-fr="Texte FR" data-en="EN text" gets its
   textContent swapped. Language choice persists via localStorage.
   Pages that haven't been translated yet simply keep their French
   content (no data-en present = no swap), so this is safe to include
   sitewide as we translate page by page. */
(function () {
  var STORAGE_KEY = 'sevn_lang';
  function applyLang(lang) {
    document.querySelectorAll('[data-fr]').forEach(function (el) {
      var text = lang === 'en' ? (el.getAttribute('data-en') || el.getAttribute('data-fr')) : el.getAttribute('data-fr');
      if (el.hasAttribute('data-html')) el.innerHTML = text;
      else el.textContent = text;
    });
    document.querySelectorAll('[data-fr-placeholder]').forEach(function (el) {
      var ph = lang === 'en' ? (el.getAttribute('data-en-placeholder') || el.getAttribute('data-fr-placeholder')) : el.getAttribute('data-fr-placeholder');
      el.setAttribute('placeholder', ph);
    });
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('.langswitch button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }
  window.setSevnLang = applyLang;
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.langswitch button').forEach(function (b) {
      b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
    });
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'en') applyLang('en');
  });
})();
