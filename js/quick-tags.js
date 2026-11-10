/* ============================================
   NAIJALEARN — Quick-search chips (home page)
   js/quick-tags.js

   Fills <div class="search-tags" id="search-tags"> with 8 random
   "class + subject" combos on every page load. A chip never shows a
   subject on its own: it always carries a class level, and some also
   carry a week (e.g. "SS2 Physics Week 4").

   Every chip text is something js/smart-search.js can parse, so
   clicking → Search lands on browse.html with the filters applied.
   To add subjects or levels, edit the POOL below.
   ============================================ */
(function () {
  'use strict';

  var box = document.getElementById('search-tags');
  if (!box) return;

  // Which class levels each band covers
  var BANDS = {
    nursery: ['Pre-Nursery', 'Nursery 1', 'Nursery 2', 'Nursery 3'],
    primary: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
    jss:     ['JSS1', 'JSS2', 'JSS3'],
    ss:      ['SS1', 'SS2', 'SS3']
  };

  // Subject label shown on the chip → bands where it is taught.
  // (labels are chosen so the smart-search parser resolves them)
  var POOL = {
    // early years
    'Number Work':          ['nursery'],
    'Letter Work':          ['nursery'],
    'Phonics':              ['nursery'],
    'Rhymes & Songs':       ['nursery'],
    'Handwriting':          ['nursery', 'primary'],
    'Colouring & Drawing':  ['nursery'],
    // core subjects
    'Mathematics':          ['nursery', 'primary', 'jss', 'ss'],
    'English':              ['nursery', 'primary', 'jss', 'ss'],
    'Civic Education':      ['primary', 'jss', 'ss'],
    'Social Studies':       ['primary', 'jss'],
    'Agric Science':        ['primary', 'jss', 'ss'],
    'Computer Studies':     ['primary', 'jss', 'ss'],
    'Yoruba':               ['nursery', 'primary', 'jss', 'ss'],
    'French':               ['primary', 'jss', 'ss'],
    'CRS':                  ['primary', 'jss', 'ss'],
    'IRS':                  ['primary', 'jss', 'ss'],
    'Home Economics':       ['primary', 'jss'],
    'Physical Education':   ['primary', 'jss'],
    'Fine Arts':            ['primary', 'jss', 'ss'],
    'Music':                ['primary', 'jss'],
    'History':              ['jss', 'ss'],
    'Business Studies':     ['jss'],
    'Technical Drawing':    ['jss', 'ss'],
    'Woodwork':             ['jss'],
    'Metal Work':           ['jss'],
    // senior secondary
    'Further Maths':        ['ss'],
    'Biology':              ['ss'],
    'Chemistry':            ['ss'],
    'Physics':              ['ss'],
    'Economics':            ['ss'],
    'Government':           ['ss'],
    'Geography':            ['ss'],
    'Literature':           ['ss'],
    'Commerce':             ['ss'],
    'Accounting':           ['ss'],
    'Marketing':            ['ss'],
    'Data Processing':      ['ss'],
    'Food & Nutrition':     ['ss']
  };

  var COUNT = 8;        // chips shown at a time
  var WEEK_CHANCE = 0.2; // share of chips that also carry a week

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // subjects offered in a band
  function subjectsIn(band) {
    return Object.keys(POOL).filter(function (s) { return POOL[s].indexOf(band) >= 0; });
  }

  function build() {
    // Spread the 8 chips over the school levels so the set feels varied
    var bands = shuffle(['ss', 'ss', 'ss', 'jss', 'jss', 'primary', 'primary', Math.random() < 0.5 ? 'nursery' : 'primary']);
    var usedSubjects = {};
    var chips = [];
    var weeks = 0;

    bands.forEach(function (band) {
      var options = subjectsIn(band).filter(function (s) { return !usedSubjects[s]; });
      if (!options.length) options = subjectsIn(band);
      var subject = pick(options);
      usedSubjects[subject] = true;

      var cls = pick(BANDS[band]);
      var text;
      if (weeks < 2 && Math.random() < WEEK_CHANCE) {
        weeks++;
        text = cls + ' ' + subject + ' Week ' + (1 + Math.floor(Math.random() * 10));
      } else {
        text = Math.random() < 0.5 ? subject + ' ' + cls : cls + ' ' + subject;
      }
      chips.push(text);
    });

    return shuffle(chips);
  }

  var MAX_ROWS = 2;      // the chip area must never grow past this many rows
  var ATTEMPTS = 60;     // random sets tried before settling for fewer chips

  function render(chips) {
    box.textContent = '';
    chips.forEach(function (text) {
      var chip = document.createElement('span');
      chip.className = 'stag';
      chip.textContent = text;
      box.appendChild(chip);
    });
  }

  // Show every chip that sits in the first MAX_ROWS rows, hide the rest.
  // Returns how many are visible.
  function clip() {
    var chips = box.children, rowTops = [], visible = 0, i;
    for (i = 0; i < chips.length; i++) chips[i].style.display = '';
    for (i = 0; i < chips.length; i++) {
      var top = chips[i].offsetTop;
      if (rowTops.indexOf(top) < 0) rowTops.push(top);
      if (rowTops.length > MAX_ROWS) chips[i].style.display = 'none';
      else visible++;
    }
    return visible;
  }

  // Draw random sets until one fits in two rows; keep the best if none does
  function fill() {
    var best = null, bestVisible = -1;
    for (var n = 0; n < ATTEMPTS; n++) {
      var chips = build();
      render(chips);
      var v = clip();
      if (v === chips.length) return;          // all 8 fit on two rows
      if (v > bestVisible) { best = chips; bestVisible = v; }
    }
    render(best);
    clip();
  }

  fill();
  // fonts arriving late change chip widths, and a resized window changes the row width
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill);
  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(clip, 100); });
})();
