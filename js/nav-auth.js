/* ============================================
   NAIJLEARN — Shared Nav Auth
   js/nav-auth.js
   ============================================ */

(function () {
  /* ── helpers ── */
  function isInPagesDir() {
    var p = window.location.pathname;
    return p.indexOf('/pages/') !== -1;
  }

  function resolveHref(path) {
    return isInPagesDir() ? '../' + path : path;
  }

  /* Returns the current page filename e.g. "admin.html", "browse.html" */
  function currentPage() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'index.html';
  }

  /* Hide any nav link whose href ends with the given filename */
  function hideNavLinkFor(filename) {
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    var anchors = navLinks.querySelectorAll('a');
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href') || '';
      if (href.split('/').pop() === filename || href.split('?')[0].split('/').pop() === filename) {
        anchors[i].style.display = 'none';
      }
    }
  }

  /* After any nav change, hide the link that matches the current page */
  function suppressCurrentPageLink() {
    var page = currentPage();
    hideNavLinkFor(page);
  }

  /* ── inject / remove the Dashboard nav link ── */
  function ensureDashLink(show, href) {
    var existing = document.getElementById('nl-dash-link');
    var navLinks  = document.querySelector('.nav-links');
    if (!navLinks) return;

    if (!show) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      existing = document.createElement('a');
      existing.id = 'nl-dash-link';
      existing.style.cssText = 'font-weight:700;color:var(--sage)';
      var btn = navLinks.querySelector('.btn-nav');
      navLinks.insertBefore(existing, btn || null);
    }
    existing.textContent = 'Dashboard';
    existing.href = href;
    existing.title = 'View your uploads, saved resources and account settings';

    // If we're on the dashboard page, hide this link
    if (currentPage() === 'dashboard.html') {
      existing.style.display = 'none';
    }
  }

  /* ── inject / remove the Admin nav link (admin users only) ── */
  function ensureAdminLink(show) {
    // Never show Admin link when already on the admin page
    if (window._nlSuppressAdminLink) return;
    var existing = document.getElementById('nl-nav-admin-link');
    var navLinks  = document.querySelector('.nav-links');
    if (!navLinks) return;

    if (!show) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      existing = document.createElement('a');
      existing.id = 'nl-nav-admin-link';
      existing.style.cssText = 'font-weight:700;color:var(--gold,#C8882A)';
      existing.title = 'Admin Panel';
      var btn = navLinks.querySelector('.btn-nav');
      navLinks.insertBefore(existing, btn || null);
    }
    existing.textContent = '\u2699 Admin';
    existing.href = resolveHref('pages/admin.html');
  }

  /* ── Protected pages that need session + suspension checks ── */
  var PROTECTED_PAGES = ['browse.html', 'resource.html', 'dashboard.html', 'profile.html', 'upload.html'];

  function isProtectedPage() {
    var page = currentPage();
    return PROTECTED_PAGES.indexOf(page) !== -1;
  }

  /* Hide main content until auth check clears.
     We add a tiny inline style sheet rather than touch each page's markup. */
  function lockPage() {
    if (document.getElementById('nl-auth-lock')) return;
    var style = document.createElement('style');
    style.id = 'nl-auth-lock';
    style.textContent = 'body > *:not(nav):not(#nl-suspended-overlay):not(#nl-auth-gate-overlay) { visibility: hidden !important; }'
      + ' nav .nav-links, nav .nav-toggle { visibility: hidden !important; }';
    document.head.appendChild(style);
  }

  function unlockPage() {
    var style = document.getElementById('nl-auth-lock');
    if (style) style.remove();
  }

  /* Lock before the page paints (this script loads in <head>) */
  if (isProtectedPage()) lockPage();

  /* ── Skeleton screens (replace the old spinner) ──
     Plain-HTML builders; the look lives in css/styles.css (.sk-*).
     Exposed as window.nlSkeleton so page scripts can reuse them. */
  var SK = (function () {
    function b(w, h, x) {
      return '<span class="sk" style="width:' + w + ';height:' + h + (x ? ';' + x : '') + '"></span>';
    }
    function dot(d) {
      return '<span class="sk sk-circle" style="width:' + d + 'px;height:' + d + 'px"></span>';
    }
    function wrap(inner, extra) {
      return '<div class="sk-wrap" role="status" aria-busy="true"' + (extra ? ' style="' + extra + '"' : '') + '>'
           + '<span class="sk-sr">Loading…</span>' + inner + '</div>';
    }
    function card(i) {
      return '<div class="sk-card sk-res" aria-hidden="true">'
        + '<span class="sk sk-thumb"></span><div class="sk-body">'
        + '<div class="sk-row" style="margin-bottom:12px">' + b('44px', '18px', 'border-radius:4px') + b('62px', '18px', 'border-radius:4px') + b('50px', '18px', 'border-radius:4px') + '</div>'
        + b('92%', '14px', 'margin-bottom:8px') + b('64%', '14px')
        + '<div class="sk-foot"><div class="sk-row">' + dot(20) + b('84px', '12px') + '</div>' + b('36px', '12px') + '</div>'
        + '</div></div>';
    }
    function cards(n) { var o = ''; for (var i = 0; i < n; i++) o += card(i); return o; }
    function resultsHeader() {
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:20px">'
        + b('170px', '16px') + b('130px', '34px') + '</div>';
    }
    function filterPanel() {
      function grp(extra) {
        return '<div class="' + (extra || '') + '" style="margin-bottom:20px">' + b('90px', '12px', 'margin-bottom:10px') + b('100%', '40px', 'border-radius:10px') + '</div>';
      }
      return '<div class="sk-card sk-pad" aria-hidden="true" style="padding:22px">'
        + b('110px', '16px', 'margin-bottom:20px') + grp('') + grp('') + grp('sk-more') + grp('sk-more') + '</div>';
    }

    /* inner pieces (also used inside the real page frames) */
    function resourceInner() {
      return '<div class="sk-card" aria-hidden="true" style="margin-bottom:24px;border-radius:18px">'
        + '<span class="sk" style="height:130px;border-radius:0"></span>'
        + '<div class="sk-pad">'
        +   '<div class="sk-row" style="margin-bottom:16px">' + b('76px', '24px', 'border-radius:20px') + b('64px', '24px', 'border-radius:20px') + b('80px', '24px', 'border-radius:20px') + '</div>'
        +   b('78%', '26px', 'margin-bottom:12px') + b('96%', '13px', 'margin-bottom:8px') + b('70%', '13px', 'margin-bottom:22px')
        +   '<div class="sk-row gap12" style="margin-bottom:22px">' + b('110px', '34px') + b('110px', '34px') + b('110px', '34px') + '</div>'
        +   '<div class="sk-row gap12" style="margin-bottom:22px">' + dot(40) + b('140px', '14px') + '</div>'
        +   '<div class="sk-row gap12">' + b('160px', '44px', 'border-radius:10px') + b('96px', '44px', 'border-radius:10px') + '</div>'
        + '</div></div>'
        + '<div class="sk-card sk-pad" aria-hidden="true">' + b('90px', '16px', 'margin-bottom:16px') + b('100%', '300px', 'border-radius:12px') + '</div>';
    }
    function panel(rows) {
      var r = '';
      for (var i = 0; i < rows; i++) {
        r += '<div class="sk-row gap12" style="padding:12px 0;' + (i ? 'border-top:1px solid var(--border)' : '') + '">'
          + b('40px', '40px', 'border-radius:10px;flex-shrink:0')
          + '<div style="flex:1;min-width:0">' + b('70%', '13px', 'margin-bottom:8px') + b('40%', '11px') + '</div></div>';
      }
      return '<div class="sk-card sk-pad" aria-hidden="true" style="padding:20px 22px">' + b('130px', '16px', 'margin-bottom:10px') + r + '</div>';
    }
    function statCards(n) {
      var o = '';
      for (var i = 0; i < n; i++) o += '<div class="sk-card" aria-hidden="true" style="padding:20px 18px 16px">' + b('34px', '34px', 'border-radius:10px;margin-bottom:14px') + b('50%', '22px', 'margin-bottom:8px') + b('70%', '11px') + '</div>';
      return '<div class="sk-stats">' + o + '</div>';
    }
    function dashboardInner() {
      return b('100%', '150px', 'border-radius:22px;margin-bottom:22px') .replace('class="sk"', 'class="sk sk-hero"')
        + statCards(4)
        + '<div class="sk-grid2"><div class="sk-stack">' + panel(3) + panel(4) + '</div><div class="sk-stack sk-side">' + panel(3) + '</div></div>';
    }
    function profileInner() {
      return b('100%', '170px', 'border-radius:20px;margin-bottom:22px').replace('class="sk"', 'class="sk sk-hero"')
        + statCards(4)
        + '<div class="sk-grid2"><div class="sk-stack">' + panel(4) + '</div><div class="sk-stack sk-side">' + panel(3) + '</div></div>';
    }
    function adminInner() {
      var rows = '';
      for (var i = 0; i < 6; i++) rows += '<div class="sk-row gap12" style="padding:14px 0;' + (i ? 'border-top:1px solid var(--border)' : '') + '">' + b('34%', '13px') + b('18%', '13px') + b('14%', '13px') + '</div>';
      return '<div class="sk-frame" style="padding-top:28px">' + statCards(4)
        + '<div class="sk-card sk-pad" aria-hidden="true" style="padding:22px">' + b('150px', '16px', 'margin-bottom:12px') + rows + '</div></div>';
    }
    function uploadInner() {
      var f = '';
      for (var i = 0; i < 4; i++) f += b('90px', '12px', 'margin-bottom:8px') + b('100%', '44px', 'border-radius:10px;margin-bottom:18px');
      return b('240px', '30px', 'margin-bottom:12px') + b('70%', '14px', 'margin-bottom:22px')
        + b('100%', '110px', 'border-radius:12px;margin-bottom:22px')
        + '<div class="sk-grid2"><div class="sk-card sk-pad" aria-hidden="true">' + b('140px', '16px', 'margin-bottom:20px') + f + '</div>'
        + '<div class="sk-card sk-pad sk-side" aria-hidden="true">' + b('100%', '200px', 'border-radius:12px;margin-bottom:16px') + b('100%', '46px', 'border-radius:10px') + '</div></div>';
    }

    /* full-page skeleton for the overlay, by page */
    function page(name) {
      if (name === 'browse.html')
        return '<div class="browse-layout">' + filterPanel() + '<div style="min-width:0">' + resultsHeader() + '<div class="results-grid">' + cards(6) + '</div></div></div>';
      if (name === 'resource.html')
        return '<div class="sk-frame">' + b('120px', '14px', 'margin-bottom:22px') + resourceInner() + '</div>';
      if (name === 'dashboard.html') return '<div class="sk-frame">' + dashboardInner() + '</div>';
      if (name === 'profile.html')   return '<div class="sk-frame">' + b('70px', '14px', 'margin-bottom:22px') + profileInner() + '</div>';
      if (name === 'upload.html')    return '<div class="sk-frame">' + uploadInner() + '</div>';
      return '<div class="sk-frame">' + panel(4) + '</div>';
    }

    return {
      wrap: wrap, cards: cards, page: page,
      resource: resourceInner, dashboard: dashboardInner, profile: profileInner, admin: adminInner,
      /* browse results area: cards inside their own grid so columns match the real one */
      browseGrid: function () { return wrap('<div class="results-grid">' + cards(6) + '</div>', 'grid-column:1/-1'); },
      countPill: function () { return '<span class="sk" style="display:inline-block;width:150px;height:14px;vertical-align:middle"></span>'; }
    };
  })();
  window.nlSkeleton = SK;

  /* Skeleton cover shown while the sign-in / suspension check is running.
     It starts below the real nav bar, so the logo never flickers. */
  function showAuthGate() {
    if (document.getElementById('nl-auth-gate-overlay')) return;
    var nav = document.querySelector('body > nav');
    var top = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
    var el = document.createElement('div');
    el.id = 'nl-auth-gate-overlay';
    el.className = 'sk-overlay';
    el.style.top = top + 'px';
    el.innerHTML = SK.wrap(SK.page(currentPage()));
    document.body.appendChild(el);
  }

  /* The page's own "Loading…" boxes become the same skeleton, so when the
     cover lifts there is no switch from skeleton to spinner underneath. */
  function fillInPage() {
    var page = currentPage();
    var map = { 'resource.html': ['resource-content', SK.resource], 'dashboard.html': ['dash-root', SK.dashboard], 'profile.html': ['profile-content', SK.profile] };
    if (map[page]) {
      var box = document.getElementById(map[page][0]);
      if (box && box.querySelector('.state-box')) box.innerHTML = SK.wrap(map[page][1]());
    }
    if (page === 'browse.html') {
      var grid = document.getElementById('results-grid');
      if (grid && !grid.firstElementChild) grid.innerHTML = SK.browseGrid();
      var count = document.getElementById('results-count');
      if (count && count.textContent.trim() === 'Loading…') count.innerHTML = SK.countPill();
    }
  }

  function hideAuthGate() {
    var el = document.getElementById('nl-auth-gate-overlay');
    if (el) el.remove();
    unlockPage();
  }

  /* Redirect unauthenticated users away from protected pages */
  function redirectToSignIn() {
    var returnParam = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(resolveHref('pages/signin.html') + '?return=' + returnParam);
  }

  function applySession(sb, session) {
    var signInLink = document.querySelector('.nav-links a[href*="signin"]');
    var signUpBtn  = document.querySelector('.btn-nav');

    if (!session) {
      ensureDashLink(false);
      ensureAdminLink(false);
      if (signInLink) {
        signInLink.style.display = '';
        signInLink.textContent = 'Sign In';
        signInLink.style.color = 'var(--sage)';
        signInLink.style.fontWeight = '';
        signInLink.href = resolveHref('pages/signin.html');
      }
      if (signUpBtn) {
        signUpBtn.textContent = 'Get Started';
        signUpBtn.onclick = function () {
          window.location.href = resolveHref('pages/signin.html#signup');
        };
      }
      suppressCurrentPageLink();

      // Protected pages require a session — redirect immediately
      if (isProtectedPage()) {
        redirectToSignIn();
        return; // keep the lock in place while redirect fires
      }

      hideAuthGate();
      return;
    }

    // Logged-in: show Dashboard, hide Sign In, swap button to Sign Out
    ensureDashLink(true, resolveHref('pages/dashboard.html'));

    if (signInLink) signInLink.style.display = 'none';

    if (signUpBtn) {
      signUpBtn.textContent = 'Sign Out';
      signUpBtn.title = 'Sign out of your NaijaLearn account';
      signUpBtn.onclick = function () {
        sb.auth.signOut().then(function () {
          window.location.href = resolveHref('pages/signin.html');
        });
      };
    }

    // Fetch profile: role (admin link) + suspended flag (gate check)
    sb.from('profiles')
      .select('role,suspended')
      .eq('id', session.user.id)
      .single()
      .then(function (result) {
        var data = result.data || {};
        var isAdmin = data.role === 'admin';
        window._nlUserRole = data.role || 'user'; // expose for page scripts
        ensureAdminLink(isAdmin);
        suppressCurrentPageLink();

        if (data.suspended && isProtectedPage()) {
          // Show full-page suspension overlay (imported from showSuspendedBanner)
          hideAuthGate(); // remove spinner first
          showSuspendedBanner();
          return;
        }

        // All clear — reveal the page
        hideAuthGate();
      });

    suppressCurrentPageLink();
  }


  function showSuspendedBanner() {
    // Avoid double-injecting
    if (document.getElementById('nl-suspended-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'nl-suspended-overlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:99999',
      'background:rgba(13,27,42,.92)','display:flex',
      'align-items:center','justify-content:center',
      'font-family:\'DM Sans\',Arial,sans-serif','padding:20px'
    ].join(';');
    overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:40px 36px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.35)">'
      + '<div style="font-size:52px;margin-bottom:16px">🚫</div>'
      + '<h2 style="font-size:22px;font-weight:700;color:#0D1B2A;margin:0 0 10px;font-family:inherit">Account Suspended</h2>'
      + '<p style="font-size:15px;color:#6B7F8E;line-height:1.6;margin:0 0 24px">Your account has been suspended by an administrator. You cannot access resources or user profiles while suspended.</p>'
      + '<p style="font-size:13px;color:#6B7F8E;margin:0 0 28px">If you believe this is a mistake, please contact the site administrator.</p>'
      + '<a href="../index.html" style="display:inline-block;background:#3D7A6B;color:#fff;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none">Go to Home</a>'
      + '</div>';
    document.body.appendChild(overlay);
    // Also hide the page's main content so it doesn't flash
    var main = document.querySelector('main') || document.querySelector('.resource-page') || document.querySelector('.browse-page') || document.querySelector('.profile-page') || document.getElementById('main-content');
    if (main) main.style.visibility = 'hidden';
  }
  /* ── boot ── */
  function boot() {
    // Protected pages: lock, show the skeleton, and prepare the in-page skeleton
    // right away. This must happen BEFORE waiting for supabase so nothing flashes.
    if (isProtectedPage()) {
      lockPage();
      showAuthGate();
      fillInPage();
    }

    if (typeof supabase === 'undefined') {
      console.warn('nav-auth.js: supabase UMD not loaded yet — retrying');
      setTimeout(boot, 100);
      return;
    }

    var sb = supabase.createClient(
      'https://elawsqcbiuierkeziywz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYXdzcWNiaXVpZXJrZXppeXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDA5NjEsImV4cCI6MjA5NDE3Njk2MX0.2h9hN3zRLPeLVFKeXtwqxv_dWvg6XXFzHXaheK6ZviI'
    );

    window._nlSb = sb;

    sb.auth.getSession().then(function (result) {
      applySession(sb, result.data && result.data.session);
    });

    sb.auth.onAuthStateChange(function (_event, session) {
      applySession(sb, session);
    });

    // Mobile nav toggle
    var navToggle = document.querySelector('.nav-toggle');
    var navLinks  = document.querySelector('.nav-links');
    if (navToggle && navLinks) {
      var nav   = navToggle.closest('nav') || document.querySelector('nav');
      var root  = document.documentElement;
      var scrim = document.createElement('div');
      scrim.className = 'nav-scrim';
      scrim.setAttribute('aria-hidden', 'true');
      nav.appendChild(scrim);

      // Two bars that morph into a cross (transform-only, styled in styles.css)
      navToggle.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true"></span>';
      navToggle.setAttribute('type', 'button');
      navToggle.setAttribute('aria-label', 'Menu');
      navToggle.setAttribute('aria-expanded', 'false');

      function setMenu(open) {
        if (open) root.style.setProperty('--nav-h', nav.offsetHeight + 'px');
        navLinks.classList.toggle('open', open);
        root.classList.toggle('nav-menu-open', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      navToggle.addEventListener('click', function () {
        setMenu(!navLinks.classList.contains('open'));
      });
      scrim.addEventListener('click', function () { setMenu(false); });
      navLinks.addEventListener('click', function (e) {
        if (e.target.closest('a, .btn-nav')) setMenu(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && navLinks.classList.contains('open')) {
          setMenu(false);
          navToggle.focus();
        }
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 768 && navLinks.classList.contains('open')) setMenu(false);
      });
    }

    // ── Theme toggle (sun / moon) ──
    (function () {
      var STORAGE_KEY = 'nl-theme';
      var html = document.documentElement;

      function applyTheme(dark) {
        html.setAttribute('data-theme', dark ? 'dark' : 'light');
        var tc = document.querySelector('meta[name="theme-color"]');
        if (tc) tc.setAttribute('content', dark ? '#18262F' : '#FFFFFF');   // matches --white (the nav bar colour)
        var btn = document.getElementById('nl-theme-toggle');
        if (btn) btn.textContent = dark ? '\ud83c\udf19' : '\u2600\ufe0f';
        try { localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light'); } catch (e) {}
      }

      function injectToggle() {
        if (document.getElementById('nl-theme-toggle')) return;
        var navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        var btn = document.createElement('button');
        btn.id = 'nl-theme-toggle';
        btn.className = 'theme-toggle';
        btn.title = 'Toggle light / dark mode';
        btn.setAttribute('aria-label', 'Toggle theme');
        // Set icon immediately so button is never blank
        btn.textContent = html.getAttribute('data-theme') === 'dark' ? '\ud83c\udf19' : '\u2600\ufe0f';

        navLinks.appendChild(btn);

        btn.addEventListener('click', function () {
          var isDark = html.getAttribute('data-theme') === 'dark';
          applyTheme(!isDark);
        });
      }

      // Apply saved preference before first paint
      var saved = '';
      try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}
      var prefersDark = saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      applyTheme(prefersDark);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectToggle);
      } else {
        injectToggle();
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ── Footer heart: wrap the ❤️ in a span so CSS can animate it ──
   Runs on every page (all load this file). The admin page builds its footer
   after load, so a MutationObserver re-checks when new content is added. */
(function () {
  var HEART = '❤️';

  /* Put the "© 2026 NaijaLearn." sentence in its own span so CSS can space it
     from "Built with ❤️ for Nigerian education." */
  function splitSentences(el) {
    var first = el.firstChild;
    if (!first || first.nodeType !== 3) return;
    var m = first.nodeValue.match(/^(\s*\u00A9[^.]*\.)\s+([\s\S]*)$/);
    if (!m) return;
    var span = document.createElement('span');
    span.className = 'footer-copy-line';
    span.textContent = m[1].trim();
    el.insertBefore(span, first);
    first.nodeValue = m[2];
  }

  function wrapHearts() {
    var copies = document.querySelectorAll('.footer-copy');
    for (var i = 0; i < copies.length; i++) {
      splitSentences(copies[i]);
      var node = copies[i].firstChild;
      while (node) {
        var next = node.nextSibling;
        if (node.nodeType === 3 && node.nodeValue.indexOf(HEART) !== -1) {
          var parts = node.nodeValue.split(HEART);
          var frag = document.createDocumentFragment();
          for (var j = 0; j < parts.length; j++) {
            if (j > 0) {
              var span = document.createElement('span');
              span.className = 'footer-heart';
              span.setAttribute('aria-hidden', 'true');
              span.textContent = HEART;
              frag.appendChild(span);
            }
            if (parts[j]) frag.appendChild(document.createTextNode(parts[j]));
          }
          copies[i].replaceChild(frag, node);
        }
        node = next;
      }
    }
  }

  function start() {
    wrapHearts();
    if (window.MutationObserver) {
      var pending = false;
      new MutationObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; wrapHearts(); });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
// ── "Show more" helper: glide the page so the first newly added row comes into view ──
// Under the sticky nav with a little air above; capped so one click never flings the page.
window.nlRollTo = function (el) {
  if (!el) return;
  requestAnimationFrame(function () {
    var nav = document.querySelector('nav');
    var offset = (nav ? nav.offsetHeight : 0) + 24;
    var delta = el.getBoundingClientRect().top - offset;
    if (delta <= 0) return;                                   // already in view
    delta = Math.min(delta, window.innerHeight * 0.8);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' });
  });
};
})();
