# Referral Territory Map

A CRM-style map app for tracking your 343 dental referral offices — real OpenStreetMap tiles, status tracking, visit logging, notes, and follow-up dates.

## Quick Deploy (Vercel — free, ~5 minutes)

1. **Create a GitHub account** if you don't have one (github.com).
2. **Create a new repository** (e.g. "referral-map") and upload all the files in this folder (drag-and-drop works on github.com — click "Add file" → "Upload files").
3. Go to **vercel.com**, sign up/log in with your GitHub account.
4. Click **"Add New Project"**, select your "referral-map" repo, and click **Deploy**. Vercel auto-detects Vite — no configuration needed.
5. After ~1 minute, you'll get a live URL like `referral-map-yourname.vercel.app`.

## Alternative: Netlify

1. Same GitHub setup as above.
2. Go to **netlify.com**, sign up with GitHub.
3. "Add new site" → "Import an existing project" → pick your repo.
4. Build command: `npm run build`, publish directory: `dist`. Click Deploy.

## Using it on your phone

Once deployed, open the URL on your phone in Safari (iOS) or Chrome (Android):
- **iOS**: tap the Share icon → "Add to Home Screen"
- **Android**: tap the menu (⋮) → "Add to Home Screen" / "Install app"

It'll behave like a native app icon, opens full-screen, and your notes/statuses/visit logs are saved locally on that device (via browser storage).

## Local development (optional)

If you want to run it on your computer first:

```
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Notes

- Office coordinates are approximate (ZIP-code-based with small offsets), good for territory-level visualization but not street-precise.
- Data (notes, statuses, visit logs) is stored in your browser's local storage — it's per-device. If you use it on both your phone and computer, the data won't sync between them automatically.
