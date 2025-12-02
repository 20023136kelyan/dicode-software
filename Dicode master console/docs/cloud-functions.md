## Cloud Video Pipeline Overview

This document inventories every server entrypoint that the video generator uses and explains how the workload maps onto Firebase Cloud Functions v2. It also captures resource expectations so we can size the infrastructure before deployment.

### API Inventory

| Path | Method(s) | Purpose | Upstream dependencies |
| --- | --- | --- | --- |
| `/api/generate-video` | `POST` | Single-shot Sora generations (12 s max). | OpenAI Videos API |
| `/api/generate-shots` | `POST` | Multi-shot orchestration with reference-frame chaining and FFmpeg stitching. | OpenAI Videos API, FFmpeg |
| `/api/remix-video` | `POST` | Remix existing clip with new prompt. | OpenAI Videos API |
| `/api/generate-images` | `POST` | Prompt helper images via OpenAI Images API. | OpenAI Images |
| `/api/suggest-prompt` | `POST` | GPT prompt suggestions for video ideas. | OpenAI Responses |
| `/api/video-title` | `POST` | Generates reel-style titles. | OpenAI Responses |
| `/api/videos/:id` | `GET` | Fetches OpenAI job metadata. | OpenAI Videos |
| `/api/videos/:id/content` | `GET` | Streams binary video/thumbnail/spritesheet. | OpenAI Videos |
| `/api/videos/:id/save` | `POST` | Downloads completed video, uploads to Storage, persists Firestore document. | OpenAI Videos, Firebase Admin |
| `/api/health` | `GET` | (New) Verifies FFmpeg + OpenAI availability for monitoring. | FFmpeg binary, OpenAI |

All routes require a Firebase ID token (`Authorization: Bearer <token>`) except `health`, which can be optionally protected via `HEALTH_CHECK_TOKEN`.

### Data Flow

1. **Client → Firebase Function**: Requests always terminate on `/api/**`, which Hosting rewrites to the `api` function.
2. **Auth**: `verifyAuthHeader` checks Firebase ID tokens via Admin SDK. Functions run with service-account credentials, so no extra keys are required at runtime.
3. **OpenAI**: All generations/remixes use `openAIFetch` with the configured `OPENAI_API_KEY`, `OPENAI_PROJECT_ID`, and optional `OPENAI_ORG_ID`.
4. **Storage & Firestore**: `/videos/:id/save` retrieves the binary from OpenAI, uploads to `gs://<bucket>/videos/<uid>/<videoId>.mp4`, and stores metadata inside the `videos` collection.
5. **Shots Orchestration**: `generate-shots` loops through 1–3 shots, captures the final frame via FFmpeg, and concatenates segments before returning a combined base64 MP4 back to the caller.

### Resource Notes

| Scenario | Est. memory | Est. wall time | Notes |
| --- | --- | --- | --- |
| Single-shot generation (`/api/generate-video`) | < 512 MB | 45–90 s | Mostly network wait time. |
| Multi-shot (2 shots @ 8 s each) | ~1 GB | 2–4 min | Stores two MP4s in `/tmp`, runs FFmpeg twice. |
| Multi-shot (3 shots @ 12 s) | 1.5–2 GB | 4–6 min | Worst case; needs full 540 s timeout. |
| Video download + save | < 512 MB | 30–60 s | Buffering single MP4 plus upload to Storage. |

Temporary files are written to `/tmp` (Functions limit 512 MB). Streaming downloads to disk plus early cleanup keeps concurrent usage below that ceiling.

### Outstanding Questions

- **Shot count**: currently capped at 3. Increasing would require Cloud Run (more `/tmp` and runtime).
- **Bulk queueing**: If we ever process jobs asynchronously, we should move orchestration into Firestore-triggered functions instead of HTTP.

### Next Steps

- Ship the Node-based `api` Cloud Function that imports the existing Next.js route handlers and exposes them through Firebase Hosting.
- Package a static FFmpeg binary within `functions/bin/ffmpeg` (or point `FFMPEG_PATH` to a shared layer) so Functions remain self-contained.
- Define CI/CD instructions (build functions, deploy hosting) once the local emulator story is in place.

## Environment & Secrets

Configure the following values via `firebase functions:config:set` (or your CI-secret manager):

| Key | Purpose |
| --- | --- |
| `env.openai_api_key` | `OPENAI_API_KEY` for Sora + image endpoints. |
| `env.openai_project_id` | Optional `OPENAI_PROJECT_ID` header. |
| `env.openai_org_id` | Optional organization header. |
| `env.firebase_project_id` | Used by the Admin SDK when verifying ID tokens. |
| `env.firebase_client_email` | Service-account client email. |
| `env.firebase_private_key` | JSON key (`\n` sequences preserved). |
| `env.firebase_storage_bucket` | Default bucket for uploads (`project.appspot.com`). |
| `env.ffmpeg_path` | Absolute path to the bundled `ffmpeg` binary (defaults to `functions/bin/ffmpeg`). |
| `env.health_check_token` | Optional shared secret for `/api/health`. |

Example:

```bash
firebase functions:config:set \
  env.openai_api_key="sk-..." \
  env.openai_project_id="proj_..." \
  env.firebase_project_id="your-project" \
  env.firebase_client_email="svc@your-project.iam.gserviceaccount.com" \
  env.firebase_private_key="$FIREBASE_PRIVATE_KEY" \
  env.firebase_storage_bucket="your-project.appspot.com"
```

The runtime bootstrap (see `functions/src/index.ts`) will automatically point `FFMPEG_PATH` at `functions/bin/ffmpeg` if the file exists, so deployments only need to copy the executable there before running `npm run deploy`.

## Deploy Workflow

1. `cd client && npm run build && npm run export` *(or your existing static build pipeline)*.
2. `cd functions && npm install && npm run build`.
3. Drop a static FFmpeg binary at `functions/bin/ffmpeg` (and `chmod +x`).
4. Deploy: `firebase deploy --only hosting,functions`.

## Cloud Run Contingency

If a workload exceeds Functions v2 limits (runtime > 9 min or `/tmp` > 512 MB), deploy the same handler to Cloud Run:

1. **Dockerfile**
   ```Dockerfile
   FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim
   RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
   WORKDIR /app
   COPY client/out ./hosting
   COPY functions/package*.json functions/tsconfig.json functions/dist ./functions/
   RUN cd functions && npm ci --omit=dev
   CMD ["node", "functions/dist/index.js"]
   ```
2. **Service Config**: allocate 4–8 GiB RAM and set request timeout to 900 s.
3. **Routing**: keep Firebase Hosting for static assets and add a rewrite to the Cloud Run URL for `/api/**`.

The client code remains unchanged because it still targets `/api/...`; only the backend target switches from Functions to Cloud Run.


