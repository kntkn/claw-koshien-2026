# Claw Koshien 2026

Real-time 3D visualization of AI agent collaboration, built for OpenClaw Agent Championship.

## Features

- **3D Office Scene** — Inspired.Lab (Otemachi, Tokyo) style environment with PBR textures, Edison bulb grid with Bloom post-processing, HDRI environment lighting
- **Hologram Agents** — Translucent holographic figures at each desk, color-coded by status (working/thinking/idle)
- **Live Broadcast Bar** — esports-style overlay with scrolling activity ticker and LIVE indicator
- **Japanese Dashboard** — Real-time agent status, tool usage, and external service detection (Slack, GitHub, Notion, etc.)
- **Session API Relay** — Parses OpenClaw agent session logs and serves state as JSON

## Quick Start

```bash
# Install dependencies
bun install

# Start the 3D viewer
bun run dev

# Start the session API relay (reads agent session files)
bun run session-api
```

Open `http://localhost:5173/?openclaw` in your browser.

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `?openclaw` | Live mode — polls session API for real agent data (default) |
| `?mock` | Mock data mode — generates random agent activity |

## Architecture

```
src/
├── main.ts                 # Entry point, render loop
├── scene/
│   ├── Office.ts           # 3D environment (walls, floor, ceiling, furniture)
│   ├── PostProcessing.ts   # Bloom + EffectComposer
│   ├── TextureManager.ts   # PBR texture loading & caching
│   ├── HologramAgent.ts    # Holographic agent figures
│   ├── Desk.ts             # Individual desk with monitor, chair, LED
│   └── DeskManager.ts      # Desk layout manager
├── ui/
│   ├── Dashboard.ts        # Right panel with agent cards
│   ├── BroadcastBar.ts     # Top broadcast overlay
│   ├── EventBanner.ts      # Event title banner
│   └── i18n.ts             # Japanese tool/status translations
├── data/
│   ├── StateManager.ts     # Central state store
│   ├── OpenClawFeeder.ts   # Polls session API for live data
│   └── MockData.ts         # Mock data generator
├── camera/
│   ├── CameraController.ts # Orbit controls + desk focus
│   └── AutoTour.ts         # Automatic camera tour
└── video/
    ├── StreamManager.ts    # Video stream management
    └── VideoTexturePool.ts # Video-to-texture mapping

relay/
├── server.ts               # WebSocket relay server
└── session-api.ts          # HTTP API parsing agent session files
```

## Tech Stack

- **Three.js** r170 — 3D rendering
- **Vite** — Build tooling
- **Bun** — Runtime & package manager
- **GSAP** — UI animations
- **Poly Haven** — CC0 PBR textures & HDRI

## Textures

PBR textures from [Poly Haven](https://polyhaven.com/) (CC0 license):
- Brick: `red_brick_03`
- Wood: `herringbone_parquet`
- Leather: `fabric_leather_01`
- Concrete: `concrete_floor_02`
- Metal: `rusty_metal_02`
- HDRI: `brown_photostudio_02`

## License

MIT
