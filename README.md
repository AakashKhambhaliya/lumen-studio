# Lumen Studio

[![CI](https://github.com/AakashKhambhaliya/lumen-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/AakashKhambhaliya/lumen-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![Node.js ≥ 20.9](https://img.shields.io/badge/node-%E2%89%A5%2020.9-339933)

A self-hosted image and video studio for the [Higgsfield API](https://docs.higgsfield.ai/docs). Bring your own Higgsfield key and get one interface for **81 generation workflows**, including Seedance 2.0/2.5, Kling 2.5–3.0/O3/Omni, Wan 2.6–3.0 Prime, MiniMax H3, Hailuo 2.3, LTX-2.5, PixVerse V6, Happy Horse, Grok, Genjutsu, Cinema Studio 4.0, SOUL, Marketing Studio 2.5 Sunburst/Flare, Recraft V4.1, Qwen Image 3, Ideogram 4.0 and Z-Image Turbo.

## Studios

| Studio | Route | What it does | Workflows |
| --- | --- | --- | --- |
| **Image** | `/image` | Text-to-image and image editing | 15 |
| **Video** | `/video` | Text, image, first/last-frame and reference to video; video edit and extend | 59 |
| **Cinema** | `/cinema` | Cinema Studio 4.0 with director controls: camera body, lens, aperture, movement, genre, era, light, pacing and color palette | 1 |
| **Motion** | `/motion` | Kling 2.6/3.0 motion control, Genjutsu motion transfer and object swap | 6 |

Every control is generated from the workflow's published JSON schema, so new Higgsfield parameters show up without UI changes.

## Features

- **Asset tags in the prompt.** For models that reference attached media by position, type `@` to insert `@image1`, `@video1` or `@audio1` (Seedance), or `<<<image_1>>>` (Cinema Studio). Tags follow the order files are sent, and a tag with no matching file is flagged.
- **Media inputs from the schema.** Start and end frames, reference images/videos/audio, character images and source videos. Upload a file or paste a public URL.
- **Background jobs.** Requests are polled with backoff (1.5 s, growing to 10 s), keep running while you switch studios, resume after a reload, and can be cancelled while still queued.
- **History and reuse.** The last 200 results stay in your browser. *Reuse* restores a result's model, prompt, settings and media.
- **Server-side credentials.** Your Higgsfield API key never reaches browser JavaScript (see [Security](#security)).

## Getting started

Requires [Node.js](https://nodejs.org) 20.9 or later and a Higgsfield API key: in [console.higgsfield.ai](https://console.higgsfield.ai), create a key and click **Copy API Key**.

```bash
git clone https://github.com/AakashKhambhaliya/lumen-studio.git
cd lumen-studio
npm install
npm run dev
```

Open http://localhost:3000, click **Connect Higgsfield** and paste your API key. The key is verified with Higgsfield before it's saved.

To configure the key on the server instead (recommended for shared or deployed instances):

```bash
cp .env.example .env.local   # set HF_KEY to your API key
```

### Try it without a Higgsfield key

[`scripts/mock-higgsfield.mjs`](scripts/mock-higgsfield.mjs) runs a local copy of the Higgsfield request lifecycle (queued → in progress → completed, uploads, cancel, errors) that returns placeholder media and costs nothing:

```bash
npm run mock:higgsfield                                  # terminal 1: http://localhost:4010
HIGGSFIELD_API_BASE=http://localhost:4010 npm run dev    # terminal 2
```

Connect with any API key of 8 or more characters; keys starting with `invalid` are rejected. A prompt containing the word `fail` produces a failed job.

## Configuration

All variables are optional. See [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `HF_KEY` | Higgsfield API key used for every visitor (the value from **Copy API Key**). `HF_CREDENTIALS` is an alias, and the older separate `HF_API_KEY_ID` + `HF_API_KEY_SECRET` pair also works. |
| `LUMEN_SESSION_SECRET` | Encrypts (AES-256-GCM) keys saved from the Settings dialog. Recommended when you don't set server credentials. |
| `HIGGSFIELD_API_BASE` | API base URL. Defaults to `https://api.higgsfield.ai`. |

## Deployment

```bash
npm run build
npm start      # serves on port 3000
```

Any host that runs a Node.js server works (a VPS, Docker, Vercel, Railway, Fly.io and so on). The API routes need a Node.js runtime.

> **Protect deployed instances.** With `HF_KEY` set, anyone who can reach the app spends your Higgsfield credits. Put it behind authentication, for example your reverse proxy's, before exposing it.

Serverless platforms may cap request body size (Vercel allows about 4.5 MB), which limits uploads through `/api/uploads`. Uploads up to the app's 100 MB limit need a regular Node server. Pasting a public URL for a media input works everywhere.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run check` | Lint, typecheck and tests (what CI runs) |
| `npm test` / `npm run test:watch` | Vitest: catalog, payload validation, tags, drafts, credentials, API route and component tests |
| `npm run sync:models` | Regenerate the model catalog from the Higgsfield docs |
| `npm run mock:higgsfield` | Local mock of the Higgsfield API |
| `npm run build` / `npm start` | Production build and server |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm run check` and `npm run build` on every push to `main` and on every pull request.

### Keeping the catalog current

`npm run sync:models` reads https://docs.higgsfield.ai/docs/llms.txt, every model family and every workflow page. It then writes typed modules to [`src/lib/catalog/generated/`](src/lib/catalog/generated), which `npm run typecheck` checks against the `ModelSpec` type. Review the diff, run `npm run check` and open a pull request.

### Project structure

```
src/
  app/
    [studio]/page.tsx        Image, Video, Cinema and Motion (one static route)
    api/session/             Connect, check and disconnect Higgsfield credentials
    api/generations/         Submit, poll and cancel requests
    api/uploads/             File upload through Higgsfield presigned storage
  components/
    shell/                   Layout, session and polling providers, settings dialog
    studio/                  Schema-driven studio: model picker, media tray,
                             prompt with tags, parameter controls, gallery
    ui/                      Popover, native <dialog>, switch, icons
  config/studios.ts          Per-studio defaults and featured parameters
  hooks/                     localStorage-backed state and uploads
  lib/
    catalog/                 Model types, generated catalog, schema helpers,
                             payload validation and prompt tags
    higgsfield/              Server-only API client and credential storage
scripts/                     Catalog sync and the mock API
tests/                       Vitest suites
```

The browser sends `{ modelId, prompt, parameters, media }`. The server looks the model up in the catalog and rebuilds the request from that model's schema, dropping unknown fields and validating every value. Only then does it call Higgsfield, so clients can reach catalog endpoints only.

**Tech stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS 4, Vitest with Testing Library, ESLint.

## Security

- Credentials come from the server environment, or from an `httpOnly`, `SameSite=Strict` cookie scoped to `/api` that expires after 30 days. Browser scripts never see the key.
- Keys are verified with Higgsfield before they are saved.
- State-changing API routes reject cross-origin requests.
- Request IDs, upload content types (Higgsfield's supported list) and upload sizes (100 MB) are validated.
- Every page is served with a Content-Security-Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a strict referrer policy.

Found a vulnerability? Please don't open a public issue; contact the maintainer, [@AakashKhambhaliya](https://github.com/AakashKhambhaliya), privately instead.

## Contributing

Issues and pull requests are welcome. Before opening a pull request:

1. Fork the repo and create a branch from `main`.
2. Make your change and add or update tests.
3. Run `npm run check` and `npm run build`.

For model or parameter changes, prefer updating [`scripts/sync-models.mjs`](scripts/sync-models.mjs) over editing generated files by hand.

## Acknowledgements

Lumen Studio started as a fork of [Open Generative AI](https://github.com/Anil-matcha/Open-Generative-AI). It has been rewritten to run solely on the Higgsfield API. Model schemas come from the [Higgsfield API documentation](https://docs.higgsfield.ai/docs).

## License

[MIT](LICENSE). The original Open Generative AI copyright notice is retained as the license requires.
