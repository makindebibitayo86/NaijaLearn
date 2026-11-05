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
