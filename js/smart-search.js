/* ============================================
   NAIJLEARN — Smart Search parser
   js/smart-search.js

   NLSmartSearch.parse("Biology SS2 first term week 4 past questions")
   → { subject, classes[], term, week, type, keywords[], matched[] }

   The text is split into pieces; every piece that looks like a
   subject / class / term / week / resource type is pulled out and
   returned as a filter. Whatever is left becomes keywords.
   ============================================ */
(function () {
  'use strict';

  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function num(s) { return NUM[s] || parseInt(s, 10); }

  // ── Subjects: canonical value (must equal the <option> value) → aliases ──
  var SUBJECTS = {
    'All Subjects':        ['all subjects'],
    'Number Work':         ['number work', 'numeracy'],
    'Letter Work':         ['letter work'],
    'Phonics':             ['phonics'],
    'Rhymes & Songs':      ['rhymes and songs', 'nursery rhymes', 'rhymes', 'songs'],
    'Handwriting':         ['handwriting', 'hand writing'],
    'Colouring & Drawing': ['colouring and drawing', 'coloring and drawing', 'colouring', 'coloring'],
    'Social Habits':       ['social habits'],
    'Health Habits':       ['health habits'],
    'Mathematics':         ['mathematics', 'maths', 'math', 'mathmatics', 'arithmetic'],
    'Further Mathematics': ['further mathematics', 'further maths', 'further math', 'f maths', 'fmaths'],
    'Biology':             ['biology', 'bio'],
    'Chemistry':           ['chemistry', 'chem'],
    'Physics':             ['physics', 'phy', 'phys'],
    'Agricultural Science':['agricultural science', 'agriculture', 'agric science', 'agric'],
    'Computer Studies':    ['computer studies', 'computer science', 'computer', 'ict'],
    'Health Science':      ['health science'],
    'Home Economics':      ['home economics', 'home ec'],
    'Physical Education':  ['physical and health education', 'physical education', 'phe', 'pe'],
    'English Language':    ['english language', 'english', 'eng'],
    'Literature in English': ['literature in english', 'literature', 'lit'],
    'Yoruba Language':     ['yoruba language', 'yoruba'],
    'French':              ['french'],
    'Arabic':              ['arabic'],
    'Fine Arts':           ['fine arts', 'fine art'],
    'Music':               ['music'],
    'Economics':           ['economics', 'econs'],
    'Geography':           ['geography', 'geo'],
    'History':             ['history'],
    'Government':          ['government', 'govt', 'gov'],
    'Civic Education':     ['civic education', 'civics', 'civic'],
    'Social Studies':      ['social studies'],
    'Christian Religious Studies': ['christian religious studies', 'christian religious knowledge', 'crs', 'crk'],
    'Islamic Religious Studies':   ['islamic religious studies', 'islamic religious knowledge', 'irs', 'irk'],
    'Technical Drawing':   ['technical drawing', 'tech drawing'],
    'Woodwork':            ['woodwork', 'wood work'],
    'Metal Work':          ['metal work', 'metalwork'],
    'Auto Mechanics':      ['auto mechanics', 'auto mechanic'],
    'Electrical Installation': ['electrical installation'],
    'Building Construction':   ['building construction'],
    'Data Processing':     ['data processing'],
    'Food & Nutrition':    ['food and nutrition'],
    'Catering Craft Practice': ['catering craft practice', 'catering craft', 'catering'],
    'Tourism':             ['tourism'],
    'Commerce':            ['commerce'],
    'Accounting':          ['accounting', 'accounts', 'account'],
    'Business Studies':    ['business studies', 'business'],
    'Marketing':           ['marketing'],
    'Typewriting':         ['typewriting', 'type writing'],
    'Office Practice':     ['office practice']
  };

  // flat alias list, longest first so "further maths" wins over "maths"
  var ALIASES = [];
  Object.keys(SUBJECTS).forEach(function (subj) {
    SUBJECTS[subj].forEach(function (a) { ALIASES.push({ alias: a, subject: subj }); });
  });
  ALIASES.sort(function (a, b) { return b.alias.length - a.alias.length; });

  // single-word aliases (≥6 letters) used for typo-tolerant matching
  var FUZZY = ALIASES.filter(function (a) { return a.alias.length >= 6 && a.alias.indexOf(' ') < 0; });

  var TYPES = [
    { value: 'Scheme of Work', re: /\b(?:schemes? of work|schemes?|sow)\b/ },
    { value: 'Past Questions', re: /\b(?:past questions?|past papers?|exam questions?|questions?|waec|neco|jamb|pq)\b/ },
    { value: 'Lesson Note',    re: /\b(?:lesson notes?|lesson plans?|notes?)\b/ },
    { value: 'Activity',       re: /\b(?:activity|activities|worksheets?)\b/ }
  ];

  var STOP = ['for', 'of', 'the', 'and', 'in', 'on', 'a', 'an', 'to', 'class', 'classes', 'level',
              'resource', 'resources', 'lesson', 'lessons', 'plan', 'term', 'week', 'school',
              'secondary', 'junior', 'senior', 'primary', 'show', 'me', 'find', 'on', 'about'];

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function lev(a, b) {
    var m = a.length, n = b.length, i, j, d = [];
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
                           d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }

  function normalise(q) {
    return ' ' + String(q || '').toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ').trim() + ' ';
  }

  // Replace first match of re in text with a space; returns [match, newText]
  function take(re, text) {
    var m = re.exec(text);
    if (!m) return [null, text];
    return [m, text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)];
  }

  function parse(query) {
    var text = normalise(query);
    var out = { subject: '', classes: [], term: '', week: '', type: '', keywords: [], matched: [] };
    var r;

    // ── Week ──
    r = take(/\b(?:week|wk)\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/, text);
    if (r[0]) {
      var w = num(r[0][1]);
      if (w >= 1 && w <= 10) { out.week = 'Week ' + w; text = r[1]; }
    }
    if (!out.week) {
      r = take(/\bexam prep(?:aration)?\b/, text);
      if (r[0]) { out.week = 'Exam Prep'; text = r[1]; }
    }
    if (!out.week) {
      r = take(/\bfull term\b/, text);
      if (r[0]) { out.week = 'Full Term'; text = r[1]; }
    }

    // ── Term ──
    var TERMS = [
      ['First Term',  /\b(?:first|1st)\s+term\b|\bterm\s*(?:1|one)\b/],
      ['Second Term', /\b(?:second|2nd)\s+term\b|\bterm\s*(?:2|two)\b/],
      ['Third Term',  /\b(?:third|3rd)\s+term\b|\bterm\s*(?:3|three)\b/]
    ];
    for (var t = 0; t < TERMS.length && !out.term; t++) {
      r = take(TERMS[t][1], text);
      if (r[0]) { out.term = TERMS[t][0]; text = r[1]; }
    }

    // ── Resource type ──
    for (var k = 0; k < TYPES.length && !out.type; k++) {
      r = take(TYPES[k].re, text);
      if (r[0]) { out.type = TYPES[k].value; text = r[1]; }
    }

    // ── Class level (can match several, e.g. "ss1 ss2 biology") ──
    var N = '(\\d|one|two|three|four|five|six|seven|eight|nine)';
    function addClass(label) { if (out.classes.indexOf(label) < 0) out.classes.push(label); }
    var CLASS_RULES = [
      [/\b(?:pre nursery|prenursery|play ?group|pre school)\b/, function () { addClass('Pre-Nursery'); }],
      [new RegExp('\\b(?:nursery|nurs|nur)\\s*' + N + '\\b'), function (m) { var n = num(m[1]); if (n >= 1 && n <= 3) addClass('Nursery ' + n); else return false; }],
      [new RegExp('\\b(?:jss|jsss|js|junior secondary(?: school)?|junior sec)\\s*' + N + '\\b'), function (m) { var n = num(m[1]); if (n >= 1 && n <= 3) addClass('JSS' + n); else return false; }],
      [new RegExp('\\b(?:ss|sss|senior secondary(?: school)?|senior sec)\\s*' + N + '\\b'), function (m) { var n = num(m[1]); if (n >= 1 && n <= 3) addClass('SS' + n); else return false; }],
      [new RegExp('\\b(?:primary|prim|pri)\\s*' + N + '\\b|\\bp([1-6])\\b'), function (m) { var n = num(m[1] || m[2]); if (n >= 1 && n <= 6) addClass('Primary ' + n); else return false; }],
      [new RegExp('\\bbasic\\s*' + N + '\\b'), function (m) { var n = num(m[1]); if (n >= 1 && n <= 6) addClass('Primary ' + n); else if (n >= 7 && n <= 9) addClass('JSS' + (n - 6)); else return false; }]
    ];
    CLASS_RULES.forEach(function (rule) {
      var re = new RegExp(rule[0].source, 'g'), m;
      while ((m = re.exec(text)) !== null) {
        if (rule[1](m) === false) continue;
        text = text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);
      }
    });

    // ── Subject (first one found wins) ──
    for (var i = 0; i < ALIASES.length; i++) {
      var a = ALIASES[i];
      var re = new RegExp('\\b' + escRe(a.alias) + '\\b');
      var m2 = re.exec(text);
      if (m2) {
        if (!out.subject) out.subject = a.subject;
        // consume every subject word, even extra ones, so they don't become keywords
        text = text.slice(0, m2.index) + ' ' + text.slice(m2.index + m2[0].length);
        if (out.subject) { /* keep scanning to swallow extra subject words */ }
      }
    }

    // ── Typo tolerance for subjects, e.g. "biolgy", "chemestry" ──
    var words = text.trim().split(/\s+/).filter(Boolean);
    if (!out.subject) {
      for (var wi = 0; wi < words.length && !out.subject; wi++) {
        var word = words[wi];
        if (word.length < 6 || STOP.indexOf(word) >= 0) continue;
        for (var f = 0; f < FUZZY.length; f++) {
          var cand = FUZZY[f].alias;
          if (word[0] !== cand[0] || Math.abs(word.length - cand.length) > 2) continue;
          var limit = cand.length >= 8 ? 2 : 1;
          if (lev(word, cand) <= limit) {
            out.subject = FUZZY[f].subject;
            words.splice(wi, 1);
            break;
          }
        }
      }
    }

    // ── Keywords = whatever is left ──
    out.keywords = words.filter(function (w) { return STOP.indexOf(w) < 0 && !/^\d+$/.test(w); });

    // ── Human-readable list of what was matched ──
    if (out.subject) out.matched.push(out.subject);
    out.classes.forEach(function (c) { out.matched.push(c); });
    if (out.term) out.matched.push(out.term);
    if (out.week) out.matched.push(out.week);
    if (out.type) out.matched.push(out.type);

    return out;
  }

  window.NLSmartSearch = { parse: parse };
})();
