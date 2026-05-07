# RMS POS v1.2 full structure fix

This package fixes the most common blank-screen cause: wrong file placement or missing package dependency.

Required structure:

```text
sql/
src/
  App.jsx
  main.jsx
  styles.css
  supabaseClient.js
.env.example
README.md
index.html
package.json
```

Important:

- `main.jsx`, `styles.css`, `supabaseClient.js`, `App.jsx` must be inside `src/`.
- There must be no `main.jsx`, `styles.css`, or `supabaseClient.js` in the repository root.
- `package.json` must include `@supabase/supabase-js`.
- `index.html` must point to `/src/main.jsx`.

Vercel:

```text
Redeploy without cache
```

Test PIN:

```text
1111
```
