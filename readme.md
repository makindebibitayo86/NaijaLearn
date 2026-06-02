# NaijaLearn — Project Files

Nigeria's Educational Resource Library for teachers, homeschool parents, and students.

🌐 **Live site:** https://naijalearn.netlify.app

---

## 📁 Project Structure

```
NaijaLearn v15/
├── index.html                  ← Landing page (start here)
├── css/
│   └── styles.css              ← All styles (colours, layout, components, responsive)
├── js/
│   ├── main.js                 ← Landing page interactivity (search, tabs, animations)
│   ├── browse.js               ← Browse page: filtering, sorting, rendering results
│   ├── upload.js               ← Upload form: drag & drop, validation
│   ├── auth.js                 ← Sign up / Sign in logic
│   ├── nav-auth.js             ← Navigation auth state (show/hide based on session)
│   ├── supabase.js             ← Supabase client initialisation
│   └── utils.js                ← Shared utilities (toast notifications etc.)
└── pages/
    ├── browse.html             ← Browse & search resources with filters
    ├── upload.html             ← Upload a lesson note, scheme, or past questions
    ├── signup.html             ← Create account
    ├── signin.html             ← Sign in
    ├── forgot-password.html    ← Request password reset email
    ├── reset-password.html     ← Set new password (after clicking email link)
    ├── dashboard.html          ← User dashboard
    ├── profile.html            ← User profile
    ├── resource.html           ← Individual resource detail page
    └── verify.html             ← Email verification page
```

---

## 🚀 How to Run Locally

> ⚠️ Do NOT open `index.html` directly in the browser (`file://`). Auth and password reset will not work. You must use a local server.

### Option 1 — VS Code Live Server (recommended)
1. Install [VS Code](https://code.visualstudio.com)
2. Install the **Live Server** extension (by Ritwick Dey)
3. Open the `NaijaLearn v15` folder in VS Code
4. Click **Go Live** in the bottom right corner
5. Site opens at `http://127.0.0.1:5500`

### Option 2 — Python
```bash
cd "NaijaLearn v15"
python3 -m http.server 5500
```
Then open `http://localhost:5500` in your browser.

### Option 3 — Node
```bash
npx serve .
```

---

## 🌐 Deployment (Netlify)

The site is deployed on Netlify via drag and drop:

1. Go to [netlify.com](https://netlify.com) and log in
2. Drag and drop the `NaijaLearn v15` folder onto the Netlify dashboard
3. Netlify publishes it at `https://naijalearn.netlify.app`

To update the live site — just drag and drop the folder again.

---

## 🔐 Authentication (Supabase)

Auth is handled by [Supabase](https://supabase.com). The project uses:

- Email/password sign up and sign in
- Email confirmation on sign up
- Password reset via email link

### Supabase Configuration Required

**1. URL Configuration**
Go to **Supabase → Authentication → URL Configuration** and set:

| Field | Value |
|---|---|
| Site URL | `https://naijalearn.netlify.app` |
| Redirect URLs | `https://naijalearn.netlify.app/pages/reset-password` |
| Redirect URLs (local) | `http://127.0.0.1:5500/pages/reset-password.html` |

**2. SMTP Settings (Brevo)**
Go to **Supabase → Project Settings → Authentication → SMTP Settings**:

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | *(your Brevo SMTP login)* |
| Password | *(your Brevo SMTP key)* |
| Sender name | `NaijaLearn` |
| Sender email | *(your verified Brevo sender email)* |

> The sender email must be verified in **Brevo → Senders & IP → Senders** before emails will send.

**3. Confirm existing users (run once in SQL Editor)**
```sql
UPDATE auth.users
SET
  email_confirmed_at = NOW(),
  confirmation_sent_at = NOW()
WHERE email_confirmed_at IS NULL;
```

---

## 🔑 Password Reset Flow

1. User clicks **Forgot password?** on the sign in page
2. Redirected to `forgot-password.html` — enters their email
3. Reset email sent via Brevo SMTP
4. User clicks link in email → lands on `reset-password.html`
5. User enters new password → saved → redirected to sign in

---

## 🎨 Design Tokens (CSS Variables)

All colours are defined in `css/styles.css` under `:root`:

| Variable | Value | Usage |
|---|---|---|
| `--sage` | #3D7A6B | Primary brand colour |
| `--sage-l` | #E8F4F0 | Light sage backgrounds |
| `--sage-m` | #B8DDD5 | Borders, accents |
| `--gold` | #C8882A | Secondary accent |
| `--ink` | #0D1B2A | Primary text |
| `--ink2` | #2D3F50 | Secondary text |
| `--muted` | #6B7F8E | Muted/label text |
| `--cream` | #FAFAF7 | Page background |
| `--border` | #E4E8EB | Card borders |

---

## 📦 Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Auth & Database | Supabase (PostgreSQL + Auth) |
| File Storage | Supabase Storage |
| Email delivery | Brevo (SMTP) |
| Hosting | Netlify |

---

## 🔧 What to Build Next

1. **Full-text search** — Replace mock data in `browse.js` with real Supabase queries
2. **Resource detail page** — PDF preview, download button, ratings
3. **Teacher verification flow** — Submit credentials, admin approval panel
4. **Admin dashboard** — Manage users, resources, and reports
5. **Bookmarks** — Let users save resources to their dashboard

---

Built with ❤️ for Nigerian education.
