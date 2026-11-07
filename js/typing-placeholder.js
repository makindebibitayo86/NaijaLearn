/* ============================================
   NAIJLEARN — Typing placeholder
   Animates the hint in any <input data-typing>.
   Stops when the user focuses or fills it;
   resumes if they leave it empty.
   ============================================ */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEFAULT_TOPICS = [
    'Photosynthesis',
    'Quadratic Equations',
    'Fractions and Decimals',
    'Essay Writing',
    'Basic Science',
    'Civic Education',
    'Verbs and Tenses',
    'Electricity'
  ];

  var TYPE_MS = 70, DELETE_MS = 35, HOLD_MS = 1700, GAP_MS = 350;

  function init(input) {
    if (reduceMotion) return;

    var staticText = input.getAttribute('placeholder') || '';
    var prefix = input.getAttribute('data-prefix') || '';
    var attr = input.getAttribute('data-topics');
    var topics = attr ? attr.split('|') : DEFAULT_TOPICS;

    var timer = null, running = false;
    var topicIdx = 0, pos = 0, deleting = false;

    function stop() {
      clearTimeout(timer);
      running = false;
      input.placeholder = staticText;
    }

    function tick() {
      if (input.value || document.activeElement === input) { stop(); return; }
      if (document.hidden) { timer = setTimeout(tick, 500); return; }

      var word = topics[topicIdx];
      var delay;

      if (!deleting) {
        pos++;
        delay = TYPE_MS;
        if (pos >= word.length) { pos = word.length; deleting = true; delay = HOLD_MS; }
      } else {
        pos--;
        delay = DELETE_MS;
        if (pos <= 0) { pos = 0; deleting = false; topicIdx = (topicIdx + 1) % topics.length; delay = GAP_MS; }
      }

      input.placeholder = prefix + word.slice(0, pos);
      timer = setTimeout(tick, delay);
    }

    function start() {
      if (running || input.value) return;
      running = true;
      pos = 0; deleting = false;
      tick();
    }

    input.addEventListener('focus', stop);
    input.addEventListener('blur', function () { if (!input.value) start(); });
    input.addEventListener('input', function () { if (input.value) stop(); });

    start();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[data-typing]').forEach(init);
  });
})();


/* ============================================
   Guided fill (loops, like the search bar hint)
   Inside a [data-guide-root] form, every [data-guide="A|B|C"] field writes
   its own example, top to bottom, one set of examples per round. Then the
   [data-guide-drop] box "receives a file" and the [data-guide-cta] button
   pulses, so the eye ends on the submit button. Then everything backspaces
   away and the next set of examples begins.
   - field n shows value (round mod its list length); selects show their
     first "Select…" option as the typed text, muted so it can't pass for
     a real choice (the field's value stays empty throughout)
   - the first click, tap or key press in the form stops it and every hint
     snaps back to its normal text; it resumes once the user has left the
     form empty (like the search bar does on blur)
   - data-guide-blockers="css selector": while it matches (a file is
     attached, an upload is running) the loop does not run
   - off for reduced motion; pauses while the tab is hidden or the form is
     scrolled out of view
   ============================================ */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var START_MS = 900, TYPE_MS = 35, FIELD_GAP_MS = 350, DELETE_MS = 14,
      DROP_MS = 1100, PULSE_MS = 1800, HOLD_MS = 700, ROUND_GAP_MS = 700,
      RESUME_MS = 2500;

  function getHint(el) {
    return el.tagName === 'SELECT' ? el.options[0].textContent : (el.getAttribute('placeholder') || '');
  }
  function setHint(el, text) {
    if (el.tagName === 'SELECT') el.options[0].textContent = text;
    else el.placeholder = text;
  }

  function init(root) {
    if (reduceMotion || root.hasAttribute('data-guide-started')) return;
    root.setAttribute('data-guide-started', '');

    var fields = Array.prototype.slice.call(root.querySelectorAll('[data-guide]'));
    if (!fields.length) return;

    var statics = fields.map(getHint);
    var sets = fields.map(function (el, n) {
      var raw = el.getAttribute('data-guide');
      return raw ? raw.split('|') : [statics[n]];
    });
    var drop = root.querySelector('[data-guide-drop]');
    var cta = root.querySelector('[data-guide-cta]');
    var blockers = root.getAttribute('data-guide-blockers');

    var timer = null, resumeTimer = null, running = false, inView = true, round = 0;

    function canRun() {
      if (blockers && root.querySelector(blockers)) return false;
      return fields.every(function (el) { return !el.value; });
    }

    // every step goes through here so it can pause (hidden tab, off screen) and be cancelled
    function later(fn, ms) {
      timer = setTimeout(function () {
        if (!running) return;
        if (document.hidden || !inView) { later(fn, 500); return; }
        fn();
      }, ms);
    }

    function stop() {
      running = false;
      clearTimeout(timer);
      fields.forEach(function (el, n) { setHint(el, statics[n]); el.classList.remove('is-guiding'); });
      if (drop) drop.classList.remove('is-demo');
      if (cta) cta.classList.remove('is-pulsing');
    }

    function start() {
      if (running || !canRun()) return;
      running = true;
      fields.forEach(function (el) { setHint(el, ''); el.classList.add('is-guiding'); });
      later(runRound, START_MS);
    }

    function runRound() {
      if (!canRun()) { stop(); return; }   // filled in some other way (autofill, restored form)
      var n = 0;
      (function nextField() {
        if (n >= fields.length) { afterFields(); return; }
        var el = fields[n], text = sets[n][round % sets[n].length], pos = 0;
        n++;
        (function typeChar() {
          pos++;
          setHint(el, text.slice(0, pos));
          if (pos < text.length) later(typeChar, TYPE_MS);
          else later(nextField, FIELD_GAP_MS);
        })();
      })();
    }

    // the form is "filled": show where the file goes, then where it all ends
    function afterFields() {
      if (drop) drop.classList.add('is-demo');
      later(function () {
        if (drop) drop.classList.remove('is-demo');
        if (cta) cta.classList.add('is-pulsing');
        later(function () {
          if (cta) cta.classList.remove('is-pulsing');
          later(erase, HOLD_MS);
        }, PULSE_MS);
      }, DROP_MS);
    }

    function erase() {
      (function step() {
        var any = false;
        fields.forEach(function (el) {
          var cur = getHint(el);
          if (cur.length) { setHint(el, cur.slice(0, -1)); any = true; }
        });
        if (any) later(step, DELETE_MS);
        else { round++; later(runRound, ROUND_GAP_MS); }
      })();
    }

    function scheduleResume() {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        if (!root.contains(document.activeElement)) start();
      }, RESUME_MS);
    }

    function interrupt() { stop(); scheduleResume(); }

    ['focusin', 'pointerdown', 'keydown'].forEach(function (e) { root.addEventListener(e, interrupt, true); });
    root.addEventListener('focusout', scheduleResume);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }).observe(root);
    }

    start();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-guide-root]').forEach(init);
  });
})();
