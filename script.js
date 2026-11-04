/* ============================================================
   SEVN SYSTEMS — script global (toutes les pages)
   ============================================================ */

/* ---- Promesse de rapidité, affichée sur toutes les pages ---- */
(function () {
  if (document.querySelector('.sevn-speedbar')) return;
  var style = document.createElement('style');
  style.textContent = '.sevn-speedbar{background:#1D1D1F;color:#fff;text-align:center;padding:8px 20px;font-size:12.5px;font-weight:500;letter-spacing:.01em}.sevn-speedbar strong{color:#58A6FF;font-weight:600}.sevn-speedbar .sep{color:#68686d;margin:0 10px}.foot>.brand{display:block!important}.foot>.brand svg,.foot>.brand img{height:32px!important;width:auto!important;margin:0 0 18px!important}.foot>.brand .desc{max-width:330px!important;margin:0!important;line-height:1.65!important}@media(max-width:620px){.sevn-speedbar{font-size:11.5px;padding:8px 12px}.sevn-speedbar .optional{display:none}.sevn-speedbar .sep{margin:0 6px}}';
  document.head.appendChild(style);
  var bar = document.createElement('div');
  bar.className = 'sevn-speedbar';
  bar.innerHTML = '<span data-fr="Première version opérationnelle sous <strong>48 h</strong>" data-en="First operational version within <strong>48 hours</strong>" data-html>Première version opérationnelle sous <strong>48 h</strong></span><span class="optional"><span class="sep">•</span><span data-fr="Communication directe" data-en="Direct communication">Communication directe</span><span class="sep">•</span><span data-fr="Changements rapides" data-en="Fast changes">Changements rapides</span></span>';
  document.body.insertBefore(bar, document.body.firstChild);

  document.querySelectorAll('a[href^="mailto:"]').forEach(function (link) {
    if (link.getAttribute('href').indexOf('sevnsystems.com') !== -1) {
      link.setAttribute('href', 'mailto:contact@sevnsystems.com');
      link.textContent = 'contact@sevnsystems.com';
    }
  });

  document.querySelectorAll('footer a').forEach(function (link) {
    var label = (link.getAttribute('data-fr') || link.textContent || '').trim().toLowerCase();
    if (label.indexOf('mentions légales') !== -1) link.setAttribute('href', 'mentions-legales.html');
    if (label.indexOf('confidentialité') !== -1) link.setAttribute('href', 'confidentialite.html');
    if (label === 'cgv' || label.indexOf('conditions générales') !== -1) link.setAttribute('href', 'cgv.html');
  });

  document.querySelectorAll('form[onsubmit*="submitLead"]').forEach(function (form) {
    if (form.querySelector('.rgpd-notice')) return;
    var notice = document.createElement('p');
    notice.className = 'rgpd-notice';
    notice.style.cssText = 'font-size:11px;color:#6E6E73;line-height:1.45;margin-top:12px;text-align:left';
    notice.setAttribute('data-fr', 'ZD GROUP traite vos données pour répondre à votre demande et assurer le suivi précontractuel. Conservation maximale : 3 ans après votre dernier contact. Vous pouvez exercer vos droits à contact@sevnsystems.com. En savoir plus dans notre politique de confidentialité.');
    notice.setAttribute('data-en', 'ZD GROUP processes your data to answer your request and manage pre-contractual follow-up. Maximum retention: 3 years after your last contact. Exercise your rights at contact@sevnsystems.com. Learn more in our privacy policy.');
    notice.innerHTML = 'ZD GROUP traite vos données pour répondre à votre demande et assurer le suivi précontractuel. Conservation maximale : 3 ans après votre dernier contact. Vous pouvez exercer vos droits à <a href="mailto:contact@sevnsystems.com" style="text-decoration:underline">contact@sevnsystems.com</a>. <a href="confidentialite.html" style="text-decoration:underline">Politique de confidentialité</a>.';
    form.appendChild(notice);
  });
})();

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

/* ---- Formulaire de leads (CRM) ----
   Un seul endroit à modifier pour TOUT le site : change l'URL ou la clé
   ici, et chaque formulaire (accueil, contact, secteurs, cas clients)
   en bénéficie automatiquement, sans toucher aux fichiers HTML. */
const CRM_ENDPOINT = "https://crm.sevnsystems.com/api/leads";
const CRM_API_KEY = "530e2a9184ff92702ab4fa008d80485a5277981b7241e8ed69ef9c257ce66635";

async function submitLead(e) {
  e.preventDefault();
  const form = e.target;
  const msg = form.querySelector('#formMsg') || document.getElementById('formMsg');
  const data = Object.fromEntries(new FormData(form).entries());
  data.source = 'site';
  if (CRM_ENDPOINT) {
    try {
      await fetch(CRM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CRM_API_KEY },
        body: JSON.stringify(data)
      });
    } catch (err) { /* silencieux : le lead ne doit jamais bloquer l'UX */ }
  }
  form.style.display = 'none';
  if (msg) {
    msg.style.display = 'block';
    msg.style.color = 'var(--blue)';
    msg.style.fontSize = '15px';
    msg.textContent = 'Merci ! Un expert vous rappelle sous 24h ouvrées.';
  }
  return false;
}

/* Toutes les pages utilisent ce gestionnaire, y compris les anciennes
   pages sectorielles qui contenaient encore une configuration vide. */
var sevnLeadHandler = submitLead;
document.addEventListener('submit', function (e) {
  var form = e.target;
  if (!form || !form.matches('form[onsubmit*="submitLead"]')) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  sevnLeadHandler(e);
}, true);
