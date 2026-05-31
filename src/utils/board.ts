import type { Point, BoardState, PieceColor, Capture, MoveMode, Move } from '../types'


export function getPixelCoord(p: Point): { x: number; y: number } {
  const SCALE = 100
  const OFFSET_X = 80
  const OFFSET_Y = 170
  if (p.type === 'diamond' || p.y < 0) {
    const cx = OFFSET_X + 2 * SCALE
    const cy = OFFSET_Y
    if (p.x === 2 && p.y === 0) return { x: cx, y: cy }
    if (p.x === 2 && p.y === -1) return { x: cx, y: cy - SCALE * 0.6 }
    if (p.x === 1 && p.y === -1) return { x: cx - SCALE * 0.8, y: cy - SCALE * 0.6 }
    if (p.x === 3 && p.y === -1) return { x: cx + SCALE * 0.8, y: cy - SCALE * 0.6 }
    if (p.x === 2 && p.y === -2) return { x: cx, y: cy - SCALE * 1.2 }
  }
  return { x: OFFSET_X + p.x * SCALE, y: OFFSET_Y + p.y * SCALE }
}

export function getPointAtPixel(
  mx: number,
  my: number,
  allPoints: Point[]
): Point | null {
  for (const p of allPoints) {
    const pc = getPixelCoord(p)
    if (Math.hypot(pc.x - mx, pc.y - my) < 20) return p
  }
  return null
}

export function countBoardPieces(board: BoardState, color: PieceColor): number {
  let count = 0
  for (const k in board) {
    if (board[k] === color) count++
  }
  return count
}

export function getKey(p: Point): string {
  return `${p.x},${p.y}`
}

export function getPointFromKey(key: string): Point {
  const [x, y] = key.split(',').map(Number)
  return { x, y, type: y < 0 ? 'diamond' : 'main' }
}

export function getNeighbors(p: Point, adj: Record<string, Point[]>): Point[] {
  return adj[getKey(p)] || []
}

export function getLinesThroughPoint(
  p: Point,
  lines: Point[][]
): Point[][] {
  return lines.filter(line => line.some(pt => pt.x === p.x && pt.y === p.y))
}

export function getValidMovesMulti(
  p: Point,
  board: BoardState,
  lines: Point[][]
): Point[] {
  const moves: Point[] = []
  const linesThrough = getLinesThroughPoint(p, lines)
  for (const line of linesThrough) {
    const idx = line.findIndex(pt => pt.x === p.x && pt.y === p.y)
    if (idx === -1) continue
    for (let i = idx - 1; i >= 0; i--) {
      const pt = line[i]
      const k = getKey(pt)
      if (board[k]) break
      moves.push(pt)
    }
    for (let i = idx + 1; i < line.length; i++) {
      const pt = line[i]
      const k = getKey(pt)
      if (board[k]) break
      moves.push(pt)
    }
  }
  const unique: Point[] = []
  const seen = new Set<string>()
  for (const m of moves) {
    const k = getKey(m)
    if (!seen.has(k)) {
      seen.add(k)
      unique.push(m)
    }
  }
  return unique
}

export function getValidMoves(
  p: Point,
  board: BoardState,
  moveMode: MoveMode,
  adj: Record<string, Point[]>,
  lines: Point[][]
): Point[] {
  if (moveMode === 'single') {
    return getNeighbors(p, adj).filter(n => !board[getKey(n)])
  } else {
    return getValidMovesMulti(p, board, lines)
  }
}

export function hasValidMoves(
  player: PieceColor,
  board: BoardState,
  moveMode: MoveMode,
  adj: Record<string, Point[]>,
  lines: Point[][]
): boolean {
  for (const k in board) {
    if (board[k] !== player) continue
    const p = getPointFromKey(k)
    if (getValidMoves(p, board, moveMode, adj, lines).length > 0) return true
  }
  return false
}

export function checkCapture(
  movePoint: Point,
  player: PieceColor,
  board: BoardState,
  lines: Point[][]
): Capture[] {
  const enemy = player === 'black' ? 'white' : 'black'
  const enemyCount = countBoardPieces(board, enemy)
  const linesThrough = getLinesThroughPoint(movePoint, lines)
  const captures: Capture[] = []

  for (const line of linesThrough) {
    const idx = line.findIndex(pt => pt.x === movePoint.x && pt.y === movePoint.y)
    if (idx === -1) continue

    // 夹吃：敌方棋子数量 > 1 时才能夹吃
    if (enemyCount > 1) {
      // 检查左边：己(idx-2)—敌(idx-1)—己(idx)
      if (idx >= 2) {
        const mid = line[idx - 1]
        const far = line[idx - 2]
        if (board[getKey(mid)] === enemy && board[getKey(far)] === player) {
          // 检查延长点：只有当延长点在边界内且有敌方棋子时才阻止吃子
          let blocked = false
          // 右延长点
          if (idx + 1 < line.length && board[getKey(line[idx + 1])] === enemy) {
            blocked = true
          }
          // 左延长点
          if (idx - 3 >= 0 && board[getKey(line[idx - 3])] === enemy) {
            blocked = true
          }
          if (!blocked) captures.push({ type: '夹', points: [mid] })
        }
      }
      // 检查右边：己(idx)—敌(idx+1)—己(idx+2)
      if (idx <= line.length - 3) {
        const mid = line[idx + 1]
        const far = line[idx + 2]
        if (board[getKey(mid)] === enemy && board[getKey(far)] === player) {
          // 检查延长点：只有当延长点在边界内且有敌方棋子时才阻止吃子
          let blocked = false
          // 左延长点
          if (idx - 1 >= 0 && board[getKey(line[idx - 1])] === enemy) {
            blocked = true
          }
          // 右延长点
          if (idx + 3 < line.length && board[getKey(line[idx + 3])] === enemy) {
            blocked = true
          }
          if (!blocked) captures.push({ type: '夹', points: [mid] })
        }
      }
    }

    // 挑吃：敌方棋子数量 > 2 时才能挑吃
    if (enemyCount > 2) {
      if (idx > 0 && idx < line.length - 1) {
        const left = line[idx - 1]
        const right = line[idx + 1]
        if (board[getKey(left)] === enemy && board[getKey(right)] === enemy) {
          // 检查延长点：只有当延长点在边界内且有敌方棋子时才阻止吃子
          let blocked = false
          // 左延长点
          if (idx - 2 >= 0 && board[getKey(line[idx - 2])] === enemy) {
            blocked = true
          }
          // 右延长点
          if (idx + 2 < line.length && board[getKey(line[idx + 2])] === enemy) {
            blocked = true
          }
          if (!blocked) captures.push({ type: '挑', points: [left, right] })
        }
      }
    }
  }
  return captures
}

export function executeCaptures(
  captures: Capture[],
  player: PieceColor,
  board: BoardState,
  reserves: { black: number; white: number }
): boolean {
  const allPts: Point[] = []
  for (const c of captures) allPts.push(...c.points)
  const unique: Point[] = []
  const seen = new Set<string>()
  for (const pt of allPts) {
    const k = getKey(pt)
    if (!seen.has(k)) {
      seen.add(k)
      unique.push(pt)
    }
  }
  if (unique.length === 0) return false
  if (reserves[player] < unique.length) return false
  for (const pt of unique) delete board[getKey(pt)]
  for (const pt of unique) board[getKey(pt)] = player
  reserves[player] -= unique.length
  return true
}

export function executeCapturesWithChain(
  movePoint: Point,
  player: PieceColor,
  board: BoardState,
  reserves: { black: number; white: number },
  lines: Point[][]
): { success: boolean; capturedCount: number } {
  let totalCaptured = 0
  let safetyCounter = 0
  const MAX_CHAIN = 50

  let positionsToCheck: Point[] = [movePoint]

  while (positionsToCheck.length > 0 && safetyCounter < MAX_CHAIN) {
    safetyCounter++
    
    const nextPositionsToCheck: Point[] = []
    
    for (const pos of positionsToCheck) {
      const captures = checkCapture(pos, player, board, lines)
      if (captures.length === 0) continue

      const allPts: Point[] = []
      for (const c of captures) allPts.push(...c.points)
      const unique: Point[] = []
      const seen = new Set<string>()
      for (const pt of allPts) {
        const k = getKey(pt)
        if (!seen.has(k)) {
          seen.add(k)
          unique.push(pt)
        }
      }

      if (unique.length === 0 || reserves[player] < unique.length) continue

      for (const pt of unique) delete board[getKey(pt)]
      for (const pt of unique) board[getKey(pt)] = player
      reserves[player] -= unique.length
      totalCaptured += unique.length

      for (const pt of unique) {
        const newCaptures = checkCapture(pt, player, board, lines)
        if (newCaptures.length > 0) {
          nextPositionsToCheck.push(pt)
        }
      }
    }
    
    positionsToCheck = nextPositionsToCheck
  }

  return { success: totalCaptured > 0, capturedCount: totalCaptured }
}

export function checkWinCondition(
  player: PieceColor,
  board: BoardState,
  adj: Record<string, Point[]>,
  lines: Point[][] = []
): boolean {
  const enemy = player === 'black' ? 'white' : 'black'
  const enemyCount = countBoardPieces(board, enemy)
  
  // 敌方无子，直接获胜
  if (enemyCount === 0) return true
  
  // 规则5.1 围困获胜：敌方剩1子且被困在顶部菱形区域内无法移动
  if (enemyCount === 1) {
    let pos: Point | null = null
    for (const k in board) {
      if (board[k] === enemy) {
        pos = getPointFromKey(k)
        break
      }
    }
    if (pos && pos.y < 0) {  // 必须在菱形区域内
      const neighbors = getNeighbors(pos, adj)
      const canMove = neighbors.some(n => !board[getKey(n)])
      if (!canMove) return true
    }
  }
  
  // 规则5.2 无子可动获胜：敌方>1子但全局无任何棋子可以移动
  if (enemyCount > 1) {
    if (!hasValidMoves(enemy, board, 'single', adj, lines) && 
        !hasValidMoves(enemy, board, 'multi', adj, lines)) {
      return true
    }
  }
  
  return false
}

// 识别夹吃威胁
export function getCaptureThreats(
  player: PieceColor,
  stateBoard: BoardState,
  lines: Point[][],
  _adj: Record<string, Point[]>
): { type: '夹', points: Point[], score: number }[] {
  const threats: { type: '夹', points: Point[], score: number }[] = []
  const enemy = player === 'black' ? 'white' : 'black'
  
  // 遍历所有线条
  for (const line of lines) {
    for (let i = 1; i < line.length - 1; i++) {
      const prev = line[i - 1]
      const curr = line[i]
      const next = line[i + 1]
      
      // 检查 己-空-敌 模式
      if (stateBoard[getKey(prev)] === player && 
          !stateBoard[getKey(curr)] && 
          stateBoard[getKey(next)] === enemy) {
        threats.push({
          type: '夹',
          points: [curr],
          score: 200
        })
      }
      
      // 检查 敌-空-己 模式
      if (stateBoard[getKey(prev)] === enemy && 
          !stateBoard[getKey(curr)] && 
          stateBoard[getKey(next)] === player) {
        threats.push({
          type: '夹',
          points: [curr],
          score: 200
        })
      }
    }
  }
  
  return threats
}

// 识别挑吃威胁
export function getPickThreats(
  player: PieceColor,
  stateBoard: BoardState,
  lines: Point[][],
  _adj: Record<string, Point[]>
): { type: '挑', points: Point[], score: number }[] {
  const threats: { type: '挑', points: Point[], score: number }[] = []
  const enemy = player === 'black' ? 'white' : 'black'
  
  // 遍历所有线条
  for (const line of lines) {
    for (let i = 1; i < line.length - 1; i++) {
      const prev = line[i - 1]
      const curr = line[i]
      const next = line[i + 1]
      
      // 检查 敌-空-敌 模式
      if (stateBoard[getKey(prev)] === enemy && 
          !stateBoard[getKey(curr)] && 
          stateBoard[getKey(next)] === enemy) {
        threats.push({
          type: '挑',
          points: [curr],
          score: 300
        })
      }
    }
  }
  
  return threats
}

// 识别围困威胁
export function getTrapThreats(
  player: PieceColor,
  stateBoard: BoardState,
  adj: Record<string, Point[]>
): { pos: Point, score: number }[] {
  const threats: { pos: Point, score: number }[] = []
  const enemy = player === 'black' ? 'white' : 'black'
  
  // 查找敌方只剩一子的情况
  const enemyPieces = Object.keys(stateBoard).filter(k => stateBoard[k] === enemy)
  if (enemyPieces.length === 1) {
    const pos = getPointFromKey(enemyPieces[0])
    const neighbors = adj[getKey(pos)] || []
    const blocked = neighbors.filter(n => stateBoard[getKey(n)]).length
    
    // 在菱形区域围困
    if (pos.y < 0) {
      threats.push({
        pos,
        score: blocked * 100
      })
    }
  }
  
  return threats
}

// 识别连环吃子机会
export function getChainOpportunities(
  player: PieceColor,
  stateBoard: BoardState,
  lines: Point[][],
  adj: Record<string, Point[]>
): { move: Move, score: number }[] {
  const opportunities: { move: Move, score: number }[] = []
  
  // 遍历所有己方棋子
  for (const k in stateBoard) {
    if (stateBoard[k] !== player) continue
    const from = getPointFromKey(k)
    const targets = getValidMoves(from, stateBoard, 'single', adj, lines)
    
    for (const to of targets) {
      // 模拟移动
      const testBoard = { ...stateBoard }
      testBoard[getKey(to)] = player
      delete testBoard[getKey(from)]
      
      // 检查是否能触发连环吃子
      const captures = checkCapture(to, player, testBoard, lines)
      if (captures.length > 0) {
        opportunities.push({
          move: { from, to },
          score: 250
        })
      }
    }
  }
  
  return opportunities
}

// 走法威胁评分
export function getMoveThreatScore(
  move: Move,
  player: PieceColor,
  stateBoard: BoardState,
  lines: Point[][],
  adj: Record<string, Point[]>
): number {
  let score = 0
  
  // 1. 能吃子的走法 +1000
  const testBoard = { ...stateBoard }
  testBoard[getKey(move.to)] = player
  delete testBoard[getKey(move.from)]
  
  const captures = checkCapture(move.to, player, testBoard, lines)
  if (captures.length > 0) {
    score += 1000 + captures.length * 500
  }
  
  // 2. 能形成夹吃威胁的走法 +200
  const captureThreats = getCaptureThreats(player, testBoard, lines, adj)
  score += captureThreats.length * 200
  
  // 3. 能形成挑吃威胁的走法 +300
  const pickThreats = getPickThreats(player, testBoard, lines, adj)
  score += pickThreats.length * 300
  
  // 4. 占据中心位置 +100
  const centerPoints = ['2,2', '1,2', '3,2', '2,1', '2,3']
  if (centerPoints.includes(getKey(move.to))) {
    score += 100
  }
  
  // 5. 向敌方推进 +50
  if (player === 'black' && move.to.x > move.from.x) {
    score += 50
  }
  if (player === 'white' && move.to.x < move.from.x) {
    score += 50
  }
  
  return score
}

// 走法威胁排序
export function orderMovesByThreat(
  moves: Move[],
  player: PieceColor,
  stateBoard: BoardState,
  lines: Point[][],
  adj: Record<string, Point[]>
): Move[] {
  return moves.sort((a, b) => {
    const scoreA = getMoveThreatScore(a, player, stateBoard, lines, adj)
    const scoreB = getMoveThreatScore(b, player, stateBoard, lines, adj)
    return scoreB - scoreA
  })
}