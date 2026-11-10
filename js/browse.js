/* ============================================
   NAIJLEARN — Browse Page JS  (Supabase)
   js/browse.js
   ============================================ */

import _supabase from './supabase.js';
import { showToast } from './utils.js';

let activeFilters = {
  subject: [],
  class:   [],
  term:    [],
  type:    [],
  q:       '',
};

let currentSort  = 'downloads';
let isLoading    = false;

// ─── PAGINATION STATE ─────────────────────────────────────────
const PAGE_SIZE      = 24;   // cards per page
let   currentPage    = 0;    // 0-based offset pages
let   totalCount     = 0;    // total matching rows (from Supabase count)
let   renderedCards  = [];   // accumulates cards across "Load More" clicks

const SUBJECT_ICONS = {
  'Mathematics':        '📐',
  'English Language':   '📖',
  'Biology':            '🔬',
  'Physics':            '⚡',
  'Chemistry':          '🧪',
  'Civic Education':    '🏛',
  'Agricultural Science':     '🌾',
  'Computer Studies':   '💻',
  'Economics':          '📊',
  'Geography':          '🌍',
  'History':            '📜',
  'Further Mathematics':'🔢',
};

const THUMB_COLORS = {
  'Mathematics':      '#E8F4F0',
  'English Language': '#FBF3E8',
  'Biology':          '#EDF6FF',
  'Physics':          '#F3EEF9',
  'Chemistry':        '#FEF0F0',
  'Civic Education':  '#E8F4F0',
  'Agricultural Science':   '#FBF3E8',
  'Computer Studies': '#EDF6FF',
};


// ─── XSS HELPER ───────────────────────────────────────────────
// Escapes any string before injecting into innerHTML.
// Prevents malicious titles/names from running as HTML/JS.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


document.addEventListener('DOMContentLoaded', async () => {

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  if (params.get('q'))       activeFilters.q       = params.get('q');
  if (params.get('subject')) activeFilters.subject = [params.get('subject')];

  // Populate search bar from URL
  const searchBar = document.getElementById('browse-search');
  if (searchBar && activeFilters.q) searchBar.value = activeFilters.q;

  // Wire up checkboxes
  document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const group = cb.dataset.group;
      const value = cb.value;
      if (cb.checked) {
        if (!activeFilters[group]) activeFilters[group] = [];
        activeFilters[group].push(value);
      } else {
        activeFilters[group] = activeFilters[group].filter(v => v !== value);
      }
      resetAndFetch();
    });

    if (activeFilters[cb.dataset.group]?.includes(cb.value)) cb.checked = true;
  });

  // Search bar — debounced so we don't fire on every keystroke
  let searchTimer;
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        activeFilters.q = searchBar.value.trim().toLowerCase();
        resetAndFetch();
      }, 300);
    });
  }

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      resetAndFetch();
    });
  }

  // Clear filters
  const clearBtn = document.querySelector('.filter-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      activeFilters = { subject: [], class: [], term: [], type: [], q: '' };
      if (searchBar) searchBar.value = '';
      document.querySelectorAll('.filter-option input').forEach(cb => cb.checked = false);
      resetAndFetch();
    });
  }

  // Initial load
  await fetchResources();
});


// ─── RESET PAGINATION & RE-FETCH ─────────────────────────────
// Called whenever filters/sort change — starts fresh from page 0.
function resetAndFetch() {
  currentPage   = 0;
  renderedCards = [];
  const grid = document.getElementById('results-grid');
  if (grid) grid.innerHTML = '';
  fetchResources();
}


// ─── FETCH FROM SUPABASE (paginated) ─────────────────────────
async function fetchResources() {
  if (isLoading) return;
  isLoading = true;
  showLoading(true);

  try {
    // Build query with server-side filters applied where possible
    let query = _supabase
      .from('resources')
      .select(`
        id, title, description, subject, class_level, term, week,
        type, file_url, file_name, downloads, verified, created_at,
        profiles ( full_name, avatar_url )
      `, { count: 'exact' });   // count: exact returns totalCount

    // Server-side filters (exact matches — fast, uses indexes)
    if (activeFilters.subject.length === 1) query = query.eq('subject',     activeFilters.subject[0]);
    if (activeFilters.class.length   === 1) query = query.eq('class_level', activeFilters.class[0]);
    if (activeFilters.term.length    === 1) query = query.eq('term',        activeFilters.term[0]);
    if (activeFilters.type.length    === 1) query = query.eq('type',        activeFilters.type[0]);

    // Full-text search via the fts column (uses the GIN index)
    if (activeFilters.q) {
      query = query.textSearch('fts', activeFilters.q, { type: 'websearch' });
    }

    // Sort
    if (currentSort === 'downloads') query = query.order('downloads',  { ascending: false });
    if (currentSort === 'newest')    query = query.order('created_at', { ascending: false });
    if (currentSort === 'alpha')     query = query.order('title',      { ascending: true  });

    // Pagination — fetch one page worth
    const from = currentPage * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    totalCount = count ?? 0;

    // Shape the new page of results
    const newCards = (data || []).map(r => ({
      ...r,
      uploader:  r.profiles?.full_name || 'Anonymous',
      initials:  initials(r.profiles?.full_name || '??'),
      avatarUrl: r.profiles?.avatar_url || null,
      thumb:     THUMB_COLORS[r.subject] || '#E8F4F0',
      icon:      SUBJECT_ICONS[r.subject] || '📄',
    }));

    renderedCards = [...renderedCards, ...newCards];

    renderResults(newCards, currentPage === 0);
  } catch (err) {
    showErrorState(err.message);
  } finally {
    isLoading = false;
    showLoading(false);
  }
}


function initials(name) {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('');
}


// ─── RENDER ───────────────────────────────────────────────────
// newCards  — the page just fetched
// replace   — if true, clear the grid first (filter/sort reset)
function renderResults(newCards, replace = false) {
  const grid    = document.getElementById('results-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  // Update count label
  if (countEl) {
    const showing = Math.min(renderedCards.length, totalCount);
    countEl.innerHTML = `Showing <strong>${showing}</strong> of <strong>${totalCount}</strong> resources`;
  }

  // Remove old "Load More" sentinel before re-rendering
  const oldSentinel = document.getElementById('nl-load-more-wrap');
  if (oldSentinel) oldSentinel.remove();

  if (replace) grid.innerHTML = '';

  if (renderedCards.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:12px">🔍</div>
        <div style="font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px">No resources found</div>
        <div style="font-size:14px">Try adjusting your filters or search term.</div>
      </div>
    `;
    return;
  }

  // Append new cards — all user content escaped via esc()
  newCards.forEach(r => {
    const card = document.createElement('div');
    card.className = 'res-card';
    card.dataset.id  = r.id;
    card.dataset.url = r.file_url;   // stored in data-attr, not inline JS string

    // Avatar HTML — built safely
    let avatarHtml;
    if (r.avatarUrl) {
      avatarHtml = `
        <img src="${esc(r.avatarUrl)}" alt="${esc(r.uploader)}"
             style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">
          ${esc(r.initials)}
        </span>`;
    } else {
      avatarHtml = esc(r.initials);
    }

    card.innerHTML = `
      <div class="res-thumb" style="background:${esc(r.thumb)}">
        ${esc(r.icon)}
        <div class="res-badge">${esc(r.type)}</div>
        ${r.verified ? '<div class="res-verified">✓ Verified</div>' : ''}
      </div>
      <div class="res-body">
        <div class="res-meta">
          <span class="meta-tag green">${esc(r.class_level)}</span>
          <span class="meta-tag">${esc(r.term)}</span>
          <span class="meta-tag">${esc(r.week)}</span>
        </div>
        <div class="res-title">${esc(r.title)}</div>
        <div class="res-topic">${esc(r.subject)}</div>
        <div class="res-footer">
          <div class="res-uploader">
            <div class="avatar-sm">${avatarHtml}</div>
            ${esc(r.uploader)}
          </div>
          <div class="res-downloads"><span class="dl-icon">⬇</span>${r.downloads.toLocaleString()}</div>
        </div>
      </div>
    `;

    // Click handler attached via JS — no inline onclick with injected values
    card.addEventListener('click', () => openResource(r.id, r.file_url));

    grid.appendChild(card);
  });

  // ── Load More button ──────────────────────────────────────
  const hasMore = renderedCards.length < totalCount;
  const wrap = document.createElement('div');
  wrap.id = 'nl-load-more-wrap';
  wrap.style.cssText = 'grid-column:1/-1;text-align:center;padding:24px 0 8px';

  if (hasMore) {
    const remaining = totalCount - renderedCards.length;
    const btn = document.createElement('button');
    btn.id = 'nl-load-more-btn';
    btn.textContent = `Load more (${remaining} remaining)`;
    btn.style.cssText = 'padding:12px 32px;background:var(--sage);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', () => {
      currentPage++;
      fetchResources();
    });
    wrap.appendChild(btn);
  } else if (totalCount > PAGE_SIZE) {
    // Only show "all loaded" if there was more than one page worth
    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:13px;color:var(--muted)';
    msg.textContent = `All ${totalCount} resources loaded.`;
    wrap.appendChild(msg);
  }

  grid.after(wrap);
}


// ─── OPEN RESOURCE (download + track) ────────────────────────
window.openResource = async function (id, fileUrl) {
  // Increment download counter via DB function (no auth required)
  await _supabase.rpc('increment_downloads', { resource_id: id });

  // Update rendered card's download count in the DOM
  const card = document.querySelector(`.res-card[data-id="${id}"]`);
  if (card) {
    const dlEl = card.querySelector('.res-downloads');
    if (dlEl) {
      const current = parseInt(dlEl.textContent.replace(/\D/g, ''), 10) || 0;
      dlEl.innerHTML = `<span class="dl-icon">⬇</span>${(current + 1).toLocaleString()}`;
    }
  }

  // Open file in new tab
  window.open(fileUrl, '_blank', 'noopener');
};


// ─── HELPERS ──────────────────────────────────────────────────
function showLoading(on) {
  // Only show the skeleton on first page load, not on "Load More"
  if (currentPage > 0) return;
  const grid = document.getElementById('results-grid');
  if (!grid || !on) return;
  grid.innerHTML = window.nlSkeleton
    ? window.nlSkeleton.browseGrid()
    : '<div style="grid-column:1/-1;text-align:center;padding:80px 0;color:var(--muted)">Loading resources…</div>';
}

function showErrorState(msg) {
  const grid = document.getElementById('results-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--muted)">
      <div style="font-size:36px;margin-bottom:12px">⚠️</div>
      <div style="font-size:15px;color:var(--ink);margin-bottom:8px">Could not load resources</div>
      <div style="font-size:13px">${esc(msg)}</div>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:var(--sage);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Retry</button>
    </div>
  `;
}
