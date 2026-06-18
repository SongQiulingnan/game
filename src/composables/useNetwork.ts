import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { PieceColor, GameStateData, Move, Point } from '../types'

export type NetworkState = 'idle' | 'creating' | 'waiting' | 'playing' | 'disconnected'

export function useNetwork() {
  const socket = ref<Socket | null>(null)
  const networkState = ref<NetworkState>('idle')
  const roomCode = ref('')
  const myColor = ref<PieceColor>('black')
  const opponentConnected = ref(true)
  const errorMessage = ref('')

  // 外部注册的回调
  let onGameStateCallback: ((state: GameStateData & { yourColor: PieceColor }) => void) | null = null

  function connect() {
    if (socket.value?.connected) return

    socket.value = io('/', {
      transports: ['websocket', 'polling'],
    })

    const s = socket.value

    s.on('connect', () => {
      console.log('[网络] 已连接', s.id)
    })

    s.on('disconnect', () => {
      networkState.value = 'disconnected'
      opponentConnected.value = false
    })

    // 房间事件
    s.on('room:created', (data: { code: string; color: PieceColor }) => {
      roomCode.value = data.code
      myColor.value = data.color
      networkState.value = 'waiting'
      errorMessage.value = ''
    })

    s.on('room:joined', (data: { color: PieceColor }) => {
      myColor.value = data.color
      networkState.value = 'waiting'
      errorMessage.value = ''
    })

    s.on('opponent:joined', (_data: { color: PieceColor }) => {
      opponentConnected.value = true
      // 房主收到此事件后可以开始游戏
    })

    s.on('room:error', (data: { message: string }) => {
      errorMessage.value = data.message
    })

    s.on('room:left', () => {
      reset()
    })

    s.on('room:closed', (data: { message: string }) => {
      errorMessage.value = data.message
      networkState.value = 'disconnected'
    })

    // 游戏事件
    s.on('game:state', (data: GameStateData & { yourColor: PieceColor }) => {
      myColor.value = data.yourColor
      opponentConnected.value = data.opponentConnected
      networkState.value = 'playing'

      if (onGameStateCallback) {
        onGameStateCallback(data)
      }
    })

    s.on('game:error', (data: { message: string }) => {
      console.warn('[游戏] 服务端错误:', data.message)
    })

    s.on('game:over', (data: { winner: PieceColor | null; reason: string }) => {
      console.log('[游戏] 结束:', data)
    })

    s.on('opponent:disconnected', () => {
      opponentConnected.value = false
    })

    s.on('opponent:reconnected', () => {
      opponentConnected.value = true
    })
  }

  function createRoom() {
    if (!socket.value) return
    networkState.value = 'creating'
    errorMessage.value = ''
    socket.value.emit('room:create')
  }

  function joinRoom(code: string) {
    if (!socket.value) return
    errorMessage.value = ''
    socket.value.emit('room:join', { code: code.toUpperCase() })
  }

  function startGame() {
    if (!socket.value) return
    socket.value.emit('game:start')
  }

  function leaveRoom() {
    if (!socket.value) return
    socket.value.emit('room:leave')
    reset()
  }

  function sendMove(move: Move) {
    if (!socket.value) return
    socket.value.emit('game:move', { move })
  }

  function sendRevival(point: Point) {
    if (!socket.value) return
    socket.value.emit('game:revive', { point })
  }

  function onGameState(callback: (state: GameStateData & { yourColor: PieceColor }) => void) {
    onGameStateCallback = callback
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    reset()
  }

  function reset() {
    networkState.value = 'idle'
    roomCode.value = ''
    myColor.value = 'black'
    opponentConnected.value = true
    errorMessage.value = ''
  }

  return {
    socket,
    networkState,
    roomCode,
    myColor,
    opponentConnected,
    errorMessage,
    connect,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
    sendMove,
    sendRevival,
    onGameState,
    disconnect,
  }
}
