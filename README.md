# NILE QUEST — From Cairo to the World

**v1.4:** 日本語/English切替、全15問の英語翻訳、ライト/ダークモード。設定はブラウザに保存されます。

**A working, original-design geography adventure for a live developer interview.**

A 5-stage browser game that starts in Cairo and ends in Tokyo.


 Players create an account, answer 15 geography/culture questions, unlock stages and collect stamps in a digital passport. The client never determines correct answers or awards points: the server does.

## What works

- Five destinations: Egypt → Türkiye → Italy → France → Japan
- 15 curated Japanese-language questions and explanations (3 per stage)
- Account registration, login, logout, seven-day HTTP-only cookies
- Passwords stored with Node `scrypt` + random per-user salt, not plaintext
- Server-validated questions, scores, stage access and timed answers (the next timer begins only after pressing “Next question”)
- Persistent SQLite database for users, sessions, answers, runs and best scores
- Digital passport, progress dashboard, worldwide leaderboard
- Actual Open-Meteo external weather API integration, with 10-minute cache, 8s timeout, backend diagnostics, browser-side HTTPS fallback and manual retry (never fake live temperatures)
- Responsive desktop/mobile interface with handcrafted CSS, SVG artwork, interactive CSS 3D depth/parallax and reduced-motion support
- Security headers, origin checks, rate limits and parameterized SQL
- Automated unit + end-to-end API tests via Node's built-in test runner
- Verified browser interaction: registration → login → chapter → three answers → unlock → passport → ranking

## Why no `npm install` is required

This version is designed to be a **reliable, zero third-party runtime dependency** interview demo. The front end uses standard browser JavaScript, semantic HTML and custom CSS/SVG. The API, cryptography, HTTP server and SQLite database all use Node.js built-ins. It intentionally does not depend on React, Tailwind, Express, or a hosted auth/DB account. This makes it fully portable and avoids exposing API keys in the repo.

Node.js **22.13+** is required. Node 22 uses the built-in SQLite module behind `--experimental-sqlite`; the start scripts include that flag. Node 24 also works.

## Run locally

```bash
node --version # >= 22.13
npm test
npm start
# open http://localhost:3000
```

No library installation step is needed. The first run creates `./data/nile-quest.sqlite` and its database schema automatically. The `.gitignore` excludes all local data and credentials.

## Optional demo login for interview reviewers

Set these environment variables on the **hosting platform**, never in the repo:

```text
DEMO_EMAIL=reviewer@example.com
DEMO_PASSWORD=<generate a strong unique password of at least 12 characters>
DEMO_NAME=Demo Explorer
```

The demo user is created the first time the app starts. For a public interview, create a separate test account, use it only for reviewing and rotate/revoke it after the assessment. Public sign-up is enabled. Never use actual student or customer records.

## Deployment: isolated game environment only

**Never connect this app to an existing Skolivio project, volume, database, or service.** The code needs its own brand-new hosting project and persistent storage. GitHub Pages alone cannot run the Node API. Choose a Node/Docker host with a persistent disk (for example, a separate Render paid Web Service with a persistent disk, or a brand-new Railway project if the owner explicitly chooses it). The host may charge fees.

### If you independently choose Railway (persistent)

1. Create a **brand-new Railway project** named `nile-quest-web` (never reuse the Skolivio project), and connect the separate GitHub repository.
2. Make a Railway service with this repo; the start command is `npm start`. A Dockerfile is included for reproducible builds.
3. **Add a persistent Railway Volume mounted at `/data`.** Without this, the SQLite file could disappear on a new deployment.
4. Set `DATA_DIR=/data`, `NODE_ENV=production`, `DEMO_EMAIL`, and `DEMO_PASSWORD` as service variables.
5. Generate a Railway public domain and verify `/health` and all four interview requirements in an incognito window.
6. Run with **one application replica** while using the local SQLite volume; a volume cannot be shared between multiple independent replicas.
7. On the live environment, run the independent smoke test shown below. This writes a test run to the dedicated NILE QUEST demo account only.

```bash
TEST_URL=https://your-game-domain DEMO_EMAIL=reviewer@example.com DEMO_PASSWORD=your-demo-password npm run verify:live
```

The repository does not include secrets. **The code being public on GitHub is different from having a live web application URL.** The public address comes from a hosting platform after successful deployment.

## API endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Health probe |
| GET | `/api/session` | No | Current signed-in state |
| POST | `/api/auth/register` | No | Create an account |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | No | Logout |
| GET | `/api/world` | Yes | Stages and personal progress |
| GET | `/api/weather?stage=egypt` | No | External weather service |
| GET | `/api/leaderboard` | No | Leaderboard |
| GET | `/api/runs/history` | Yes | Recent runs |
| POST | `/api/runs/start` | Yes | Start a stage |
| POST | `/api/runs/answer` | Yes | Answer a question, store score |
| POST | `/api/runs/next` | Yes | Start the next question timer after reviewing feedback |

## Project structure

```text
nile-quest-web/
├── public/
│   ├── index.html       # App shell, accessible structure
│   ├── styles.css       # Original responsive interface
│   ├── app.js           # Browser app state and rendering
│   ├── world.svg        # Hand-authored vector route map
│   └── favicon.svg
├── src/
│   ├── server.mjs       # HTTP API, auth, security, score lifecycle
│   ├── db.mjs           # SQLite schema, password hashing, sessions
│   └── game.mjs         # Curated questions, stages, scoring rules
├── tests/
│   └── game.test.mjs    # Game rules, auth, full 5-stage playthrough
├── Dockerfile
├── package.json
└── .env.example
```

## Interview explanation (15 minutes)

1. **Why (2 min)** — I'm Egyptian by heritage and grew up in Japan, so I wanted a game about learning across cultures.
2. **User problem (2 min)** — Learning about other countries is often presented as memorization. Here it feels like a journey with immediate feedback.
3. **Live demo (6 min)** — Demo login → answer questions → stage unlock → see live Cairo weather → passport and leaderboard.
4. **Architecture (3 min)** — Node HTTP API, SQLite schema, session cookies, server-authoritative scoring and Open-Meteo integration. Explain why zero dependencies simplified a small interview project.
5. **Challenges and next steps (2 min)** — Replay prevention and unlock logic, graceful API failure, polished mobile layout; future localization and wider destinations.

## Open-Meteo

The forecast endpoint uses <https://api.open-meteo.com/v1/forecast>, current variables `temperature_2m`, `relative_humidity_2m`, `weather_code` and `wind_speed_10m`. Attribution is displayed in the UI. Usage must comply with Open-Meteo's API terms (free-tier intended for non-commercial use).

## License

MIT. The quiz content and handmade CSS/SVG were produced for this demo. No real-school data or private code from Skolivio is included.

## Publish to YOUR public GitHub repository

The script below creates **a new public repository**, verifies that your GitHub account is `Alyaaant`, and stops rather than modifying an existing repository. It never contains or commits interview credentials.

```bash
# On your Mac, first unzip this project and enter its directory:
cd nile-quest-web
# Install GitHub CLI if needed:
brew install gh
# Complete the GitHub browser login if needed:
gh auth login
# Run local checks and publish a new public repo:
bash scripts/publish-github.sh
```

Expected code URL: `https://github.com/Alyaaant/nile-quest-web` **only after GitHub confirms creation**.

Publishing code does **not** deploy the interactive site. Connect that repository to Railway, attach a persistent volume, set safe environment variables, and generate the live domain. Hosting services may have usage charges; review their pricing before enabling any billable resources.

## Pre-submission verification

See [公開前チェックリスト](docs/公開前チェックリスト.md). Do not submit the game to interviewers unless the **live public URL** is confirmed to save scores and log back in across a restart.

## Japanese presentation notes

See [`docs/面接発表メモ.md`](docs/面接発表メモ.md) for a natural 5-minute self-introduction, a 15-minute live-demo presentation plan, and likely technical questions with answer outlines.

## Weather troubleshooting on macOS

The endpoint `GET /api/weather?stage=italy` requests Open-Meteo on the server. If the server cannot reach it (DNS/TLS/network/timeout), the browser makes a second API request directly to `api.open-meteo.com`, permitted by the CSP. The page shows an explicit retry button if both networks fail; it never invents weather data.

To diagnose, open `http://localhost:3000/api/weather?stage=italy`, then check your terminal for a `[weather]` warning and run `curl -I https://api.open-meteo.com` from the Mac. A browser extension or firewall might also block Open-Meteo. A successful live fetch from your actual network is needed before the interview.

3D effects use vanilla CSS `perspective`, `transform-style:preserve-3d` and pointer parallax. They are intentionally lightweight and respect reduced-motion settings; no image-only imitation of 3D and no additional npm libraries.
