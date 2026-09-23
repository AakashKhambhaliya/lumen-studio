# Lumen Studio

A self-hosted image and video studio for the [Higgsfield API](https://docs.higgsfield.ai/docs). One interface for 81 Higgsfield workflows (Seedance 2.0/2.5, Kling 2.5–3.0/O3/Omni, Wan 2.6–3.0 Prime, MiniMax H3, Hailuo 2.3, LTX-2.5, PixVerse V6, Happy Horse, Grok, Genjutsu, Cinema Studio 4.0, SOUL, Marketing Studio 2.5 Sunburst/Flare, Recraft V4.1, Qwen Image 3, Ideogram 4.0 and Z-Image Turbo).

| Studio | What it does | Models |
| --- | --- | --- |
| **Image** | Text-to-image and image editing | 15 |
| **Video** | Text, image, first/last-frame and reference to video; video edit and extend | 59 |
| **Cinema** | Cinema Studio 4.0 with director controls: camera body, lens, aperture, movement, genre, era, light, pacing and color palette | 1 |
| **Motion** | Kling 2.6/3.0 motion control and Genjutsu motion transfer / object swap | 6 |

Every control is generated from each workflow's published JSON schema, so new Higgsfield parameters appear without UI changes.

## Features

- **Asset tags in the prompt**: models that reference attached media by position get a tag picker. Type `@` to insert `@image1`, `@video1`, `@audio1` (Seedance) or `<<<image_1>>>` (Cinema Studio). Tags follow the order files are sent, and tags that don't match an attached file are flagged.
- **Media inputs from the schema**: start and end frames, reference images/videos/audio, character images and source videos. Upload a file or paste a public URL.
- **Background jobs**: requests are polled with backoff (2 s → 10 s), keep running across studio pages, resume after a reload, and can be cancelled while queued.
- **History and reuse**: results stay in the browser; *Reuse* restores the model, prompt, settings and media.
- **Server-side credentials**: the Higgsfield secret never reaches browser JavaScript (see [Security](#security)).

## Quick start

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and connect a Higgsfield API key (key ID and secret from [console.higgsfield.ai](https://console.higgsfield.ai)) under **Connect Higgsfield**, or configure it on the server:

```bash
cp .env.example .env.local   # then fill in HF_API_KEY_ID and HF_API_KEY_SECRET
```

### Try it without a Higgsfield key

`scripts/mock-higgsfield.mjs` implements the Higgsfield request lifecycle locally (queued → in progress → completed, uploads, cancel, errors) and returns placeholder media:

```bash
npm run mock:higgsfield                        # terminal 1, http://localhost:4010
HIGGSFIELD_API_BASE=http://localhost:4010 npm run dev   # terminal 2
```

Connect with any key ID and secret (the key ID `invalid` is rejected). A prompt containing the word `fail` produces a failed job.

## Configuration

| Variable | Purpose |
| --- | --- |
| `HF_API_KEY_ID`, `HF_API_KEY_SECRET` | Higgsfield credentials for every visitor. Recommended for deployments. `HF_CREDENTIALS=id:secret` also works. |
| `LUMEN_SESSION_SECRET` | Encrypts (AES-256-GCM) credentials saved from the Settings dialog. Recommended when not using server credentials. |
| `HIGGSFIELD_API_BASE` | API base URL. Defaults to `https://api.higgsfield.ai`. |

> **Deployment note:** with `HF_API_KEY_ID`/`HF_API_KEY_SECRET` set, anyone who can reach the app spends your Higgsfield credits. Put it behind authentication (for example your reverse proxy's) before exposing it.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development server, production build, production server |
| `npm run check` | Lint, typecheck and tests (what CI runs) |
| `npm test` | Vitest unit, route-handler and component tests |
| `npm run sync:models` | Regenerate `src/lib/catalog/generated/` from the Higgsfield docs |
| `npm run mock:higgsfield` | Local mock of the Higgsfield API |

## Architecture

```
src/
  app/
    [studio]/page.tsx        Image, Video, Cinema, Motion (static, one route)
    api/session              Connect / disconnect Higgsfield credentials
    api/generations          Submit, poll, cancel
    api/uploads              File upload through Higgsfield presigned storage
  components/
    shell/                   Layout, session and generation-polling providers, settings
    studio/                  Schema-driven studio: model picker, media tray, prompt with tags, controls, gallery
    ui/                      Popover, native <dialog>, switch, icons
  config/studios.ts          Per-studio defaults and featured parameters
  lib/
    catalog/                 Model types, generated catalog, schema helpers, payload validation, tags
    higgsfield/              Server-only API client and credential storage
scripts/                     Catalog sync and the mock API
tests/                       Vitest suites
```

The browser sends `{ modelId, prompt, parameters, media }`. The server looks the model up in the catalog, rebuilds the request from that model's schema (unknown fields dropped, values validated), and only then calls Higgsfield. Clients can reach catalog endpoints only.

## Security

- Credentials are read from the environment, or from an `httpOnly`, `SameSite=Strict` cookie scoped to `/api`. Browser scripts never see the secret, and keys are verified with Higgsfield before they are saved.
- State-changing API routes reject cross-origin requests.
- Request IDs, upload content types (Higgsfield's supported list) and sizes (100 MB) are validated.
- Pages send a Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy.

## Keeping the catalog current

`npm run sync:models` reads https://docs.higgsfield.ai/docs/llms.txt, every model family and every workflow page, then writes typed modules checked against `ModelSpec` by `npm run typecheck`. Review the diff, run `npm run check`, and commit.

## License

MIT. See [LICENSE](LICENSE). Lumen Studio started as a fork of [Open Generative AI](https://github.com/Anil-matcha/Open-Generative-AI); its copyright notice is retained in the license.
