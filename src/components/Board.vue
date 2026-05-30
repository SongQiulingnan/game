<template>
  <div class="board-container" ref="containerRef">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      @click="handleClick"
      @touchend.prevent="handleTouch"
    ></canvas>
    <div class="pieces-layer">
      <div
        v-for="piece in pieces"
        :key="piece.id"
        class="piece"
        :class="[piece.color, { selected: piece.selected }]"
        :style="{
          left: `${piece.x - pieceSize / 2}px`,
          top: `${piece.y - pieceSize / 2}px`,
          width: `${pieceSize}px`,
          height: `${pieceSize}px`,
        }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import type { Point, BoardState, PieceColor, MoveMode } from '../types'
import { getValidMoves, getKey } from '../utils/board'

interface Props {
  board: BoardState
  selectedPiece: Point | null
  currentPlayer: PieceColor
  moveMode: MoveMode
  revivalMode: boolean
  gameOver: boolean
  allPoints: Point[]
  adj: Record<string, Point[]>
  lines: Point[][]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', point: Point): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

// 响应式尺寸
const containerWidth = ref(560)
const displayScale = ref(1)
const scale = computed(() => Math.max(0.2, containerWidth.value / 560))
const canvasWidth = computed(() => Math.round(560 * scale.value))
const canvasHeight = computed(() => Math.round(620 * scale.value))
const logicalPieceSize = computed(() => Math.max(10, Math.round(26 * scale.value)))
const pieceSize = computed(() => Math.max(10, Math.round(logicalPieceSize.value * displayScale.value)))

// 响应式坐标计算
function getScaledPixelCoord(p: Point): { x: number; y: number } {
  const baseScale = 100 * scale.value
  const offsetX = 80 * scale.value
  const offsetY = 170 * scale.value

  if (p.type === 'diamond' || p.y < 0) {
    const cx = offsetX + 2 * baseScale
    const cy = offsetY
    if (p.x === 2 && p.y === 0) return { x: cx, y: cy }
    if (p.x === 2 && p.y === -1) return { x: cx, y: cy - baseScale * 0.6 }
    if (p.x === 1 && p.y === -1) return { x: cx - baseScale * 0.8, y: cy - baseScale * 0.6 }
    if (p.x === 3 && p.y === -1) return { x: cx + baseScale * 0.8, y: cy - baseScale * 0.6 }
    if (p.x === 2 && p.y === -2) return { x: cx, y: cy - baseScale * 1.2 }
  }
  return { x: offsetX + p.x * baseScale, y: offsetY + p.y * baseScale }
}

function getScaledPointAtPixel(mx: number, my: number): Point | null {
  for (const p of props.allPoints) {
    const pc = getScaledPixelCoord(p)
    if (Math.hypot(pc.x - mx, pc.y - my) < 20 * scale.value) return p
  }
  return null
}

interface PieceInfo {
  id: number
  x: number
  y: number
  color: PieceColor
  selected: boolean
}

const piecesMap = ref<Map<number, PieceInfo>>(new Map())
const positionToId = ref<Map<string, number>>(new Map())
let nextPieceId = 1

function syncPieces(newBoard: BoardState) {
  const newPositionToId = new Map<string, number>()
  const usedIds = new Set<number>()

  for (const k in newBoard) {
    const [x, y] = k.split(',').map(Number)
    const point: Point = { x, y, type: y < 0 ? 'diamond' : 'main' }
    const pc = getScaledPixelCoord(point)
    const color = newBoard[k]
    const isSelected = props.selectedPiece?.x === x && props.selectedPiece?.y === y

    let pieceId = positionToId.value.get(k)
    
    if (pieceId !== undefined) {
      const existingPiece = piecesMap.value.get(pieceId)
      if (existingPiece && existingPiece.color === color) {
        existingPiece.x = pc.x
        existingPiece.y = pc.y
        existingPiece.selected = isSelected
        newPositionToId.set(k, pieceId)
        usedIds.add(pieceId)
        continue
      }
    }

    let foundMovedPiece = false
    for (const [prevPos, prevId] of positionToId.value.entries()) {
      if (prevPos === k) continue
      if (usedIds.has(prevId)) continue
      
      const prevPiece = piecesMap.value.get(prevId)
      if (prevPiece && prevPiece.color === color && !newBoard[prevPos]) {
        prevPiece.x = pc.x
        prevPiece.y = pc.y
        prevPiece.selected = isSelected
        newPositionToId.set(k, prevId)
        usedIds.add(prevId)
        foundMovedPiece = true
        break
      }
    }

    if (!foundMovedPiece) {
      const newId = nextPieceId++
      piecesMap.value.set(newId, {
        id: newId,
        x: pc.x,
        y: pc.y,
        color,
        selected: isSelected,
      })
      newPositionToId.set(k, newId)
      usedIds.add(newId)
    }
  }

  for (const [id] of piecesMap.value.entries()) {
    if (!usedIds.has(id)) {
      piecesMap.value.delete(id)
    }
  }

  positionToId.value = newPositionToId
}

watch(
  () => [props.board, props.selectedPiece],
  () => { syncPieces(props.board) },
  { deep: true, immediate: true }
)

const pieces = computed<PieceInfo[]>(() => {
  const s = displayScale.value
  return Array.from(piecesMap.value.values()).map(piece => ({
    ...piece,
    x: piece.x * s,
    y: piece.y * s,
  }))
})

function draw() {
  if (!ctx || !canvasRef.value) return

  const canvas = canvasRef.value
  if (canvas.width === 0 || canvas.height === 0) return

  const s = scale.value

  ctx.fillStyle = '#d4a574'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = '#3e2723'
  ctx.lineWidth = 2 * s
  const drawn = new Set<string>()
  for (const k1 in props.adj) {
    const [x1, y1] = k1.split(',').map(Number)
    const p1 = getScaledPixelCoord({ x: x1, y: y1, type: y1 < 0 ? 'diamond' : 'main' })
    for (const nb of props.adj[k1]) {
      const k2 = getKey(nb)
      const edge = [k1, k2].sort().join('-')
      if (drawn.has(edge)) continue
      drawn.add(edge)
      const p2 = getScaledPixelCoord(nb)
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    }
  }

  ctx.fillStyle = '#5d4037'
  for (const p of props.allPoints) {
    const pc = getScaledPixelCoord(p)
    ctx.beginPath()
    ctx.arc(pc.x, pc.y, 5 * s, 0, Math.PI * 2)
    ctx.fill()
  }

  if (!props.gameOver) {
    if (props.revivalMode) {
      ctx.fillStyle = 'rgba(104, 211, 145, 0.45)'
      for (const p of props.allPoints.filter(p => p.y >= 0)) {
        if (!props.board[getKey(p)]) {
          const pc = getScaledPixelCoord(p)
          ctx.beginPath()
          ctx.arc(pc.x, pc.y, 16 * s, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else if (props.selectedPiece) {
      const targets = getValidMoves(props.selectedPiece, props.board, props.moveMode, props.adj, props.lines)
      ctx.fillStyle = 'rgba(251, 211, 141, 0.45)'
      for (const t of targets) {
        const pc = getScaledPixelCoord(t)
        ctx.beginPath()
        ctx.arc(pc.x, pc.y, 16 * s, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function updateDisplayScale() {
  if (canvasRef.value && canvasWidth.value > 0) {
    const rect = canvasRef.value.getBoundingClientRect()
    displayScale.value = Math.max(0.1, rect.width / canvasWidth.value)
  }
}

function handleClick(e: MouseEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const mx = (e.clientX - rect.left) / displayScale.value
  const my = (e.clientY - rect.top) / displayScale.value
  const clicked = getScaledPointAtPixel(mx, my)
  if (clicked) {
    emit('select', clicked)
  }
}

function handleTouch(e: TouchEvent) {
  if (!canvasRef.value || !e.changedTouches.length) return
  const rect = canvasRef.value.getBoundingClientRect()
  const touch = e.changedTouches[0]
  const mx = (touch.clientX - rect.left) / displayScale.value
  const my = (touch.clientY - rect.top) / displayScale.value
  const clicked = getScaledPointAtPixel(mx, my)
  if (clicked) {
    emit('select', clicked)
  }
}

function updateSize() {
  if (containerRef.value) {
    const maxWidth = Math.max(200, Math.min(window.innerWidth - 32, 560))
    containerWidth.value = maxWidth
    nextTick(updateDisplayScale)
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateSize()
  window.addEventListener('resize', updateSize)
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    syncPieces(props.board)
    
    resizeObserver = new ResizeObserver(() => {
      updateDisplayScale()
      nextTick(draw)
    })
    resizeObserver.observe(canvasRef.value)
    
    nextTick(draw)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

watch(
  () => [props.board, props.selectedPiece, props.revivalMode, props.gameOver],
  () => {
    nextTick(draw)
  },
  { deep: true }
)
</script>

<style scoped>
.board-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

canvas {
  display: block;
  cursor: pointer;
  border-radius: 4px;
  max-width: 100%;
  touch-action: none;
}

.pieces-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.piece {
  position: absolute;
  border-radius: 50%;
  transition: left 0.5s ease-out, top 0.5s ease-out;
  pointer-events: none;
}

.piece.black {
  background: radial-gradient(circle at 35% 35%, #4a5568, #1a202c);
  border: 2px solid #a0aec0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.piece.white {
  background: radial-gradient(circle at 35% 35%, #ffffff, #e2e8f0);
  border: 2px solid #718096;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.piece.selected {
  box-shadow: 0 0 0 3px #c05621, 0 4px 8px rgba(0, 0, 0, 0.3);
}
</style>