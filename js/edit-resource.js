/* ============================================================
   NaijaLearn — Edit Resource modal
   Lets an uploader (or an admin) edit the details of a resource:
   title, description, subject, class level, term, week and type.
   The attached file is NOT changed here.

   Usage:
     openEditResource(resourceObject, {
       sb:      supabaseClient,            // optional, defaults to window._nlSb
       onSaved: function(updatedRow){…}    // optional
     });

   Permissions are enforced by Supabase RLS:
     "Uploaders can update their own resources" / "Admins can update any resource"
   ============================================================ */
(function () {
  'use strict';

  var SUBJECT_GROUPS = [
    ['🌐 General', ['All Subjects']],
    ['🧸 Early Years / Nursery', ['Number Work', 'Letter Work', 'Phonics', 'Rhymes & Songs', 'Handwriting', 'Colouring & Drawing', 'Social Habits', 'Health Habits']],
    ['🔢 Sciences & Mathematics', ['Mathematics', 'Further Mathematics', 'Biology', 'Chemistry', 'Physics', 'Agricultural Science', 'Computer Studies', 'Health Science', 'Home Economics', 'Physical Education']],
    ['📖 Languages & Arts', ['English Language', 'Literature in English', 'Yoruba Language', 'French', 'Arabic', 'Fine Arts', 'Music']],
    ['🌍 Social Sciences & Humanities', ['Economics', 'Geography', 'History', 'Government', 'Civic Education', 'Social Studies', 'Christian Religious Studies', 'Islamic Religious Studies']],
    ['💼 Vocational & Technical', ['Technical Drawing', 'Woodwork', 'Metal Work', 'Auto Mechanics', 'Electrical Installation', 'Building Construction', 'Data Processing', 'Food & Nutrition', 'Catering Craft Practice', 'Tourism']],
    ['📊 Commerce & Business', ['Commerce', 'Accounting', 'Business Studies', 'Marketing', 'Typewriting', 'Office Practice']]
  ];

  var CLASS_GROUPS = [
    ['Nursery', ['Pre-Nursery', 'Nursery 1', 'Nursery 2', 'Nursery 3']],
    ['Primary', ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6']],
    ['Junior Secondary', ['JSS1', 'JSS2', 'JSS3']],
    ['Senior Secondary', ['SS1', 'SS2', 'SS3']]
  ];

  var TERMS = ['First Term', 'Second Term', 'Third Term', 'Full Year'];

  var WEEKS = ['General', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Exam Prep', 'Full Term'];

  // Must match the resources_type_check constraint in the database.
  var TYPES = [
    ['Lesson Note', 'Lesson Note'],
    ['Scheme of Work', 'Scheme of Work'],
    ['Past Questions', 'Past Questions'],
    ['Activity', 'Activity / Assignment'],
    ['Examination', 'Examination']
  ];

  var CSS = ''
    + '.nl-edit-overlay{position:fixed;inset:0;background:rgba(13,27,42,.55);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px;overflow-y:auto}'
    + '.nl-edit-overlay.open{display:flex}'
    + '.nl-edit-box{background:var(--white,#fff);color:var(--ink,#0D1B2A);border:1px solid var(--border,#E4E8EB);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);width:100%;max-width:560px;max-height:calc(100vh - 32px);overflow-y:auto;padding:26px}'
    + '.nl-edit-box h3{font-family:"Playfair Display",Georgia,serif;font-size:21px;margin:0 0 4px}'
    + '.nl-edit-sub{font-size:13px;color:var(--muted,#6B7F8E);margin:0 0 18px}'
    + '.nl-edit-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}'
    + '.nl-edit-field{margin-bottom:14px}'
    + '.nl-edit-field label{display:block;font-size:12px;font-weight:600;margin-bottom:6px}'
    + '.nl-edit-field input,.nl-edit-field select,.nl-edit-field textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border,#E4E8EB);border-radius:10px;background:var(--cream,#FAFAF7);color:var(--ink,#0D1B2A);font:inherit;font-size:14px}'
    + '.nl-edit-field textarea{min-height:84px;resize:vertical}'
    + '.nl-edit-field input:focus,.nl-edit-field select:focus,.nl-edit-field textarea:focus{outline:none;border-color:var(--sage,#3D7A6B)}'
    + '.nl-edit-status{display:none;font-size:13px;padding:9px 12px;border-radius:10px;margin-bottom:14px;background:#FDECEA;color:#B3261E}'
    + '.nl-edit-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}'
    + '.nl-edit-actions button{padding:11px 20px;border-radius:10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}'
    + '.nl-edit-save{background:var(--sage,#3D7A6B);color:#fff;border:none}'
    + '.nl-edit-save:disabled{opacity:.6;cursor:default}'
    + '.nl-edit-cancel{background:transparent;color:var(--muted,#6B7F8E);border:1px solid var(--border,#E4E8EB)}'
    + '@media(max-width:520px){.nl-edit-row{grid-template-columns:1fr}.nl-edit-box{padding:20px}}';

  var overlay = null;
  var current = null;   // { resource, sb, onSaved }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function groupedOptions(groups, selected) {
    var found = false;
    var html = '';
    groups.forEach(function (g) {
      html += '<optgroup label="' + esc(g[0]) + '">';
      g[1].forEach(function (v) {
        var sel = v === selected;
        if (sel) found = true;
        html += '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(v) + '</option>';
      });
      html += '</optgroup>';
    });
    // Keep any older value that is no longer in the list so it is not lost silently
    if (selected && !found) {
      html = '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>' + html;
    }
    return html;
  }

  function flatOptions(values, selected) {
    var found = values.indexOf(selected) !== -1;
    var html = (selected && !found)
      ? '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>' : '';
    values.forEach(function (v) {
      html += '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(v) + '</option>';
    });
    return html;
  }

  function typeOptions(selected) {
    var known = TYPES.some(function (t) { return t[0] === selected; });
    var html = (selected && !known)
      ? '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>' : '';
    TYPES.forEach(function (t) {
      html += '<option value="' + esc(t[0]) + '"' + (t[0] === selected ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
    });
    return html;
  }

  function ensureDom() {
    if (overlay) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'nl-edit-overlay';
    overlay.innerHTML = '<div class="nl-edit-box" role="dialog" aria-modal="true" aria-labelledby="nl-edit-heading"></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
    current = null;
  }

  function showError(msg) {
    var el = document.getElementById('nl-edit-status');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function save() {
    if (!current) return;
    var r = current.resource;
    var sb = current.sb;

    var payload = {
      title:       document.getElementById('nl-edit-title').value.trim(),
      description: document.getElementById('nl-edit-desc').value.trim() || null,
      subject:     document.getElementById('nl-edit-subject').value,
      class_level: document.getElementById('nl-edit-class').value,
      term:        document.getElementById('nl-edit-term').value,
      week:        document.getElementById('nl-edit-week').value,
      type:        document.getElementById('nl-edit-type').value
    };

    if (!payload.title)       return showError('Please enter a title.');
    if (!payload.subject)     return showError('Please select a subject.');
    if (!payload.class_level) return showError('Please select a class level.');
    if (!payload.term)        return showError('Please select a term.');
    showError('');

    var btn = document.getElementById('nl-edit-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    // .select() so we can tell when RLS blocked the update (0 rows, no error)
    sb.from('resources')
      .update(payload)
      .eq('id', r.id)
      .select('id,title,description,subject,class_level,term,week,type')
      .then(function (result) {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        if (result.error) return showError('Could not save: ' + result.error.message);
        if (!result.data || !result.data.length) {
          return showError('Could not save. You may not have permission to edit this resource.');
        }
        var updated = result.data[0];
        var cb = current && current.onSaved;
        close();
        if (cb) cb(updated);
      });
  }

  window.openEditResource = function (resource, opts) {
    opts = opts || {};
    var sb = opts.sb || window._nlSb;
    if (!resource || !sb) return;
    ensureDom();
    current = { resource: resource, sb: sb, onSaved: opts.onSaved };

    var box = overlay.firstChild;
    box.innerHTML = ''
      + '<h3 id="nl-edit-heading">Edit resource</h3>'
      + '<p class="nl-edit-sub">Update the details of this resource. The attached file stays the same.</p>'
      + '<div id="nl-edit-status" class="nl-edit-status"></div>'
      + '<div class="nl-edit-field"><label for="nl-edit-title">Title *</label>'
      +   '<input id="nl-edit-title" type="text" maxlength="200" value="' + esc(resource.title) + '"></div>'
      + '<div class="nl-edit-field"><label for="nl-edit-desc">Short description</label>'
      +   '<textarea id="nl-edit-desc">' + esc(resource.description || '') + '</textarea></div>'
      + '<div class="nl-edit-row">'
      +   '<div class="nl-edit-field"><label for="nl-edit-subject">Subject *</label>'
      +     '<select id="nl-edit-subject">' + groupedOptions(SUBJECT_GROUPS, resource.subject) + '</select></div>'
      +   '<div class="nl-edit-field"><label for="nl-edit-type">Resource type *</label>'
      +     '<select id="nl-edit-type">' + typeOptions(resource.type) + '</select></div>'
      + '</div>'
      + '<div class="nl-edit-row">'
      +   '<div class="nl-edit-field"><label for="nl-edit-class">Class level *</label>'
      +     '<select id="nl-edit-class">' + groupedOptions(CLASS_GROUPS, resource.class_level) + '</select></div>'
      +   '<div class="nl-edit-field"><label for="nl-edit-term">Term *</label>'
      +     '<select id="nl-edit-term">' + flatOptions(TERMS, resource.term) + '</select></div>'
      + '</div>'
      + '<div class="nl-edit-field"><label for="nl-edit-week">Week / Period</label>'
      +   '<select id="nl-edit-week">' + flatOptions(WEEKS, resource.week || 'General') + '</select></div>'
      + '<div class="nl-edit-actions">'
      +   '<button type="button" class="nl-edit-cancel" id="nl-edit-cancel">Cancel</button>'
      +   '<button type="button" class="nl-edit-save" id="nl-edit-save">Save Changes</button>'
      + '</div>';

    document.getElementById('nl-edit-cancel').addEventListener('click', close);
    document.getElementById('nl-edit-save').addEventListener('click', save);
    overlay.classList.add('open');
    document.getElementById('nl-edit-title').focus();
  };
})();
