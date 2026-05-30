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
} from '../utils/board'
import type { Ref } from 'vue'

export const AI_LEVELS: Record<AILevel, AILevelConfig> = {
  1: {
    name: '新手',
    description: '随机出招，适合初学者',
    depth: 0,
    thinkingTime: 20,
    evaluationType: 'random',
    moveOrdering: false,
    chainCaptureAware: false,
    revivalAware: false,
    drawAware: false,
    randomFactor: 1.0
  },
  2: {
    name: '入门',
    description: '贪心策略，优先吃子',
    depth: 1,
    thinkingTime: 30,
    evaluationType: 'greedy',
    moveOrdering: false,
    chainCaptureAware: false,
    revivalAware: false,
    drawAware: false,
    randomFactor: 0.3
  },
  3: {
    name: '初级',
    description: '浅层搜索，理解基本规则',
    depth: 2,
    thinkingTime: 50,
    evaluationType: 'basic',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: false,
    drawAware: false,
    randomFactor: 0.25
  },
  4: {
    name: '中级',
    description: '标准搜索，掌握连环吃子',
    depth: 3,
    thinkingTime: 80,
    evaluationType: 'standard',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: false,
    randomFactor: 0.26
  },
  5: {
    name: '高级',
    description: '深层搜索，预判多步',
    depth: 4,
    thinkingTime: 120,
    evaluationType: 'advanced',
    moveOrdering: true,
    chainCaptureAware: true,
    revivalAware: true,
    drawAware: true,
    randomFactor: 0.27
  },
  6: {
    name: '大师',
    description: '完全掌握规则，最优策略',
    depth: 5,
    thinkingTime: 150,
    evaluationType: 'master',
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

  function getConfig(): AILevelConfig {
    return AI_LEVELS[aiLevel.value]
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

    let score = (myBoard - enemyBoard) * 120
    score += (myReserve - enemyReserve) * 60

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

    let score = (myBoard - enemyBoard) * 120
    score += (myReserve - enemyReserve) * 60

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
    const enemy = player === 'black' ? 'white' : 'black'
    const current = maximizingPlayer ? player : enemy

    const currentEnemy = current === player ? enemy : player
    if (checkWinCondition(currentEnemy, stateBoard, adj)) {
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

    if (maximizingPlayer) {
      let maxEval = -Infinity
      for (const move of moves) {
        const { newBoard, newReserves } = simulateMoveOnState(move, current, stateBoard, stateReserves)
        const evalScore = minimax(depth - 1, alpha, beta, false, player, newBoard, newReserves)
        maxEval = Math.max(maxEval, evalScore)
        alpha = Math.max(alpha, evalScore)
        if (beta <= alpha) break
      }
      return maxEval
    } else {
      let minEval = Infinity
      for (const move of moves) {
        const { newBoard, newReserves } = simulateMoveOnState(move, current, stateBoard, stateReserves)
        const evalScore = minimax(depth - 1, alpha, beta, true, player, newBoard, newReserves)
        minEval = Math.min(minEval, evalScore)
        beta = Math.min(beta, evalScore)
        if (beta <= alpha) break
      }
      return minEval
    }
  }

  function findBestMove(player: PieceColor): Move | null {
    const moves = getAllValidMoves(player, board.value)
    if (moves.length === 0) return null

    const config = getConfig()

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

    // 使用minimax搜索
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

    let bestMove: Move | null = null
    let bestScore = -Infinity

    for (const move of moves) {
      const { newBoard, newReserves } = simulateMoveOnState(move, player, board.value, reserves.value)
      const score = minimax(config.depth - 1, -Infinity, Infinity, false, player, newBoard, newReserves)
      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
    }

    // 添加随机因素
    if (config.randomFactor > 0 && Math.random() < config.randomFactor) {
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
      
      // 检查是否可以吃子
      if (config.chainCaptureAware) {
        const chainResult = executeCapturesWithChain(pt, aiPlayer.value, testBoard, testReserves, lines)
        if (chainResult.capturedCount > 0) score += 250
      } else {
        const captures = checkCapture(pt, aiPlayer.value, testBoard, lines)
        if (captures.length > 0) score += 250
      }
      
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
  }
}