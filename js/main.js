/* ============================================
   NAIJLEARN — Main JavaScript
   ============================================ */

import _supabase from './supabase.js';
import { showToast } from './utils.js';

// Auth-aware nav on every page
(async () => {
  try {
    const { data: { session } } = await _supabase.auth.getSession();
    const signInLink = document.querySelector('a[href*="signin"]');
    const signUpBtn  = document.querySelector('.btn-nav');
    if (session) {
      const { data: profile } = await _supabase
        .from('profiles').select('full_name').eq('id', session.user.id).single();
      const firstName = profile?.full_name?.split(' ')[0] || 'Account';
      if (signInLink) { signInLink.textContent = firstName; signInLink.href = 'pages/dashboard.html'; }
      if (signUpBtn)  { signUpBtn.textContent = 'Sign Out'; signUpBtn.onclick = async () => { await _supabase.auth.signOut(); location.reload(); }; }
    }
  } catch(e) { /* not on a page with nav */ }
})();

document.addEventListener('DOMContentLoaded', () => {

  // ─── MOBILE NAV TOGGLE ───
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks  = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      navToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
    });
  }

  // ─── HOW IT WORKS TABS ───
  window.switchTab = function(tab, el) {
    document.querySelectorAll('.how-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const teacherSteps = document.getElementById('teacher-steps');
    const parentSteps  = document.getElementById('parent-steps');
    if (teacherSteps) teacherSteps.style.display = tab === 'teacher' ? 'grid' : 'none';
    if (parentSteps)  parentSteps.style.display  = tab === 'parent'  ? 'grid' : 'none';
  };

  // ─── QUICK SEARCH TAGS ───
  document.querySelectorAll('.stag').forEach(tag => {
    tag.addEventListener('click', () => {
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        searchInput.value = tag.textContent;
        searchInput.focus();
      }
    });
  });

  // ─── SEARCH FORM ───
  const searchBtn = document.querySelector('.btn-search');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const q = document.querySelector('.search-input')?.value?.trim();
      if (q) {
        window.location.href = `pages/browse.html?q=${encodeURIComponent(q)}`;
      } else {
        showToast('Please enter a search term.', 'info');
      }
    });
  }

  // Allow pressing Enter in the search input
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          window.location.href = `pages/browse.html?q=${encodeURIComponent(q)}`;
        }
      }
    });
  }

  // ─── SUBJECT PILLS ───
  document.querySelectorAll('.subject-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const subjectName = pill.querySelector('.subj-name')?.textContent;
      if (subjectName) {
        window.location.href = `pages/browse.html?subject=${encodeURIComponent(subjectName)}`;
      }
    });
  });

  // ─── RESOURCE CARDS ───
  document.querySelectorAll('.res-card').forEach(card => {
    card.addEventListener('click', () => {
      const title = card.querySelector('.res-title')?.textContent;
      showToast(`Opening: ${title?.substring(0, 40)}...`, 'info');
      // In real app: window.location.href = `pages/resource.html?id=...`
    });
  });

  // ─── HERO BUTTONS ───
  const btnBrowse = document.querySelector('.btn-primary');
  if (btnBrowse && btnBrowse.textContent.includes('Browse')) {
    btnBrowse.addEventListener('click', () => {
      window.location.href = 'pages/browse.html';
    });
  }

  const btnUpload = document.querySelector('.btn-ghost');
  if (btnUpload && btnUpload.textContent.includes('Upload')) {
    btnUpload.addEventListener('click', () => {
      window.location.href = 'pages/upload.html';
    });
  }

  // ─── CTA BUTTONS ───
  const btnCreateAcc = document.querySelector('.btn-sage');
  if (btnCreateAcc) {
    btnCreateAcc.addEventListener('click', () => {
      window.location.href = 'pages/signup.html';
    });
  }

  const btnBrowseFirst = document.querySelector('.btn-outline-w');
  if (btnBrowseFirst) {
    btnBrowseFirst.addEventListener('click', () => {
      window.location.href = 'pages/browse.html';
    });
  }

  // ─── TOAST SYSTEM ───
  // showToast is imported from utils.js
window.showToast = function(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '✓'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  // ─── LIVE STATS FROM SUPABASE ───
  async function loadLiveStats() {
    try {
      const resourcesRes  = await _supabase.from('resources').select('id', { count: 'exact', head: true });
      const teachersRes   = await _supabase.from('profiles').select('id', { count: 'exact', head: true });
      const downloadsRes  = await _supabase.from('resources').select('downloads');

      console.log('[NaijaLearn] resourcesRes:', resourcesRes);
      console.log('[NaijaLearn] teachersRes:', teachersRes);
      console.log('[NaijaLearn] downloadsRes:', downloadsRes);

      const resourceCount  = resourcesRes.count;
      const teacherCount   = teachersRes.count;
      const totalDownloads = (downloadsRes.data || [])
        .reduce((sum, r) => sum + (Number(r.downloads) || 0), 0);

      console.log('[NaijaLearn] counts:', resourceCount, teacherCount, totalDownloads);

      const statEls = document.querySelectorAll('.stat-item');
      console.log('[NaijaLearn] stat elements found:', statEls.length);

      const values = [resourceCount, teacherCount, totalDownloads];

      // Update CTA teacher count too
      const ctaEm = document.querySelector('.cta-title em');
      if (ctaEm && teacherCount != null) {
        ctaEm.textContent = teacherCount.toLocaleString() + '+';
      }

      // Animate each stat now that we have real values
      statEls.forEach((item, i) => {
        const numEl = item.querySelector('.stat-num');
        if (!numEl) return;
        const val = values[i] ?? 0;
        animateCount(numEl, val);
      });

    } catch (e) {
      console.error('[NaijaLearn] loadLiveStats error:', e);
    }
  }

  function animateCount(el, end) {
    const dur   = 1600;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / dur, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.floor(eased * end);
      el.textContent = current.toLocaleString() + '+';
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── TRIGGER STATS LOAD ───
  loadLiveStats();

  // ─── SCROLL FADE IN ───
  const fadeEls = document.querySelectorAll('.res-card, .subject-pill, .step-card, .testi-card');
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  fadeEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = `opacity .4s ease ${(i % 8) * 60}ms, transform .4s ease ${(i % 8) * 60}ms`;
    fadeObserver.observe(el);
  });

});
