# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**挑夹棋 (TiaoJiaQi)** — a traditional Chinese folk board game. Vue 3 + TypeScript + Vite, zero runtime dependencies beyond Vue itself. No router, no state management library, no UI framework.

## Commands

```bash
npm run dev      # Start dev server (--host for LAN access)
npm run build    # Type-check (vue-tsc) then production build (vite)
npm run preview  # Preview production build locally
npm run lint     # ESLint with auto-fix
npm run format   # Prettier on src/
```

## Architecture

### State management: composable pattern (no Pinia/Vuex)

All game state lives in `useGame()` (`src/composables/useGame.ts`). `App.vue` calls it, destructures the returned refs/methods, and passes them as props to five child components. Components emit events back up; App.vue wires them to the game methods. There is no global store — `useGame()` is called exactly once.

### Game logic pipeline (the critical flow)

A player click on the board triggers this chain across three files:

1. **`Board.vue`** — converts pixel coordinates to a grid point, emits `cell-click`
2. **`useGame.ts: handleBoardClick()`** — orchestrates the full turn:
   - If no piece selected → select own piece (or enter revival mode if trapped in diamond)
   - If piece already selected → validate the move, execute it, run captures, check win
   - Advances turn, triggers AI if enabled
3. **`src/utils/board.ts`** — pure functions for all board logic:
   - Movement validation (`getValidMoves`, `getValidMovesMulti`)
   - Capture detection (`checkCapture` — clamp and pick mechanics)
   - Chain captures (`executeCapturesWithChain` — recursive, max 50 iterations)
   - Win detection (`checkWinCondition` — trap win, no-moves win, elimination)
4. **`src/utils/boardLines.ts`** — the board topology:
   - `createAdjacencyList()` — undirected graph of all valid edges (horizontal, vertical, diagonals, diamond connections)
   - `createLines()` — 22 collinear point arrays used for capture detection

### AI architecture

`src/composables/useAI.ts` (~965 lines) implements 7 difficulty levels ("新手" through "宗师"):

- Each level is an `AILevelConfig` with: search depth (0–6), evaluation function type, thinking time, random factor, feature flags
- 7 evaluation functions of increasing sophistication: `evaluateRandom` → `evaluateGreedy` → `evaluateBasic` → `evaluateStandard` → `evaluateAdvanced` → `evaluateMaster` → `evaluateThreat`
- **Minimax with alpha-beta pruning** and a transposition table
- **Iterative deepening** with configurable time limits per level
- **Move ordering** by capture count and position value for better pruning
- Cancel token support for aborting in-progress AI computation
- `useGame.ts` delegates to `makeAIMove()` asynchronously, showing "AI thinking" state

### Two movement modes

- **Single-step** (`MoveMode.single`): pieces move to adjacent connected points only
- **Multi-step** (`MoveMode.multi`): pieces slide any distance along a straight line (like a rook)

### Capture mechanics

- **Clamp capture (挑/夹)**: two enemy pieces on opposite sides of a line sandwich your piece → you capture both
- **Pick capture**: one enemy piece between two of yours → you capture it
- Captures chain: after capturing, the board is re-evaluated for new captures (up to 50 iterations)

### Revival mechanic

When a player has 1 piece left that can't move from the diamond area, they enter revival mode — they can place a reserve piece on any empty diamond point instead of moving.

### Board rendering

`Board.vue` uses a **Canvas 2D** context for the static board (lines, intersection dots) with **HTML `<div>` elements** overlaid for pieces. This hybrid approach gives smooth CSS transitions (0.5s ease-out) on piece movement. Piece positions are tracked with ID-based diffing to minimize DOM mutations. Responsive scaling via `ResizeObserver`.

### Key constants

`src/utils/constants.ts` defines: `SCALE`, `OFFSET_X`, `OFFSET_Y`, `POSITION_VALUES` (heuristic position scores for AI), `MAIN_POINTS` (5×5 grid), `DIAMOND_POINTS` (4 diamond area points), and `ALL_POINTS`.

### AI-vs-AI spectator mode

Managed in `useGame.ts` with scheduled timers. Each side can have independent difficulty levels. Speed controls: slow (1.5s), normal (0.8s), fast (0.3s), ultra-fast (0.05s).

### Draw detection

Threefold repetition (same board state appears 3 times) or 200-move limit triggers a draw.

## Code style

- Prettier: no semicolons, single quotes, trailing commas, 100 char width, arrow parens avoided
- ESLint: `vue/multi-word-component-names` disabled (components are single-word)
- Vue SFCs use `<script setup lang="ts">` throughout
