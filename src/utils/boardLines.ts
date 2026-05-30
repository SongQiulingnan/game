import type { Point } from '../types'

export function createAdjacencyList(): Record<string, Point[]> {
  const adj: Record<string, Point[]> = {}

  function addEdge(p1: Point, p2: Point) {
    const k1 = `${p1.x},${p1.y}`
    const k2 = `${p2.x},${p2.y}`
    if (!adj[k1]) adj[k1] = []
    if (!adj[k2]) adj[k2] = []
    const exists = adj[k1].some(p => p.x === p2.x && p.y === p2.y)
    if (!exists) {
      adj[k1].push({ x: p2.x, y: p2.y, type: p2.y < 0 ? 'diamond' : 'main' })
      adj[k2].push({ x: p1.x, y: p1.y, type: p1.y < 0 ? 'diamond' : 'main' })
    }
  }

  // 主棋盘连线
  // 横线
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 4; i++) addEdge({ x: i, y: j, type: 'main' }, { x: i + 1, y: j, type: 'main' })
  }
  // 竖线
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) addEdge({ x: i, y: j, type: 'main' }, { x: i, y: j + 1, type: 'main' })
  }
  // 主对角线（斜率+1）
  for (let i = 0; i < 4; i++) addEdge({ x: i, y: i, type: 'main' }, { x: i + 1, y: i + 1, type: 'main' })
  // 副对角线（斜率-1）
  for (let i = 0; i < 4; i++) addEdge({ x: 4 - i, y: i, type: 'main' }, { x: 3 - i, y: i + 1, type: 'main' })

  // 中菱形连线
  addEdge({ x: 0, y: 2, type: 'main' }, { x: 1, y: 1, type: 'main' })
  addEdge({ x: 1, y: 1, type: 'main' }, { x: 2, y: 0, type: 'main' })
  addEdge({ x: 2, y: 0, type: 'main' }, { x: 3, y: 1, type: 'main' })
  addEdge({ x: 3, y: 1, type: 'main' }, { x: 4, y: 2, type: 'main' })
  addEdge({ x: 4, y: 2, type: 'main' }, { x: 3, y: 3, type: 'main' })
  addEdge({ x: 3, y: 3, type: 'main' }, { x: 2, y: 4, type: 'main' })
  addEdge({ x: 2, y: 4, type: 'main' }, { x: 1, y: 3, type: 'main' })
  addEdge({ x: 1, y: 3, type: 'main' }, { x: 0, y: 2, type: 'main' })

  // 顶部菱形连线
  addEdge({ x: 2, y: 0, type: 'main' }, { x: 2, y: -1, type: 'diamond' })
  addEdge({ x: 2, y: -1, type: 'diamond' }, { x: 2, y: -2, type: 'diamond' })
  addEdge({ x: 1, y: -1, type: 'diamond' }, { x: 2, y: -1, type: 'diamond' })
  addEdge({ x: 2, y: -1, type: 'diamond' }, { x: 3, y: -1, type: 'diamond' })
  addEdge({ x: 2, y: -2, type: 'diamond' }, { x: 1, y: -1, type: 'diamond' })
  addEdge({ x: 2, y: -2, type: 'diamond' }, { x: 3, y: -1, type: 'diamond' })
  addEdge({ x: 1, y: -1, type: 'diamond' }, { x: 2, y: 0, type: 'main' })
  addEdge({ x: 3, y: -1, type: 'diamond' }, { x: 2, y: 0, type: 'main' })

  return adj
}

export function createLines(): Point[][] {
  const lines: Point[][] = []

  // 横线（5条）
  for (let j = 0; j < 5; j++) {
    const line: Point[] = []
    for (let i = 0; i < 5; i++) line.push({ x: i, y: j, type: 'main' })
    lines.push(line)
  }
  // 竖线（5条）
  for (let i = 0; i < 5; i++) {
    const line: Point[] = []
    for (let j = 0; j < 5; j++) line.push({ x: i, y: j, type: 'main' })
    lines.push(line)
  }
  // 主对角线（斜率+1）
  lines.push([
    { x: 0, y: 0, type: 'main' },
    { x: 1, y: 1, type: 'main' },
    { x: 2, y: 2, type: 'main' },
    { x: 3, y: 3, type: 'main' },
    { x: 4, y: 4, type: 'main' },
  ])
  // 副对角线（斜率-1）
  lines.push([
    { x: 4, y: 0, type: 'main' },
    { x: 3, y: 1, type: 'main' },
    { x: 2, y: 2, type: 'main' },
    { x: 1, y: 3, type: 'main' },
    { x: 0, y: 4, type: 'main' },
  ])
  // 中菱形四条边
  lines.push([
    { x: 0, y: 2, type: 'main' },
    { x: 1, y: 1, type: 'main' },
    { x: 2, y: 0, type: 'main' },
  ])
  lines.push([
    { x: 2, y: 0, type: 'main' },
    { x: 3, y: 1, type: 'main' },
    { x: 4, y: 2, type: 'main' },
  ])
  lines.push([
    { x: 4, y: 2, type: 'main' },
    { x: 3, y: 3, type: 'main' },
    { x: 2, y: 4, type: 'main' },
  ])
  lines.push([
    { x: 2, y: 4, type: 'main' },
    { x: 1, y: 3, type: 'main' },
    { x: 0, y: 2, type: 'main' },
  ])
  // 菱形线
  lines.push([
    { x: 2, y: -2, type: 'diamond' },
    { x: 2, y: -1, type: 'diamond' },
    { x: 2, y: 0, type: 'main' },
  ])
  lines.push([
    { x: 1, y: -1, type: 'diamond' },
    { x: 2, y: -1, type: 'diamond' },
    { x: 3, y: -1, type: 'diamond' },
  ])
  lines.push([
    { x: 2, y: -2, type: 'diamond' },
    { x: 1, y: -1, type: 'diamond' },
  ])
  lines.push([
    { x: 2, y: -2, type: 'diamond' },
    { x: 3, y: -1, type: 'diamond' },
  ])
  lines.push([
    { x: 1, y: -1, type: 'diamond' },
    { x: 2, y: 0, type: 'main' },
  ])
  lines.push([
    { x: 3, y: -1, type: 'diamond' },
    { x: 2, y: 0, type: 'main' },
  ])

  return lines
}