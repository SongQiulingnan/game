<script setup lang="ts">
import { ref } from 'vue'
import { useGame } from './composables/useGame'
import { useNetwork } from './composables/useNetwork'
import Board from './components/Board.vue'
import Controls from './components/Controls.vue'
import InfoPanel from './components/InfoPanel.vue'
import StatusBar from './components/StatusBar.vue'
import RulesBox from './components/RulesBox.vue'
import LobbyPanel from './components/LobbyPanel.vue'

const {
  board,
  reserves,
  currentPlayer,
  selectedPiece,
  gameOver,
  moveMode,
  revivalMode,
  aiEnabled,
  aiPlayer,
  aiLevel,
  aiVsAiMode,
  aiVsAiSpeed,
  aiBlackLevel,
  aiWhiteLevel,
  onlineMode,
  blackBoardCount,
  whiteBoardCount,
  statusText,
  statusColor,
  modeText,
  modeButtonText,
  currentAIConfig,
  initGame,
  toggleMoveMode,
  handleBoardClick,
  toggleAI,
  switchAIPlayer,
  changeAILevel,
  toggleAiVsAi,
  setAiBlackLevel,
  setAiWhiteLevel,
  setAiVsAiSpeed,
  enterOnlineMode,
  exitOnlineMode,
  applyRemoteState,
  setOnlinePlayer,
  setNetworkCallbacks,
  adj,
  lines,
  allPoints,
  AI_LEVELS,
} = useGame()

const network = useNetwork()

// 绑定网络层 → 游戏层
network.onGameState((state) => {
  applyRemoteState(state)
})

// 绑定游戏层 → 网络层
setNetworkCallbacks({
  onMoveMade: (move) => network.sendMove(move),
  onRevivalMade: (point) => network.sendRevival(point),
})

const showRules = ref(false)
const showLobby = ref(false)
const creatingRoom = ref(false)

function toggleRules() {
  showRules.value = !showRules.value
}

function handleEnterOnlineMode() {
  showLobby.value = true
  network.connect()
}

function handleCreateRoom() {
  creatingRoom.value = true
  network.createRoom()
}

function handleJoinRoom(code: string) {
  network.joinRoom(code)
}

function handleLeaveRoom() {
  network.leaveRoom()
  showLobby.value = false
  creatingRoom.value = false
  exitOnlineMode()
}

function handleCloseLobby() {
  // 如果游戏已开始，不允许关闭
  if (network.networkState.value === 'playing') return
  handleLeaveRoom()
}

// 监听网络状态变化，进入游戏时启用联机模式
import { watch } from 'vue'
watch(
  () => network.networkState.value,
  (state) => {
    if (state === 'playing') {
      enterOnlineMode()
      showLobby.value = false
      creatingRoom.value = false
    }
  }
)
</script>

<template>
  <div class="game-wrapper">
    <header class="game-header">
      <h1 class="game-title">挑夹棋</h1>
      <p class="game-subtitle">传统民间棋类游戏</p>
    </header>

    <main class="game-main">
      <div class="game-container">
        <Board
          :board="board"
          :selected-piece="selectedPiece"
          :current-player="currentPlayer"
          :move-mode="moveMode"
          :revival-mode="revivalMode"
          :game-over="gameOver"
          :all-points="allPoints"
          :adj="adj"
          :lines="lines"
          @select="handleBoardClick"
        />
      </div>

      <div class="game-sidebar">
        <StatusBar
          :status-text="statusText"
          :status-color="statusColor"
          :mode-text="modeText"
        />

        <InfoPanel
          :reserves="reserves"
          :black-board-count="blackBoardCount"
          :white-board-count="whiteBoardCount"
        />

        <Controls
          :mode-button-text="modeButtonText"
          :ai-enabled="aiEnabled"
          :ai-player="aiPlayer"
          :ai-level="aiLevel"
          :current-a-i-config="currentAIConfig"
          :AI_LEVELS="AI_LEVELS"
          :ai-vs-ai-mode="aiVsAiMode"
          :ai-vs-ai-speed="aiVsAiSpeed"
          :ai-black-level="aiBlackLevel"
          :ai-white-level="aiWhiteLevel"
          :actions="{
            reset: initGame,
            toggleMoveMode: toggleMoveMode,
            toggleRules: toggleRules,
            toggleAI: toggleAI,
            switchAIPlayer: switchAIPlayer,
            changeAILevel: changeAILevel,
            toggleAiVsAi: toggleAiVsAi,
            setAiBlackLevel: setAiBlackLevel,
            setAiWhiteLevel: setAiWhiteLevel,
            setAiVsAiSpeed: setAiVsAiSpeed,
            enterOnlineMode: handleEnterOnlineMode,
          }"
        />
      </div>
    </main>

    <RulesBox :show="showRules" @close="toggleRules" />

    <!-- 联机大厅 -->
    <LobbyPanel
      v-if="showLobby"
      :network-state="network.networkState.value"
      :room-code="network.roomCode.value"
      :error-message="network.errorMessage.value"
      :creating="creatingRoom"
      @close="handleCloseLobby"
      @create-room="handleCreateRoom"
      @join-room="handleJoinRoom"
      @leave-room="handleLeaveRoom"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
}

body {
  min-height: 100vh;
  background: linear-gradient(135deg, #d4a574 0%, #c4956a 50%, #b88560 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'SimHei', sans-serif;
  color: #333;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

.game-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 16px;
  gap: 16px;
}

.game-header {
  text-align: center;
  padding: 8px 0;
}

.game-title {
  font-size: 28px;
  font-weight: 700;
  color: #5a3325;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin: 0;
  letter-spacing: 4px;
}

.game-subtitle {
  font-size: 14px;
  color: #8b5e3c;
  margin: 4px 0 0 0;
}

.game-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 600px;
}

.game-container {
  background: linear-gradient(135deg, #8b5e3c, #7a5235);
  padding: 16px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 100%;
  display: flex;
  justify-content: center;
}

.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

/* 桌面端布局 */
@media (min-width: 768px) {
  .game-wrapper {
    padding: 24px;
    gap: 24px;
  }

  .game-title {
    font-size: 36px;
  }

  .game-main {
    flex-direction: row;
    align-items: flex-start;
    gap: 24px;
  }

  .game-container {
    flex-shrink: 0;
    width: auto;
  }

  .game-sidebar {
    flex: 1;
    min-width: 280px;
    max-width: 360px;
  }
}

/* 移动端优化 */
@media (max-width: 480px) {
  .game-wrapper {
    padding: 12px;
    gap: 12px;
  }

  .game-title {
    font-size: 24px;
    letter-spacing: 2px;
  }

  .game-subtitle {
    font-size: 12px;
  }

  .game-container {
    padding: 12px;
    border-radius: 12px;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  button {
    min-height: 44px;
  }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  body {
    background: linear-gradient(135deg, #8b5e3c 0%, #7a5235 50%, #6b4530 100%);
  }
}
</style>
