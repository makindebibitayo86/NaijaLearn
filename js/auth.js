/* ============================================
   NAIJLEARN — Auth Pages JS  (Supabase)
   js/auth.js
   ============================================ */

import _supabase from './supabase.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {

  // ─── SIGN UP ───────────────────────────────────────────────
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async e => {
      e.preventDefault();

      const name     = document.getElementById('name')?.value?.trim();
      const email    = document.getElementById('email')?.value?.trim();
      const role     = document.getElementById('role')?.value;
      const password = document.getElementById('password')?.value;
      const confirm  = document.getElementById('confirm-password')?.value;

      if (!name)    return showToast('Please enter your full name.', 'error');
      if (!email || !email.includes('@')) return showToast('Please enter a valid email.', 'error');
      if (!role)    return showToast('Please select your role.', 'error');
      if (!password || password.length < 8) return showToast('Password must be at least 8 characters.', 'error');
      if (password !== confirm) return showToast('Passwords do not match.', 'error');

      const btn = signupForm.querySelector('button[type="submit"]');
      if (btn) { btn.textContent = 'Creating account…'; btn.disabled = true; }

      const { error } = await _supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, role },   // stored in raw_user_meta_data → picked up by trigger
        },
      });

      if (error) {
        showToast(error.message, 'error');
        if (btn) { btn.textContent = 'Create Free Account'; btn.disabled = false; }
        return;
      }

      showToast(`Welcome to NaijaLearn, ${name.split(' ')[0]}! Check your email to confirm. 🎉`, 'success');
      setTimeout(() => window.location.href = '../index.html', 2500);
    });
  }

  // ─── SIGN IN ───────────────────────────────────────────────
  const signinForm = document.getElementById('signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async e => {
      e.preventDefault();

      const email    = document.getElementById('email')?.value?.trim();
      const password = document.getElementById('password')?.value;

      if (!email)    return showToast('Please enter your email.', 'error');
      if (!password) return showToast('Please enter your password.', 'error');

      const btn = signinForm.querySelector('button[type="submit"]');
      if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

      const { error } = await _supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showToast(error.message, 'error');
        if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
        return;
      }

      showToast('Signed in successfully!', 'success');
      setTimeout(() => window.location.href = '../index.html', 1200);
    });
  }

  // ─── FORGOT PASSWORD LINK ──────────────────────────────────
  const forgotLink = document.querySelector('a[href="#"][data-action="forgot"]');
  if (forgotLink) {
    forgotLink.addEventListener('click', async e => {
      e.preventDefault();
      const email = document.getElementById('email')?.value?.trim();
      if (!email) return showToast('Enter your email first, then click Forgot password.', 'info');

      const { error } = await _supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/pages/reset-password.html',
      });
      if (error) return showToast(error.message, 'error');
      showToast('Password reset email sent!', 'success');
    });
  }

  // ─── SIGN OUT (call from any page nav) ────────────────────
  window.signOut = async function () {
    await _supabase.auth.signOut();
    window.location.href = '../index.html';
  };

  // ─── UPDATE NAV BASED ON AUTH STATE ───────────────────────
  _supabase.auth.onAuthStateChange((_event, session) => {
    updateNavAuth(session);
  });

  async function updateNavAuth(session) {
    if (!session) session = (await _supabase.auth.getSession()).data.session;
    const signInLink = document.querySelector('a[href*="signin"]');
    const signUpBtn  = document.querySelector('button.btn-nav, .btn-nav');

    if (session) {
      const { data: profile } = await _supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      const firstName = profile?.full_name?.split(' ')[0] || 'Account';

      if (signInLink) {
        signInLink.textContent = firstName;
        signInLink.href = '../pages/dashboard.html';
      }
      if (signUpBtn) {
        signUpBtn.textContent = 'Sign Out';
        signUpBtn.onclick = window.signOut;
      }
    }
  }

  // Run on page load
  updateNavAuth(null);

  // ─── PASSWORD VISIBILITY TOGGLE ───────────────────────────
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? '🙈' : '👁';
    });
  });

});
