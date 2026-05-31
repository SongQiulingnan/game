import { ref } from 'vue'
import type { PieceColor, BoardState, Point, Move, Reserves, AILevel, AILevelConfig } from '../types'
import { POSITION_VALUES, MAIN_POINTS } from '../utils/constants'
import {
  countBoardPieces,
  getKey,
  getPointFromKey,
  getValidMoves,
  hasValidMoves,
  executeCapturesWithChain,
  checkCapture,
  checkWinCondition,
  getCaptureThreats,
  getPickThreats,
  getTrapThreats,
  getChainOpportunities,
  orderMovesByThreat,
} from '../utils/board'
import type { Ref } from 'vue'

export const AI_LEVELS: Record<AILevel, AILevelConfig> = {
  1: {
    name: '新手',
    description: '几乎乱下，很容易输',
    depth: 0,
    thinkingTime: 10,
    evaluationType: 'random',
    moveOrdering: false,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 1.0
  },
  2: {
    name: '入门',
    description: '只会看眼前，经常失误',
    depth: 1,
    thinkingTime: 15,
    evaluationType: 'greedy',
    moveOrdering: false,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0.5
  },
  3: {
    name: '初级',
    description: '能预判一步，偶尔犯错',
    depth: 2,
    thinkingTime: 20,
    evaluationType: 'basic',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0.35
  },
  4: {
    name: '中级',
    description: '能预判两三步，较少失误',
    depth: 3,
    thinkingTime: 30,
    evaluationType: 'standard',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0.2
  },
  5: {
    name: '高级',
    description: '攻防兼备，很少犯错',
    depth: 4,
    thinkingTime: 50,
    evaluationType: 'advanced',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0.1
  },
  6: {
    name: '大师',
    description: '深谋远虑，几乎不犯错',
    depth: 5,
    thinkingTime: 80,
    evaluationType: 'master',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0
  },
  7: {
    name: '宗师',
    description: '战术大师，主动制造威胁',
    depth: 6,
    thinkingTime: 120,
    evaluationType: 'threat',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0
  }
}

export function useAI(
  board: Ref<BoardState>,
  reserves: Ref<Reserves>,
  currentPlayer: Ref<PieceColor>,
  moveMode: Ref<'single' | 'multi'>,
  adj: Record<string, Point[]>,
  lines: Point[][],
  boardHistory?: Ref<string[]>
) {
  const aiEnabled = ref(true)
  const aiPlayer = ref<PieceColor>('white')
  const aiLevel = ref<AILevel>(4)
  const aiThinking = ref(false)
  const aiCancelToken = ref(0)

  // 兼容旧的aiDepth
  const aiDepth = ref(3)

  // 置换表
  const transpositionTable = new Map<string, { 
    score: number, 
    depth: number, 
    flag: 'exact' | 'lower' | 'upper' 
  }>()

  // AI走法历史记录 - 记录每个位置被下的次数
  const aiMoveHistory = ref<Map<string, number>>(new Map())
  
  // AI棋子移动记录 - 记录每个棋子被移动的次数
  const aiPieceMoveCount = ref<Map<string, number>>(new Map())

  function getConfig(): AILevelConfig {
    return AI_LEVELS[aiLevel.value]
  }

  // 置换表查找
  function lookupTranspositionTable(
    hash: string, 
    depth: number, 
    alpha: number, 
    beta: number
  ): number | null {
    const entry = transpositionTable.get(hash)
    if (!entry || entry.depth < depth) return null
    
    if (entry.flag === 'exact') return entry.score
    if (entry.flag === 'lower' && entry.score >= beta) return entry.score
    if (entry.flag === 'upper' && entry.score <= alpha) return entry.score
    
    return null
  }

  // 置换表存储
  function storeTranspositionTable(
    hash: string, 
    depth: number, 
    score: number, 
    flag: 'exact' | 'lower' | 'upper'
  ) {
    transpositionTable.set(hash, { score, depth, flag })
  }

  // 生成局面哈希
  function getBoardHash(stateBoard: BoardState, player: PieceColor): string {
    const keys = Object.keys(stateBoard).sort()
    return keys.map(k => `${k}:${stateBoard[k]}`).join('|') + `|turn:${player}`
  }

  // 随机评估函数
  function evaluateRandom(): number {
    return Math.random() * 100 - 50
  }

  // 贪心评估函数 - 关注吃子和简单位置
  function evaluateGreedy(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    const enemy = player === 'black' ? 'white' : 'black'
    const myBoard = countBoardPieces(stateBoard, player)
    const enemyBoard = countBoardPieces(stateBoard, enemy)
    const myReserve = stateReserves[player]
    const enemyReserve = stateReserves[enemy]

    // 简单的吃子价值
    let score = (myBoard - enemyBoard) * 100
    score += (myReserve - enemyReserve) * 50

    // 简单位置价值
    for (const k in stateBoard) {
      const val = POSITION_VALUES[k] || 10
      if (stateBoard[k] === player) score += val * 0.5
      else score -= val * 0.3
    }

    return score
  }

  // 基础评估函数
  function evaluateBasic(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    const enemy = player === 'black' ? 'white' : 'black'
    const myBoard = countBoardPieces(stateBoard, player)
    const enemyBoard = countBoardPieces(stateBoard, enemy)
    const myReserve = stateReserves[player]
    const enemyReserve = stateReserves[enemy]

    let score = (myBoard - enemyBoard) * 150
    score += (myReserve - enemyReserve) * 80

    // 位置价值
    for (const k in stateBoard) {
      const val = POSITION_VALUES[k] || 10
      if (stateBoard[k] === player) score += val
      else score -= val
    }

    // 简单机动性
    const myMoves = getAllValidMoves(player, stateBoard)
    score += myMoves.length * 5

    // 困敌方最后一子
    if (enemyBoard === 1) {
      let pos: Point | null = null
      for (const k in stateBoard) {
        if (stateBoard[k] === enemy) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos) {
        const nbs = adj[getKey(pos)] || []
        const blocked = nbs.filter(n => stateBoard[getKey(n)]).length
        if (pos.y < 0) {
          if (blocked === nbs.length) score += 800
          else score += blocked * 60
        } else {
          score += blocked * 40
        }
      }
    }

    // 己方只剩一子时的防御
    if (myBoard === 1) {
      let pos: Point | null = null
      for (const k in stateBoard) {
        if (stateBoard[k] === player) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos) {
        const nbs = adj[getKey(pos)] || []
        const blocked = nbs.filter(n => stateBoard[getKey(n)]).length
        if (pos.y < 0) {
          if (blocked === nbs.length) score -= 600
        }
        score -= blocked * 30
      }
    }

    return score
  }

  // 标准评估函数
  function evaluateStandard(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    const enemy = player === 'black' ? 'white' : 'black'
    const myBoard = countBoardPieces(stateBoard, player)
    const enemyBoard = countBoardPieces(stateBoard, enemy)
    const myReserve = stateReserves[player]
    const enemyReserve = stateReserves[enemy]

    let score = (myBoard - enemyBoard) * 150
    score += (myReserve - enemyReserve) * 80

    // 位置价值
    for (const k in stateBoard) {
      const val = POSITION_VALUES[k] || 10
      if (stateBoard[k] === player) score += val
      else score -= val
    }

    // 机动性 - 合法走法数量
    const myMoves = getAllValidMoves(player, stateBoard)
    const enemyMoves = getAllValidMoves(enemy, stateBoard)
    score += (myMoves.length - enemyMoves.length) * 8

    // 中心控制 - 鼓励占据中心区域
    const centerPoints = ['2,2', '1,2', '3,2', '2,1', '2,3']
    for (const k of centerPoints) {
      if (stateBoard[k] === player) score += 15
      else if (stateBoard[k] === enemy) score -= 15
    }

    // 棋子安全 - 避免棋子处于危险位置
    for (const k in stateBoard) {
      if (stateBoard[k] !== player) continue
      const pos = getPointFromKey(k)
      const nbs = adj[getKey(pos)] || []
      const enemyNeighbors = nbs.filter(n => stateBoard[getKey(n)] === enemy).length
      // 如果棋子被敌方包围，降低评分
      if (enemyNeighbors >= 2) score -= enemyNeighbors * 10
    }

    // 困敌方最后一子
    if (enemyBoard === 1) {
      let pos: Point | null = null
      for (const k in stateBoard) {
        if (stateBoard[k] === enemy) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos) {
        const nbs = adj[getKey(pos)] || []
        const blocked = nbs.filter(n => stateBoard[getKey(n)]).length
        if (pos.y < 0) {
          if (blocked === nbs.length) score += 800
          else score += blocked * 60
        } else {
          score += blocked * 40
        }
      }
    }

    // 己方只剩一子时的防御
    if (myBoard === 1) {
      let pos: Point | null = null
      for (const k in stateBoard) {
        if (stateBoard[k] === player) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos) {
        const nbs = adj[getKey(pos)] || []
        const blocked = nbs.filter(n => stateBoard[getKey(n)]).length
        if (pos.y < 0) {
          if (blocked === nbs.length) score -= 600
        }
        score -= blocked * 30
      }
    }

    return score
  }

  // 高级评估函数
  function evaluateAdvanced(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    let score = evaluateStandard(player, stateBoard, stateReserves)

    // 惩罚重复局面
    if (boardHistory && boardHistory.value.length > 0) {
      const currentHash = Object.keys(stateBoard).sort().map(k => `${k}:${stateBoard[k]}`).join('|')
      const repeatCount = boardHistory.value.filter(h => h.startsWith(currentHash)).length
      if (repeatCount > 0) {
        score -= repeatCount * 50
      }
    }

    return score
  }

  // 大师评估函数
  function evaluateMaster(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    let score = evaluateAdvanced(player, stateBoard, stateReserves)

    const enemy = player === 'black' ? 'white' : 'black'
    const enemyBoard = countBoardPieces(stateBoard, enemy)
    const myBoard = countBoardPieces(stateBoard, player)

    // 复活意识 - 预判是否需要复活
    if (myBoard === 1 && stateReserves[player] > 0) {
      let pos: Point | null = null
      for (const k in stateBoard) {
        if (stateBoard[k] === player) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos && pos.y >= 0) {
        const moves = getValidMoves(pos, stateBoard, moveMode.value, adj, lines)
        if (moves.length === 0) {
          // 即将触发复活，降低评分
          score -= 100
        }
      }
    }

    // 困敌策略 - 更积极地围困敌方
    if (enemyBoard === 1) {
      let pos: Point | null = null
      for (const k in stateBoard) {
        if (stateBoard[k] === enemy) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos) {
        // 在菱形区域困敌更有价值
        if (pos.y < 0) {
          const nbs = adj[getKey(pos)] || []
          const blocked = nbs.filter(n => stateBoard[getKey(n)]).length
          score += blocked * 100
        }
      }
    }

    // 平局意识 - 避免重复局面
    if (boardHistory && boardHistory.value.length > 0) {
      const currentHash = Object.keys(stateBoard).sort().map(k => `${k}:${stateBoard[k]}`).join('|')
      const repeatCount = boardHistory.value.filter(h => h.startsWith(currentHash)).length
      if (repeatCount >= 2) {
        score -= 200 // 严重惩罚即将平局的局面
      }
    }

    // 残局技巧 - 优势时主动进攻
    if (myBoard > enemyBoard && myBoard >= 2) {
      // 优势时鼓励棋子向敌方推进
      for (const k in stateBoard) {
        if (stateBoard[k] !== player) continue
        const pos = getPointFromKey(k)
        // 鼓励向敌方半场移动
        if (player === 'black' && pos.x >= 3) score += 10
        if (player === 'white' && pos.x <= 1) score += 10
      }
    }

    return score
  }

  // 威胁评估函数
  function evaluateThreat(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    let score = evaluateMaster(player, stateBoard, stateReserves)

    const enemy = player === 'black' ? 'white' : 'black'

    // 1. 识别夹吃威胁
    const captureThreats = getCaptureThreats(player, stateBoard, lines, adj)
    score += captureThreats.length * 200

    // 2. 识别挑吃威胁
    const pickThreats = getPickThreats(player, stateBoard, lines, adj)
    score += pickThreats.length * 300

    // 3. 识别围困威胁
    const trapThreats = getTrapThreats(player, stateBoard, adj)
    score += trapThreats.length * 150

    // 4. 识别连环吃子机会
    const chainOpportunities = getChainOpportunities(player, stateBoard, lines, adj)
    score += chainOpportunities.length * 250

    // 5. 防守威胁
    const enemyCaptureThreats = getCaptureThreats(enemy, stateBoard, lines, adj)
    score -= enemyCaptureThreats.length * 180

    const enemyPickThreats = getPickThreats(enemy, stateBoard, lines, adj)
    score -= enemyPickThreats.length * 280

    // 6. 战术组合 - 同时形成多种威胁
    if (captureThreats.length >= 2 && pickThreats.length >= 1) {
      score += 500 // 多重威胁加分
    }

    // 7. 优先选择能形成威胁的位置
    for (const k in stateBoard) {
      if (stateBoard[k] !== player) continue
      const pos = getPointFromKey(k)
      const neighbors = adj[getKey(pos)] || []
      
      // 检查周围是否有威胁机会
      for (const n of neighbors) {
        if (!stateBoard[getKey(n)]) {
          // 空位可能是威胁位置
          const testBoard = { ...stateBoard }
          testBoard[getKey(n)] = player
          delete testBoard[getKey(pos)]
          
          const newCaptureThreats = getCaptureThreats(player, testBoard, lines, adj)
          const newPickThreats = getPickThreats(player, testBoard, lines, adj)
          
          if (newCaptureThreats.length > captureThreats.length) {
            score += 50 // 鼓励移动到能形成威胁的位置
          }
          if (newPickThreats.length > pickThreats.length) {
            score += 80 // 鼓励移动到能形成挑吃威胁的位置
          }
        }
      }
    }

    return score
  }

  // 根据配置选择评估函数
  function evaluateBoard(player: PieceColor, stateBoard: BoardState, stateReserves: Reserves): number {
    const config = getConfig()

    switch (config.evaluationType) {
      case 'random':
        return evaluateRandom()
      case 'greedy':
        return evaluateGreedy(player, stateBoard, stateReserves)
      case 'basic':
        return evaluateBasic(player, stateBoard, stateReserves)
      case 'standard':
        return evaluateStandard(player, stateBoard, stateReserves)
      case 'advanced':
        return evaluateAdvanced(player, stateBoard, stateReserves)
      case 'master':
        return evaluateMaster(player, stateBoard, stateReserves)
      case 'threat':
        return evaluateThreat(player, stateBoard, stateReserves)
      default:
        return evaluateStandard(player, stateBoard, stateReserves)
    }
  }

  function getAllValidMoves(player: PieceColor, stateBoard: BoardState): Move[] {
    const moves: Move[] = []
    for (const k in stateBoard) {
      if (stateBoard[k] !== player) continue
      const from = getPointFromKey(k)
      const targets = getValidMoves(from, stateBoard, moveMode.value, adj, lines)
      for (const to of targets) moves.push({ from, to })
    }
    
    // 走法威胁排序
    const config = getConfig()
    if (config.moveOrdering) {
      return orderMovesByThreat(moves, player, stateBoard, lines, adj)
    }
    
    return moves
  }

  function simulateMoveOnState(
    move: Move,
    player: PieceColor,
    stateBoard: BoardState,
    stateReserves: Reserves
  ): { newBoard: BoardState; newReserves: Reserves; captureCount: number } {
    const fromK = getKey(move.from)
    const toK = getKey(move.to)

    const newBoard = { ...stateBoard }
    const newReserves = { ...stateReserves }

    newBoard[toK] = player
    delete newBoard[fromK]

    const config = getConfig()
    let captureCount = 0

    if (config.chainCaptureAware) {
      // 使用连环吃子
      const chainResult = executeCapturesWithChain(
        move.to, 
        player, 
        newBoard, 
        newReserves, 
        lines
      )
      captureCount = chainResult.capturedCount
    } else {
      // 只检查单次吃子
      const captures = checkCapture(move.to, player, newBoard, lines)
      if (captures.length > 0) {
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
        if (unique.length > 0 && newReserves[player] >= unique.length) {
          for (const pt of unique) delete newBoard[getKey(pt)]
          for (const pt of unique) newBoard[getKey(pt)] = player
          newReserves[player] -= unique.length
          captureCount = unique.length
        }
      }
    }

    return { newBoard, newReserves, captureCount }
  }

  function minimax(
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    player: PieceColor,
    stateBoard: BoardState,
    stateReserves: Reserves
  ): number {
    // 置换表查找
    const hash = getBoardHash(stateBoard, maximizingPlayer ? player : (player === 'black' ? 'white' : 'black'))
    const cached = lookupTranspositionTable(hash, depth, alpha, beta)
    if (cached !== null) return cached

    const enemy = player === 'black' ? 'white' : 'black'
    const current = maximizingPlayer ? player : enemy

    const currentEnemy = current === player ? enemy : player
    if (checkWinCondition(currentEnemy, stateBoard, adj, lines)) {
      return maximizingPlayer ? -9000 : 9000
    }
    if (!hasValidMoves(current, stateBoard, moveMode.value, adj, lines) && countBoardPieces(stateBoard, current) > 0) {
      return maximizingPlayer ? -9000 : 9000
    }

    if (depth === 0) {
      return evaluateBoard(player, stateBoard, stateReserves)
    }

    const moves = getAllValidMoves(current, stateBoard)
    const config = getConfig()

    // 移动排序
    if (config.moveOrdering) {
      moves.sort((a, b) => {
        const simA = simulateMoveOnState(a, current, stateBoard, stateReserves)
        const simB = simulateMoveOnState(b, current, stateBoard, stateReserves)
        if (simB.captureCount !== simA.captureCount) return simB.captureCount - simA.captureCount
        const valA = POSITION_VALUES[getKey(a.to)] || 0
        const valB = POSITION_VALUES[getKey(b.to)] || 0
        return valB - valA
      })
    }

    let result: number
    
    if (maximizingPlayer) {
      let maxEval = -Infinity
      for (const move of moves) {
        const { newBoard, newReserves } = simulateMoveOnState(move, current, stateBoard, stateReserves)
        const evalScore = minimax(depth - 1, alpha, beta, false, player, newBoard, newReserves)
        maxEval = Math.max(maxEval, evalScore)
        alpha = Math.max(alpha, evalScore)
        if (beta <= alpha) break
      }
      result = maxEval
    } else {
      let minEval = Infinity
      for (const move of moves) {
        const { newBoard, newReserves } = simulateMoveOnState(move, current, stateBoard, stateReserves)
        const evalScore = minimax(depth - 1, alpha, beta, true, player, newBoard, newReserves)
        minEval = Math.min(minEval, evalScore)
        beta = Math.min(beta, evalScore)
        if (beta <= alpha) break
      }
      result = minEval
    }
    
    // 置换表存储
    if (result <= alpha) {
      storeTranspositionTable(hash, depth, result, 'upper')
    } else if (result >= beta) {
      storeTranspositionTable(hash, depth, result, 'lower')
    } else {
      storeTranspositionTable(hash, depth, result, 'exact')
    }
    
    return result
  }

  function findBestMove(player: PieceColor): Move | null {
    let moves = getAllValidMoves(player, board.value)
    if (moves.length === 0) return null

    const config = getConfig()

    // 过滤掉重复超过2次的走法（除非只剩这些走法）
    const filteredMoves = moves.filter(move => {
      const moveKey = `${getKey(move.from)}->${getKey(move.to)}`
      const count = aiMoveHistory.value.get(moveKey) || 0
      return count < 2
    })
    
    // 如果过滤后还有走法，使用过滤后的；否则使用原始走法
    if (filteredMoves.length > 0) {
      moves = filteredMoves
    }
    
    // 优先选择移动次数少的棋子（避免一直下一个棋子）
    moves.sort((a, b) => {
      const countA = aiPieceMoveCount.value.get(getKey(a.from)) || 0
      const countB = aiPieceMoveCount.value.get(getKey(b.from)) || 0
      return countA - countB
    })

    // 新手等级 - 随机选择
    if (config.evaluationType === 'random') {
      return moves[Math.floor(Math.random() * moves.length)]
    }

    // 入门等级 - 简单贪心
    if (config.evaluationType === 'greedy') {
      // 优先吃子
      let bestCaptureMove: Move | null = null
      let maxCaptures = 0

      for (const move of moves) {
        const { captureCount } = simulateMoveOnState(move, player, board.value, reserves.value)
        if (captureCount > maxCaptures) {
          maxCaptures = captureCount
          bestCaptureMove = move
        }
      }

      if (bestCaptureMove && maxCaptures > 0) {
        // 有一定概率不选择最优解
        if (Math.random() > config.randomFactor) {
          return bestCaptureMove
        }
      }

      // 随机选择
      return moves[Math.floor(Math.random() * moves.length)]
    }

    // 使用迭代加深搜索
    return iterativeDeepening(player, config.thinkingTime)
  }

  // 迭代加深搜索
  function iterativeDeepening(player: PieceColor, timeLimit: number): Move | null {
    const startTime = Date.now()
    let bestMove: Move | null = null
    const moves = getAllValidMoves(player, board.value)
    
    if (moves.length === 0) return null

    const config = getConfig()
    
    // 走法排序 - 优先考虑吃子走法
    if (config.moveOrdering) {
      moves.sort((a, b) => {
        const simA = simulateMoveOnState(a, player, board.value, reserves.value)
        const simB = simulateMoveOnState(b, player, board.value, reserves.value)
        if (simB.captureCount !== simA.captureCount) return simB.captureCount - simA.captureCount
        const valA = POSITION_VALUES[getKey(a.to)] || 0
        const valB = POSITION_VALUES[getKey(b.to)] || 0
        return valB - valA
      })
    }

    // 检查是否有吃子走法
    let hasCaptureMove = false
    for (const move of moves) {
      const { captureCount } = simulateMoveOnState(move, player, board.value, reserves.value)
      if (captureCount > 0) {
        hasCaptureMove = true
        break
      }
    }

    // 迭代加深
    for (let depth = 1; depth <= config.depth; depth++) {
      let currentBestMove: Move | null = null
      let bestScore = -Infinity

      for (const move of moves) {
        const { newBoard, newReserves } = simulateMoveOnState(move, player, board.value, reserves.value)
        const score = minimax(depth - 1, -Infinity, Infinity, false, player, newBoard, newReserves)
        if (score > bestScore) {
          bestScore = score
          currentBestMove = move
        }
      }

      if (currentBestMove) {
        bestMove = currentBestMove
      }

      // 检查时间限制
      if (Date.now() - startTime > timeLimit) {
        break
      }
    }

    // 只有在没有吃子走法时才添加随机因素
    if (!hasCaptureMove && config.randomFactor > 0 && Math.random() < config.randomFactor) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)]
      return randomMove
    }

    return bestMove
  }

  function handleAIRevival(): boolean {
    const config = getConfig()

    // 新手等级不理解复活
    if (config.evaluationType === 'random') {
      const emptyPoints = MAIN_POINTS.filter(p => !board.value[getKey(p)])
      if (emptyPoints.length === 0) return false
      const randomPoint = emptyPoints[Math.floor(Math.random() * emptyPoints.length)]
      board.value[getKey(randomPoint)] = aiPlayer.value
      reserves.value[aiPlayer.value]--
      return true
    }

    const emptyPoints = MAIN_POINTS.filter(p => !board.value[getKey(p)])
    if (emptyPoints.length === 0) return false

    let bestPoint = emptyPoints[0]
    let bestScore = -Infinity
    const baseBoard = { ...board.value }
    const baseReserves = { ...reserves.value }

    for (const pt of emptyPoints) {
      const k = getKey(pt)
      const testBoard = { ...baseBoard }
      testBoard[k] = aiPlayer.value
      const testReserves = { ...baseReserves }
      testReserves[aiPlayer.value]--

      let score = evaluateBoard(aiPlayer.value, testBoard, testReserves)
      
      // 复活时不允许吃子，移除吃子加分逻辑
      // 位置评估仍然有效，但吃子能力不影响选择
      
      if (POSITION_VALUES[k]) score += POSITION_VALUES[k] * 0.5

      if (score > bestScore) {
        bestScore = score
        bestPoint = pt
      }
    }

    board.value[getKey(bestPoint)] = aiPlayer.value
    reserves.value[aiPlayer.value]--
    return true
  }

  async function makeAIMove(): Promise<boolean> {
    if (!aiEnabled.value || currentPlayer.value !== aiPlayer.value || aiThinking.value) return false
    aiThinking.value = true

    const config = getConfig()

    // 模拟思考时间
    await new Promise(r => setTimeout(r, config.thinkingTime))

    if (!aiEnabled.value) {
      aiThinking.value = false
      return false
    }

    const tokenBefore = aiCancelToken.value
    const move = findBestMove(aiPlayer.value)

    // 多次让出事件循环，确保用户关闭AI等挂起事件能被执行
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 0))
    }

    if (!aiEnabled.value || aiCancelToken.value !== tokenBefore) {
      aiThinking.value = false
      return false
    }

    aiThinking.value = false

    if (!move) {
      if (!hasValidMoves(aiPlayer.value, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, aiPlayer.value) > 0) {
        return false
      }
      return true
    }

    const fromK = getKey(move.from)
    const toK = getKey(move.to)
    board.value[toK] = aiPlayer.value
    delete board.value[fromK]

    // 记录走法历史
    const moveKey = `${fromK}->${toK}`
    const currentCount = aiMoveHistory.value.get(moveKey) || 0
    aiMoveHistory.value.set(moveKey, currentCount + 1)
    
    // 记录棋子移动次数
    const pieceCount = aiPieceMoveCount.value.get(fromK) || 0
    aiPieceMoveCount.value.set(fromK, pieceCount + 1)

    if (config.chainCaptureAware) {
      executeCapturesWithChain(
        move.to, 
        aiPlayer.value, 
        board.value, 
        reserves.value, 
        lines
      )
    } else {
      // 单次吃子
      const captures = checkCapture(move.to, aiPlayer.value, board.value, lines)
      if (captures.length > 0) {
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
        if (unique.length > 0 && reserves.value[aiPlayer.value] >= unique.length) {
          for (const pt of unique) delete board.value[getKey(pt)]
          for (const pt of unique) board.value[getKey(pt)] = aiPlayer.value
          reserves.value[aiPlayer.value] -= unique.length
        }
      }
    }

    return true
  }

  function setAILevel(level: AILevel) {
    aiLevel.value = level
    aiDepth.value = AI_LEVELS[level].depth
  }

  function resetMoveHistory() {
    aiMoveHistory.value.clear()
    aiPieceMoveCount.value.clear()
  }

  return {
    aiEnabled,
    aiPlayer,
    aiLevel,
    aiDepth,
    aiThinking,
    aiCancelToken,
    AI_LEVELS,
    makeAIMove,
    handleAIRevival,
    findBestMove,
    setAILevel,
    resetMoveHistory,
  }
}