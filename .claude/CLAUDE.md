# claw-koshien-2026 — Project Rules

## Overview
Real-time 3D visualization of AI agent collaboration for OpenClaw Agent Championship. Renders a virtual office where agents work at desks, with live WebSocket state streaming.

## Tech Stack
- Vite 6 + TypeScript 5 (ES modules)
- Three.js 0.170 + GSAP 3.12 for 3D scene and animations
- Bun runtime for relay server and session API (`relay/`)
- No framework — vanilla TS with custom scene/camera/overlay modules under `src/`

## Key Notes
- `bun dev` starts the Vite frontend; `bun run relay` and `bun run session-api` are separate Bun processes that must run alongside it
- Source is organized by concern: `src/scene/`, `src/camera/`, `src/ui/`, `src/overlay/`, `src/data/`, `src/video/`
- Package manager: `bun` (lockfile: `bun.lock`)
