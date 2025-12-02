## Shared Firebase Setup

Both the Dicode Client (Vite) and the Dicode Master Console (Next.js) now point to the **`dicode-software`** Firebase project so they can share Auth, Firestore documents, and Storage files.

- **Project ID:** `dicode-software` (see `.firebaserc`)
- **Services in use:** Firebase Auth, Cloud Firestore, Cloud Storage, Analytics
- **Reference client config:** `client/src/lib/firebase.ts` in the master console
  - Uses env keys named `NEXT_PUBLIC_FIREBASE_*`
  - Copy these values or grab them from Firebase Console → Project Settings → General → *Web app config*

### Required Client Env Vars

Create a `.env` (or `.env.local`) in this repo using the same values as the Next.js app:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=dicode-software
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### Firestore Collections

Based on `client/src/lib/firestore.ts` in the existing app, the shared database contains:

- `campaigns` – campaign metadata and ordered `itemIds`
- `campaignItems` – per-video/question blocks inside a campaign
- `videos` – generated or uploaded training content; points to Storage URLs
- `assets` – saved prompt snippets (characters, environments, etc.)

Matching these collection names ensures both apps read/write the same documents.

### Admin SDK / Functions

The Firebase Functions project (`firebase.json`) exposes an `api` callable used by the reference client.  
If you need admin credentials locally, run `firebase login` and `firebase use dicode-workspace` before invoking CLI commands.

