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
      const hasEmptySpot = MAIN_POINTS.some(p => !board.value[getKey(p)])
      if (pos && pos.y >= 0 && getValidMoves(pos, board.value, moveMode.value, adj, lines).length === 0 && reserves.value[currentPlayer.value] > 0 && hasEmptySpot) {
        revivalMode.value = true
        selectedPiece.value = null

        if (aiEnabled.value && currentPlayer.value === aiPlayer.value) {
          setTimeout(() => {
            if (!aiEnabled.value) return
            if (handleAIRevival()) {
              recordBoardState()
              const next = currentPlayer.value === 'black' ? 'white' : 'black'
              if (!hasValidMoves(next, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, next) > 0) {
                gameOver.value = true
                winner.value = currentPlayer.value
                return
              }
              
              // 检查平局
              if (checkDraw()) {
                gameOver.value = true
                winner.value = null
                return
              }
              
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
      }
      // 1子在主棋盘无法移动，但无法复活（无空位或无备用）→ 判负
      if (pos && pos.y >= 0 && getValidMoves(pos, board.value, moveMode.value, adj, lines).length === 0) {
        gameOver.value = true
        winner.value = currentPlayer.value === 'black' ? 'white' : 'black'
        return
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
          
          if (checkWinCondition(aiPlayer.value, board.value, adj)) {
            gameOver.value = true
            winner.value = aiPlayer.value
            return
          }
          const next = aiPlayer.value === 'black' ? 'white' : 'black'
          if (!hasValidMoves(next, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, next) > 0) {
            gameOver.value = true
            winner.value = aiPlayer.value
            return
          }
          currentPlayer.value = next
          selectedPiece.value = null
          if (aiEnabled.value) {
            startTurn()
          }
        } else {
          const next = aiPlayer.value === 'black' ? 'white' : 'black'
          if (!hasValidMoves(aiPlayer.value, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, aiPlayer.value) > 0) {
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
      if (!hasValidMoves(next, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, next) > 0) {
        gameOver.value = true
        winner.value = currentPlayer.value
        return
      }
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

      if (checkWinCondition(currentPlayer.value, board.value, adj)) {
        gameOver.value = true
        winner.value = currentPlayer.value
        return
      }

      const next = currentPlayer.value === 'black' ? 'white' : 'black'
      if (!hasValidMoves(next, board.value, moveMode.value, adj, lines) && countBoardPieces(board.value, next) > 0) {
        gameOver.value = true
        winner.value = currentPlayer.value
        return
      }
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
    
    // 棋盘数据
    adj,
    lines,
    allPoints: ALL_POINTS,
    mainPoints: MAIN_POINTS,
    AI_LEVELS,
  }
}