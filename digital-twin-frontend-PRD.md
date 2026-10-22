# Cold-Chain Digital Twin — Frontend PRD & Implementation Plan

## 1. Product Requirement Document

### 1.1 What this is
A live 3D visualization layer sitting on top of the working hardware (ESP32 + DHT22 + voltage divider + dual-relay Peltier/fan system). The hardware already streams real telemetry over WiFi to the serial console — this phase replaces that console with a web experience that makes the twin's *state* and *reasoning* legible at a glance, and lets you demo "what-if" scenarios without touching the physical box.

### 1.2 Who this is for
- **Primary:** anyone evaluating your portfolio (recruiter, interviewer, professor) — spends 30–90 seconds, needs to understand what's happening without narration.
- **Secondary:** you, during a live demo — needs to be reliable, fast to load, and forgiving if WiFi drops mid-demo.

### 1.3 Core job the page does
Answer one question, immediately, visually: **"Is this shipment safe right now, and for how much longer?"** Everything else (individual sensor charts, historical trend, what-if controls) supports that one answer — it should never be buried under it.

### 1.4 Non-goals (say these explicitly so scope doesn't creep)
- Not a general IoT dashboard with configurable widgets — this is a single-purpose story, not a tool.
- Not attempting real-time video or photorealistic rendering — "cinematic" here means *deliberate, orchestrated, and specific to cold-chain logistics*, not ray-traced realism.
- Not building user accounts, multi-device fleets, or historical data warehousing — single-box, single-session for now.

### 1.5 Success criteria
- A stranger unfamiliar with the project understands system state within 10 seconds of the page loading.
- The 3D/visual centerpiece is built from the actual subject (a shipment box, thermal state, power flow) — not a generic dashboard with a decorative 3D object bolted on.
- Page survives a live demo: graceful state when WiFi/MQTT drops, no console errors, works on a phone if someone scans a QR code to check it themselves.

---

## 2. Design Direction (the "avoid AI slop" part)

Being explicit about this because it's the actual risk: a generic prompt like "3D cinematic IoT dashboard" reliably produces the same output — dark background, glowing wireframe cube rotating in place, neon cyan/purple gradient accents, glassmorphism cards, monospace data labels, "SYSTEM STATUS" in tracked-out caps. That's a video-game HUD aesthetic wearing an IoT costume. It has nothing to do with cold-chain logistics specifically — it would look the same for a smart-home app or a drone dashboard.

**Ground the design in the actual subject instead:**
Cold-chain logistics has a real, specific visual vernacular: shipping manifests, temperature log stickers on pharma boxes, thermal-indicator strips (the ones that go irreversibly from white to red past a threshold), customs/cargo paperwork, insulated foil-lined interiors, WHO vaccine cold-chain placards. That's a much more specific and defensible design language than "generic sci-fi HUD."

**Proposed direction (token system):**
- **Color:** base a near-white cold-storage grey (`#F0F2F0`) and a deep insulated-box charcoal (`#1B1F1D`) as the two backgrounds (light/dark mode optional); one functional accent — a cold-chain safety amber (`#D9A441`) for "at risk" and a muted safe green (`#4C7A5E`) for "safe," used only as status signal, never decoration. No third accent color.
- **Type:** one workhorse grotesk (e.g., Inter or IBM Plex Sans) for all UI text, plus a single condensed/industrial face (e.g., IBM Plex Condensed or a stencil-adjacent face) reserved *only* for the one big number (temperature or hours-remaining) — the way shipping-manifest documents use a compressed face for batch numbers. Not a "headline serif + body sans" split — that's a generic editorial pattern, not a logistics pattern.
- **Layout:** the hero is a schematic side-profile of the box itself (not a rotating abstract cube) — solar panel, battery, Peltier, box interior — rendered as a clean technical cutaway diagram with live values labeled directly on the parts, like an annotated engineering drawing. Motion is one orchestrated thing: when state changes (Peltier switches on, threshold crossed), the relevant part of the cutaway highlights and the "why" reasoning animates in — not hover-glow on every element.
- **Principle:** every visual element must map to a real physical part or a real decision the twin made. If a design element doesn't correspond to an actual sensor, actual relay, or actual model output, cut it.

**Explicit avoid-list for this build:**
- No rotating decorative 3D primitive with no informational purpose.
- No neon/glow-on-dark-void aesthetic — it reads as "generic AI dashboard," and it's the opposite of clinical cold-chain visual language.
- No fake "AI is thinking" spinner/typing animation — this system runs a deterministic threshold model, not an LLM; don't borrow AI-chat visual tropes for it.
- No stock IoT icon packs (generic WiFi/cloud/chip icons) — use custom, minimal line icons matching the cutaway-diagram style, or skip icons in favor of the diagram itself.

---

## 3. System Architecture

```
┌─────────────┐      WiFi/MQTT       ┌──────────────┐      WebSocket      ┌────────────┐
│   ESP32      │ ───────────────────▶│  Backend      │ ───────────────────▶│  Frontend   │
│ (hardware,   │   telemetry (JSON:   │  (Node/Python │   live push to      │  (3D twin   │
│  built)      │   temp, humidity,    │  + MQTT       │   browser)          │   web app)  │
│              │   voltage, relay     │  broker,      │                     │             │
│              │   states)            │  stores       │                     │             │
└─────────────┘                      │  history)     │                     └────────────┘
                                      └──────────────┘
```

**Why this shape, not a direct ESP32→browser connection:** browsers can't hold a raw MQTT/TCP connection to your ESP32 reliably, and you want telemetry history (for the "what-if" simulation and any trend charts) stored somewhere durable — not just live-streamed and lost. A small backend is the right amount of infrastructure, not overengineering.

| Layer | Recommended tool | Why |
|---|---|---|
| Broker | HiveMQ Cloud (free tier) or AWS IoT Core | You already have AWS experience — IoT Core also gives you a rules engine for thresholds later. HiveMQ is faster to stand up for a demo. |
| Backend | Node.js + Express + `mqtt.js`, or Python + FastAPI + `paho-mqtt` | Either is fine; pick whichever you're faster in. Exposes a WebSocket endpoint the frontend subscribes to, and a REST endpoint for historical data. |
| Storage | SQLite (simplest) or DynamoDB (if you want the AWS line on your resume) | SQLite is zero-ops for a mini-project; DynamoDB is the better story if this is going on a portfolio next to your AWS migration work. |
| Frontend | React + Three.js (via `@react-three/fiber`) | `react-three/fiber` keeps the 3D scene declarative and easier to maintain than raw Three.js, and integrates cleanly with normal React state for the live data. |
| Hosting | Vercel (frontend) + a small always-on box for the backend (Render/Fly.io free tier, or an EC2 micro instance) | Vercel is free and handles the static/React deploy well; backend needs to stay running to hold the MQTT connection, so it can't be serverless. |

---

## 4. Implementation Plan (phased, so you always have something demoable)

### Phase 0 — Data contract (½ day)
Define the exact JSON payload the ESP32 publishes (you already have the fields from your serial output: temperature, humidity, DC voltage, Peltier status, fan status, WiFi IP, timestamp). Lock this schema before building anything else — it's the seam between hardware and software work, and changing it later means touching three layers.

### Phase 1 — Backend spine (1–2 days)
- ESP32 publishes to MQTT broker instead of (or in addition to) Serial.
- Backend subscribes, stores each reading, and re-broadcasts over WebSocket.
- Test with a simple JSON viewer (Postman/`wscat`) before touching the frontend at all — confirms the pipe works independent of any UI bugs.

### Phase 2 — Static twin shell (2–3 days)
- Build the cutaway diagram UI with **mock/hardcoded data** first — get the layout, type, motion, and color right without waiting on live data.
- This is where the design-direction work in Section 2 actually happens.

### Phase 3 — Wire in live data (1 day)
- Replace mock data with the WebSocket feed.
- Handle the unhappy paths explicitly: connection lost, stale data (>30s old), sensor read error — each needs its own visual state, not a silent freeze.

### Phase 4 — What-if simulation layer (1–2 days)
- A control (e.g., a "simulate cloudy day" or "simulate 3 more box openings" slider) that re-runs your existing battery-runway/spoilage math client-side or via a backend endpoint, and shows the projected outcome alongside the live one.
- This is the part that makes it a *twin* rather than a monitor — don't cut this for time; cut polish elsewhere instead.

### Phase 5 — Polish pass + demo hardening (1 day)
- Self-critique per the design skill's restraint principle: screenshot it, remove one thing.
- Test on mobile (in case a reviewer scans a QR code).
- Pre-record a fallback video/GIF of the live demo in case WiFi fails during an actual presentation.

---

## 5. CI/CD Pipeline

Kept intentionally small — this is a portfolio project, not a production service, so the pipeline's job is "catch breakage before a demo," not enterprise-grade release management.

### 5.1 Repo structure
```
/hardware        — ESP32 firmware (.ino / PlatformIO project)
/backend          — MQTT bridge + API
/frontend         — React + Three.js app
/.github/workflows
```

### 5.2 Pipeline stages (GitHub Actions)

**On every push to a feature branch:**
```yaml
name: CI
on: [pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build   # catches build-breaking errors before merge

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd backend && npm ci
      - run: cd backend && npm test          # even 2-3 tests on the MQTT parsing logic catch schema drift
```

**On merge to `main`:**
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build
      - uses: amondnet/vercel-action@v25       # or Vercel's native GitHub integration, which needs no workflow file at all
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          curl -X POST "https://api.render.com/deploy/${{ secrets.RENDER_SERVICE_ID }}?key=${{ secrets.RENDER_DEPLOY_KEY }}"
          # or Fly.io: flyctl deploy --remote-only
```

**Firmware (`/hardware`) is deliberately excluded from CI/CD** — flashing physical hardware from a pipeline is real engineering effort (over-the-air update infra) that adds no story value here. Firmware changes stay manual-flash; only `backend`/`frontend` are automated. Say this explicitly if asked in an interview — it shows you scoped the pipeline to where automation actually pays off, rather than automating everything by default.

### 5.3 Why this scope and not more
A full staging environment, blue-green deploys, or infra-as-code (Terraform) would be over-engineering for a single-demo portfolio piece — and a reviewer who knows CI/CD will read "Terraform for a mini-project" as not understanding when complexity is warranted. The two-stage (lint/build/test → deploy) pipeline is the right size: it proves you understand CI/CD fundamentals without pretending this needs production-grade release engineering.

---

## 6. What to build first if time is short

If you only have time for one thing before a deadline: **Phase 2 (static twin shell with mock data) is more valuable to show than a fully wired but ugly live pipeline.** A recruiter looking at a portfolio link judges the visual/interaction design in the first few seconds — the live-data plumbing matters for the demo, but the design is what gets remembered.
