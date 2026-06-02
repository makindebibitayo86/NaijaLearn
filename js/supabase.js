/* ============================================
   NAIJLEARN — Supabase Client
   js/supabase.js

   SETUP:
   1. Go to https://supabase.com/dashboard → your project
   2. Settings → API
   3. Copy "Project URL" and "anon public" key below
   ============================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://elawsqcbiuierkeziywz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYXdzcWNiaXVpZXJrZXppeXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDA5NjEsImV4cCI6MjA5NDE3Njk2MX0.2h9hN3zRLPeLVFKeXtwqxv_dWvg6XXFzHXaheK6ZviI';

const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default _supabase;

