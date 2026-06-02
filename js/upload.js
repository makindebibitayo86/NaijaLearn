/* ============================================
   NAIJLEARN — Upload Page JS  (Supabase)
   js/upload.js
   ============================================ */

import _supabase from './supabase.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ─── AUTH GUARD ────────────────────────────────────────────
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    showToast('Please sign in to upload resources.', 'error');
    setTimeout(() => window.location.href = 'signin.html', 1500);
    return;
  }

  const uploaderId = session.user.id;

  // ─── DRAG & DROP / FILE PICKER ─────────────────────────────
  const dropzone  = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const fileInfo  = document.getElementById('file-info');
  const uploadForm = document.getElementById('upload-form');
  let selectedFile = null;

  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput?.click());

    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--sage)';
      dropzone.style.background  = 'var(--sage-l)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '';
      dropzone.style.background  = '';
    });

    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = '';
      dropzone.style.background  = '';
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) handleFile(file);
    });
  }

  function handleFile(file) {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    if (!allowed.includes(file.type)) {
      showToast('Only PDF, Word, or PowerPoint files are allowed.', 'error');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('File is too large. Max 20MB.', 'error');
      return;
    }

    selectedFile = file;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

    if (fileInfo) {
      fileInfo.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--sage-l);border-radius:10px;border:1px solid var(--sage-m)">
          <span style="font-size:24px">📄</span>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--ink)">${file.name}</div>
            <div style="font-size:12px;color:var(--muted)">${sizeMB} MB</div>
          </div>
          <button onclick="clearFile()" style="margin-left:auto;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted)">✕</button>
        </div>
      `;
    }
  }

  window.clearFile = function () {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (fileInfo)  fileInfo.innerHTML = '';
  };

  // ─── FORM SUBMIT ───────────────────────────────────────────
  if (uploadForm) {
    uploadForm.addEventListener('submit', async e => {
      e.preventDefault();

      const title       = document.getElementById('res-title')?.value?.trim();
      const description = document.getElementById('res-description')?.value?.trim();
      const subject     = document.getElementById('res-subject')?.value;
      const classLvl    = document.getElementById('res-class')?.value;
      const term        = document.getElementById('res-term')?.value;
      const week        = document.getElementById('res-week')?.value;
      const type        = document.getElementById('res-type')?.value;

      if (!title)    return showToast('Please enter a resource title.', 'error');
      if (!subject)  return showToast('Please select a subject.', 'error');
      if (!classLvl) return showToast('Please select a class level.', 'error');
      if (!term)     return showToast('Please select a term.', 'error');
      if (!week)     return showToast('Please select a week.', 'error');
      if (!type)     return showToast('Please select a resource type.', 'error');
      if (!selectedFile) return showToast('Please attach a file.', 'error');

      const submitBtn = uploadForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.textContent = 'Uploading…'; submitBtn.disabled = true; }

      try {
        // 1. Upload file to Supabase Storage
        //    Path: {uploader_id}/{timestamp}_{filename}
        const ext       = selectedFile.name.split('.').pop();
        const safeName  = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${uploaderId}/${Date.now()}_${safeName}`;

        const { error: storageError } = await _supabase.storage
          .from('resources')
          .upload(storagePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (storageError) throw storageError;

        // 2. Get the public URL
        const { data: urlData } = _supabase.storage
          .from('resources')
          .getPublicUrl(storagePath);

        const fileUrl = urlData.publicUrl;

        // 3. Insert metadata into the resources table
        const { error: dbError } = await _supabase
          .from('resources')
          .insert({
            title,
            description: description || null,
            subject,
            class_level: classLvl,
            term,
            week,
            type,
            file_url:   fileUrl,
            file_name:  selectedFile.name,
            file_size:  selectedFile.size,
            uploader_id: uploaderId,
          });

        if (dbError) throw dbError;

        showToast('Resource uploaded successfully! It will be reviewed shortly. ✓', 'success');
        uploadForm.reset();
        clearFile();

      } catch (err) {
        console.error('Upload error:', err);
        showToast(err.message || 'Upload failed. Please try again.', 'error');
      } finally {
        if (submitBtn) { submitBtn.textContent = 'Upload Resource'; submitBtn.disabled = false; }
      }
    });
  }

});
