import { ref, computed } from 'vue'
import type { PieceColor, BoardState, Point, MoveMode, Reserves, AILevel } from '../types'
import { ALL_POINTS, MAIN_POINTS } from '../utils/constants'
import {
  getKey,
  getPointFromKey,
  getValidMoves,
  hasValidMoves,
  executeCapturesWithChain,
  checkWinCondition,
  countBoardPieces,
} from '../utils/board'
import { createAdjacencyList, createLines } from '../utils/boardLines'
import { useAI, AI_LEVELS } from './useAI'

export function useGame() {
  // 棋盘连线数据
  const adj = createAdjacencyList()
  const lines = createLines()

  // 游戏状态
  const board = ref<BoardState>({})
  const reserves = ref<Reserves>({ black: 5, white: 5 })
  const currentPlayer = ref<PieceColor>('black')
  const selectedPiece = ref<Point | null>(null)
  const gameOver = ref(false)
  const winner = ref<PieceColor | null>(null)
  const moveMode = ref<MoveMode>('single')
  const revivalMode = ref(false)
  
  // 防止死循环：记录棋盘历史状态
  const boardHistory = ref<string[]>([])
  const moveCount = ref(0)
  const MAX_MOVES = 200

  // AI 对弈模式
  const aiVsAiMode = ref(false)
  const aiVsAiSpeed = ref(500) // 每步间隔毫秒
  const aiVsAiTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const aiBlackLevel = ref<AILevel>(4) // 黑方AI等级
  const aiWhiteLevel = ref<AILevel>(6) // 白方AI等级

  // AI逻辑
  const {
    aiEnabled,
    aiPlayer,
    aiLevel,
    aiDepth,
    aiThinking,
    aiCancelToken,
    makeAIMove,
    handleAIRevival,
    setAILevel,
    resetMoveHistory,
  } = useAI(board, reserves, currentPlayer, moveMode, adj, lines, boardHistory)

  // 计算属性
  const blackBoardCount = computed(() => countBoardPieces(board.value, 'black'))
  const whiteBoardCount = computed(() => countBoardPieces(board.value, 'white'))

  // 生成棋盘状态哈希（用于检测重复局面）
  function getBoardHash(): string {
    const keys = Object.keys(board.value).sort()
    return keys.map(k => `${k}:${board.value[k]}`).join('|') + `|res:${reserves.value.black},${reserves.value.white}|turn:${currentPlayer.value}`
  }

  // 检查是否出现平局（三重复局面 或 超过最大步数）
  function checkDraw(): boolean {
    if (moveCount.value >= MAX_MOVES) return true
    const hash = getBoardHash()
    const count = boardHistory.value.filter(h => h === hash).length
    return count >= 3
  }

  // 记录当前局面
  function recordBoardState() {
    boardHistory.value.push(getBoardHash())
    moveCount.value++
  }

  const statusText = computed(() => {
    if (gameOver.value) {
      if (winner.value === null) return '🤝 平局！'
      return winner.value === 'black' ? '⚫ 黑方获胜！' : '⚪ 白方获胜！'
    }
    if (aiVsAiMode.value) {
      return (currentPlayer.value === 'black' ? '⚫ 黑方' : '⚪ 白方') + ' AI思考中...'
    }
    if (revivalMode.value) {
      return (currentPlayer.value === 'black' ? '⚫ 黑方' : '⚪ 白方') + ' 触发复活！请选择主棋盘空位落子'
    }
    return currentPlayer.value === 'black' ? '⚫ 黑方回合 - 请选择棋子' : '⚪ 白方回合 - 请选择棋子'
  })

  const statusColor = computed(() => {
    if (gameOver.value) {
      if (winner.value === null) return '#a0aec0'
      return winner.value === 'black' ? '#d1d5db' : '#ffffff'
    }
    if (aiVsAiMode.value) {
      return '#90cdf4' // 蓝色，表示AI对弈模式
    }
    if (revivalMode.value) {
      return '#68d391'
    }
    return '#fbd38d'
  })

  const modeText = computed(() => {
    return moveMode.value === 'single'
      ? '当前移动模式：一步（点击按钮切换）'
      : '当前移动模式：多步（点击按钮切换）'
  })

  const modeButtonText = computed(() => {
    return moveMode.value === 'single' ? '切换：多步模式' : '切换：一步模式'
  })

  // 初始化游戏
  function initGame() {
    // 停止AI对弈模式
    stopAiVsAi()
    aiVsAiMode.value = false
    
    board.value = {}
    reserves.value = { black: 5, white: 5 }
    currentPlayer.value = 'black'
    selectedPiece.value = null
    gameOver.value = false
    winner.value = null
    moveMode.value = 'single'
    revivalMode.value = false
    boardHistory.value = []
    moveCount.value = 0
    
    // 重置AI走法历史
    resetMoveHistory()

    // 初始布局
    for (let j = 0; j < 5; j++) board.value[`0,${j}`] = 'black'
    for (let j = 0; j < 5; j++) board.value[`4,${j}`] = 'white'

    recordBoardState()
    startTurn()
  }

  function startTurn() {
    if (gameOver.value) return

    // 检查平局
    if (checkDraw()) {
      gameOver.value = true
      winner.value = null
      return
    }

    const count = countBoardPieces(board.value, currentPlayer.value)
    if (count === 1) {
      let pos: Point | null = null
      for (const k in board.value) {
        if (board.value[k] === currentPlayer.value) {
          pos = getPointFromKey(k)
          break
        }
      }
      if (pos && getValidMoves(pos, board.value, moveMode.value, adj, lines).length === 0) {
        if (pos.y < 0) {
          // 菱形区域被困 → 直接判负（围困获胜）
          gameOver.value = true
          winner.value = currentPlayer.value === 'black' ? 'white' : 'black'
          return
        } else {
          // 主棋盘无法移动 → 检查复活条件
          const hasEmptySpot = MAIN_POINTS.some(p => !board.value[getKey(p)])
          if (reserves.value[currentPlayer.value] > 0 && hasEmptySpot) {
            revivalMode.value = true
            selectedPiece.value = null

            if (aiEnabled.value && currentPlayer.value === aiPlayer.value) {
              setTimeout(() => {
                if (!aiEnabled.value) return
                if (handleAIRevival()) {
                  recordBoardState()
                  if (checkWinCondition(currentPlayer.value, board.value, adj, lines)) {
                    gameOver.value = true
                    winner.value = currentPlayer.value
                    return
                  }
                  // 如果对手1子无法移动，交给startTurn处理（复活或围困判定）

                  // 检查平局
                  if (checkDraw()) {
                    gameOver.value = true
                    winner.value = null
                    return
                  }

                  const next = currentPlayer.value === 'black' ? 'white' : 'black'
                  currentPlayer.value = next
                  if (aiEnabled.value) {
                    setTimeout(() => startTurn(), 300)
                  }
                } else {
                  gameOver.value = true
                  winner.value = currentPlayer.value === 'black' ? 'white' : 'black'
                }
              }, 400)
            }
            return
          } else {
            // 无法复活（无空位或无备用）→ 判负
            gameOver.value = true
            winner.value = currentPlayer.value === 'black' ? 'white' : 'black'
            return
          }
        }
      }
    }

    revivalMode.value = false
    selectedPiece.value = null

    if (aiEnabled.value && currentPlayer.value === aiPlayer.value && !revivalMode.value && !gameOver.value) {
      setTimeout(async () => {
        if (!aiEnabled.value) return
        const success = await makeAIMove()
        if (!aiEnabled.value) return
        if (success) {
          recordBoardState()
          
          // 检查平局
          if (checkDraw()) {
            gameOver.value = true
            winner.value = null
            return
          }
          
          if (checkWinCondition(aiPlayer.value, board.value, adj, lines)) {
            gameOver.value = true
            winner.value = aiPlayer.value
            return
          }
          const next = aiPlayer.value === 'black' ? 'white' : 'black'
          // 对手1子无法移动交给startTurn处理（复活或围困判定）
          currentPlayer.value = next
          selectedPiece.value = null
          if (aiEnabled.value) {
            startTurn()
          }
        } else {
          const next = aiPlayer.value === 'black' ? 'white' : 'black'
          // AI移动失败，检查是否需要复活（单子被困在主棋盘）
          const aiCount = countBoardPieces(board.value, aiPlayer.value)
          if (aiCount === 1 && reserves.value[aiPlayer.value] > 0) {
            let pos: Point | null = null
            for (const k in board.value) {
              if (board.value[k] === aiPlayer.value) {
                pos = getPointFromKey(k)
                break
              }
            }
            if (pos && pos.y >= 0) {
              const hasEmptySpot = MAIN_POINTS.some(p => !board.value[getKey(p)])
              if (hasEmptySpot) {
                if (handleAIRevival()) {
                  recordBoardState()
                  if (checkWinCondition(aiPlayer.value, board.value, adj, lines)) {
                    gameOver.value = true
                    winner.value = aiPlayer.value
                    return
                  }
                  currentPlayer.value = next
                  startTurn()
                  return
                }
              }
            }
          }
          // 非复活场景：无棋可动判负
          if (!hasValidMoves(aiPlayer.value, board.value, moveMode.value, adj, lines) && aiCount > 0) {
            gameOver.value = true
            winner.value = next
          }
        }
      }, 400)
    }
  }

  function toggleMoveMode() {
    moveMode.value = moveMode.value === 'single' ? 'multi' : 'single'
    selectedPiece.value = null
  }

  function handleBoardClick(clicked: Point) {
    if (gameOver.value || aiThinking.value) return

    const k = getKey(clicked)
    const piece = board.value[k]

    if (revivalMode.value) {
      if (clicked.y < 0 || piece) return
      board.value[k] = currentPlayer.value
      reserves.value[currentPlayer.value]--
      recordBoardState()

      // 检查平局
      if (checkDraw()) {
        gameOver.value = true
        winner.value = null
        return
      }

      const next = currentPlayer.value === 'black' ? 'white' : 'black'
      // 规则5.2: 敌方>1子但无任何棋子可以移动 — 使用 checkWinCondition 统一判定（检查两种模式）
      if (checkWinCondition(currentPlayer.value, board.value, adj, lines)) {
        gameOver.value = true
        winner.value = currentPlayer.value
        return
      }
      // 如果对手1子无法移动，交给startTurn处理（复活或围困判定）
      currentPlayer.value = next
      startTurn()
      return
    }

    if (selectedPiece.value) {
      const startK = getKey(selectedPiece.value)

      if (piece === currentPlayer.value) {
        selectedPiece.value = clicked
        return
      }
      if (piece) {
        selectedPiece.value = null
        return
      }

      const reachable = getValidMoves(selectedPiece.value, board.value, moveMode.value, adj, lines).some(
        m => m.x === clicked.x && m.y === clicked.y
      )
      if (!reachable) {
        selectedPiece.value = null
        return
      }

      board.value[k] = currentPlayer.value
      delete board.value[startK]
      recordBoardState()

      executeCapturesWithChain(
        clicked,
        currentPlayer.value,
        board.value,
        reserves.value,
        lines
      )

      if (checkWinCondition(currentPlayer.value, board.value, adj, lines)) {
        gameOver.value = true
        winner.value = currentPlayer.value
        return
      }

      const next = currentPlayer.value === 'black' ? 'white' : 'black'
      // 对手1子无法移动交给startTurn处理（复活或围困判定）
      currentPlayer.value = next
      selectedPiece.value = null
      startTurn()
      return
    } else {
      if (piece === currentPlayer.value) {
        selectedPiece.value = clicked
      }
    }
  }

  function toggleAI() {
    aiEnabled.value = !aiEnabled.value
    if (!aiEnabled.value) {
      aiCancelToken.value++
    } else {
      // 开启AI时，如果正在AI对弈模式，停止对弈
      if (aiVsAiMode.value) {
        aiVsAiMode.value = false
        if (aiVsAiTimer.value) {
          clearTimeout(aiVsAiTimer.value)
          aiVsAiTimer.value = null
        }
      }
    }
    if (aiEnabled.value && currentPlayer.value === aiPlayer.value && !gameOver.value) {
      startTurn()
    }
  }

  function switchAIPlayer() {
    aiPlayer.value = aiPlayer.value === 'white' ? 'black' : 'white'
    if (aiEnabled.value && currentPlayer.value === aiPlayer.value && !gameOver.value) {
      startTurn()
    }
  }

  // AI 对弈模式
  function toggleAiVsAi() {
    aiVsAiMode.value = !aiVsAiMode.value
    if (aiVsAiMode.value) {
      // 开启AI对弈模式时，关闭普通AI模式
      if (aiEnabled.value) {
        aiEnabled.value = false
        aiCancelToken.value++
      }
      scheduleAiVsAiMove()
    } else {
      stopAiVsAi()
    }
  }

  function scheduleAiVsAiMove() {
    if (!aiVsAiMode.value || gameOver.value) return
    
    // 延迟执行AI移动
    aiVsAiTimer.value = setTimeout(async () => {
      if (!aiVsAiMode.value || gameOver.value) return
      
      await executeAiVsAiMove()
    }, aiVsAiSpeed.value)
  }

  async function executeAiVsAiMove() {
    if (!aiVsAiMode.value || gameOver.value) return
    
    // 设置当前玩家的AI等级和aiPlayer
    const currentLevel = currentPlayer.value === 'black' ? aiBlackLevel.value : aiWhiteLevel.value
    aiPlayer.value = currentPlayer.value
    setAILevel(currentLevel)
    
    // 启用AI
    aiEnabled.value = true
    
    // 确保 aiPlayer 是当前玩家
    aiPlayer.value = currentPlayer.value
    
    const success = await makeAIMove()
    
    // 关闭AI
    aiEnabled.value = false
    
    if (!aiVsAiMode.value) return
    
    if (success) {
      recordBoardState()

      // 检查平局
      if (checkDraw()) {
        gameOver.value = true
        winner.value = null
        return
      }

      // 检查胜利条件（统一使用 checkWinCondition，检查两种模式）
      if (checkWinCondition(currentPlayer.value, board.value, adj, lines)) {
        gameOver.value = true
        winner.value = currentPlayer.value
        return
      }

      // 对手1子无法移动交给 scheduleAiVsAiMove/startTurn 处理复活或围困
      const next = currentPlayer.value === 'black' ? 'white' : 'black'
      currentPlayer.value = next
      selectedPiece.value = null
      
      // 继续下一轮（startTurn会处理复活逻辑）
      scheduleAiVsAiMove()
    } else {
      // AI无法移动，检查是否需要复活
      const currentCount = countBoardPieces(board.value, currentPlayer.value)
      if (currentCount === 1 && reserves.value[currentPlayer.value] > 0) {
        // 检查是否在主棋盘无法移动（需要复活）
        let pos: Point | null = null
        for (const k in board.value) {
          if (board.value[k] === currentPlayer.value) {
            pos = getPointFromKey(k)
            break
          }
        }
        if (pos && pos.y >= 0 && getValidMoves(pos, board.value, moveMode.value, adj, lines).length === 0) {
          // 触发AI复活
          const hasEmptySpot = MAIN_POINTS.some(p => !board.value[getKey(p)])
          if (hasEmptySpot) {
            // 使用AI复活逻辑
            aiPlayer.value = currentPlayer.value
            setAILevel(currentPlayer.value === 'black' ? aiBlackLevel.value : aiWhiteLevel.value)
            if (handleAIRevival()) {
              recordBoardState()
              if (checkWinCondition(currentPlayer.value, board.value, adj, lines)) {
                gameOver.value = true
                winner.value = currentPlayer.value
                return
              }
              const nextPlayer = currentPlayer.value === 'black' ? 'white' : 'black'
              currentPlayer.value = nextPlayer
              scheduleAiVsAiMove()
              return
            }
          }
        }
      }

      // 检查是否无棋可动（非复活场景）
      const next = currentPlayer.value === 'black' ? 'white' : 'black'
      if (!hasValidMoves(currentPlayer.value, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, currentPlayer.value) > 0) {
        gameOver.value = true
        winner.value = next
      }
    }
  }

  function stopAiVsAi() {
    if (aiVsAiTimer.value) {
      clearTimeout(aiVsAiTimer.value)
      aiVsAiTimer.value = null
    }
    aiEnabled.value = false
    aiCancelToken.value++
  }

  function setAiBlackLevel(level: AILevel) {
    aiBlackLevel.value = level
  }

  function setAiWhiteLevel(level: AILevel) {
    aiWhiteLevel.value = level
  }

  function setAiVsAiSpeed(speed: number) {
    aiVsAiSpeed.value = speed
  }

  function changeDepth() {
    aiDepth.value = aiDepth.value === 3 ? 4 : aiDepth.value === 4 ? 2 : 3
  }

  // AI等级相关
  function changeAILevel(level: AILevel) {
    setAILevel(level)
  }

  const currentAIConfig = computed(() => AI_LEVELS[aiLevel.value])

  // 初始化游戏
  initGame()

  return {
    // 状态
    board,
    reserves,
    currentPlayer,
    selectedPiece,
    gameOver,
    winner,
    moveMode,
    revivalMode,
    aiEnabled,
    aiPlayer,
    aiLevel,
    aiDepth,
    aiThinking,
    
    // AI 对弈模式
    aiVsAiMode,
    aiVsAiSpeed,
    aiBlackLevel,
    aiWhiteLevel,
    
    // 计算属性
    blackBoardCount,
    whiteBoardCount,
    statusText,
    statusColor,
    modeText,
    modeButtonText,
    currentAIConfig,
    
    // 方法
    initGame,
    toggleMoveMode,
    handleBoardClick,
    toggleAI,
    switchAIPlayer,
    changeDepth,
    changeAILevel,
    toggleAiVsAi,
    setAiBlackLevel,
    setAiWhiteLevel,
    setAiVsAiSpeed,
    
    // 棋盘数据
    adj,
    lines,
    allPoints: ALL_POINTS,
    mainPoints: MAIN_POINTS,
    AI_LEVELS,
  }
}