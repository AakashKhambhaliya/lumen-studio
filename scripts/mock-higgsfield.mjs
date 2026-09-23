#!/usr/bin/env node
// A local stand-in for https://api.higgsfield.ai for development and demos.
// It follows the documented request lifecycle (queued → in_progress →
// completed), presigned uploads and error shapes, and returns placeholder
// media instead of running models.
//
//   npm run mock:higgsfield
//   HIGGSFIELD_API_BASE=http://localhost:4010 npm run dev
//
// Any API key is accepted except one starting with "invalid".

import { randomUUID } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const BASE = `http://localhost:${PORT}`;
const RUN_MS = Number(process.env.MOCK_RUN_MS ?? 6000);
const SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const requests = new Map();
const files = new Map();

function send(response, status, body, headers = {}) {
  const payload = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  response.writeHead(status, { "Content-Type": "application/json", "X-Correlation-ID": randomUUID(), ...headers });
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function authorized(request) {
  const match = /^Key (\S+)$/.exec(request.headers.authorization ?? "");
  return match !== null && !match[1].startsWith("invalid");
}

function placeholderImage(prompt, hue) {
  const text = (prompt || "Lumen Studio").replace(/[<>&"]/g, "").slice(0, 60);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue} 80% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 80) % 360} 70% 25%)"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <text x="512" y="512" fill="white" font-family="sans-serif" font-size="40" text-anchor="middle">${text}</text>
  <text x="512" y="570" fill="white" opacity="0.7" font-family="sans-serif" font-size="24" text-anchor="middle">mock Higgsfield output</text>
</svg>`;
}

function statusOf(job) {
  if (job.status === "canceled") return job;
  const elapsed = Date.now() - job.createdAt;
  if (elapsed < RUN_MS / 3) return { ...job, status: "queued" };
  if (elapsed < RUN_MS) return { ...job, status: "in_progress" };
  if (job.fail) return { ...job, status: "failed", error: "Mock failure requested by the prompt." };
  return { ...job, status: "completed", ...job.result };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, BASE);
  const path = url.pathname;

  // Presigned storage (no Higgsfield credentials, like the real bucket).
  if (request.method === "PUT" && path.startsWith("/storage/")) {
    const id = path.slice("/storage/".length);
    files.set(id, { type: request.headers["content-type"] ?? "application/octet-stream", body: await readBody(request) });
    return send(response, 200, "");
  }
  if (request.method === "GET" && path.startsWith("/public/")) {
    const file = files.get(path.slice("/public/".length));
    if (!file) return send(response, 404, { detail: "Not found" });
    response.writeHead(200, { "Content-Type": file.type, "Cache-Control": "no-store" });
    return response.end(file.body);
  }
  if (request.method === "GET" && path.startsWith("/placeholder/")) {
    const job = requests.get(path.slice("/placeholder/".length).replace(/\.svg$/, ""));
    response.writeHead(200, { "Content-Type": "image/svg+xml" });
    return response.end(placeholderImage(job?.prompt, job?.hue ?? 190));
  }

  if (!authorized(request)) return send(response, 401, { detail: "Invalid credentials" });

  if (request.method === "POST" && path === "/files/generate-upload-url") {
    const { content_type: contentType } = JSON.parse((await readBody(request)).toString() || "{}");
    const id = randomUUID();
    return send(response, 200, {
      public_url: `${BASE}/public/${id}`,
      upload_url: `${BASE}/storage/${id}`,
      content_type: contentType,
      upload_headers: { "Content-Type": contentType },
    });
  }

  const statusMatch = /^\/requests\/([0-9a-f-]{36})\/(status|cancel)$/.exec(path);
  if (statusMatch) {
    const job = requests.get(statusMatch[1]);
    if (!job) return send(response, 404, { detail: "Request not found" });
    if (statusMatch[2] === "cancel" && request.method === "POST") {
      if (statusOf(job).status !== "queued") return send(response, 400, { detail: "Request is already processing" });
      job.status = "canceled";
      return send(response, 202, "");
    }
    const { createdAt: _createdAt, prompt: _prompt, hue: _hue, fail: _fail, result: _result, ...rest } = statusOf(job);
    return send(response, 200, rest);
  }

  if (request.method === "POST") {
    let input;
    try {
      input = JSON.parse((await readBody(request)).toString() || "{}");
    } catch {
      return send(response, 422, { detail: [{ loc: ["body"], msg: "Invalid JSON" }] });
    }
    const id = randomUUID();
    const isVideo = /video|motion|cinema|genjutsu|seedance|kling|wan|ltx|hailuo|minimax|pixverse|happy-horse/.test(path);
    const prompt = typeof input.prompt === "string" ? input.prompt : "";
    requests.set(id, {
      request_id: id,
      status_url: `${BASE}/requests/${id}/status`,
      cancel_url: `${BASE}/requests/${id}/cancel`,
      createdAt: Date.now(),
      prompt,
      hue: Math.floor(Math.random() * 360),
      fail: /\bfail\b/i.test(prompt),
      result: isVideo
        ? { video: { url: SAMPLE_VIDEO } }
        : { images: [{ url: `${BASE}/placeholder/${id}.svg` }] },
    });
    console.log(`[mock] ${path} → ${id}`, JSON.stringify(input).slice(0, 200));
    return send(response, 200, { status: "queued", request_id: id, status_url: `${BASE}/requests/${id}/status`, cancel_url: `${BASE}/requests/${id}/cancel` });
  }

  send(response, 404, { detail: "Not found" });
});

server.listen(PORT, () => console.log(`Mock Higgsfield API on ${BASE} (jobs finish after ${RUN_MS} ms)`));
