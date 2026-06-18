<template>
  <div class="lobby-overlay" @click.self="$emit('close')">
    <div class="lobby-panel">
      <button class="close-btn" @click="$emit('close')">✕</button>

      <h2 class="lobby-title">🌐 联机对战</h2>

      <!-- 未操作状态：显示创建/加入选项 -->
      <div v-if="networkState === 'idle' || networkState === 'creating'" class="lobby-tabs">
        <div class="lobby-section">
          <h3>创建房间</h3>
          <p class="section-desc">创建一个新房间，邀请好友加入</p>
          <button class="action-btn create-btn" @click="$emit('createRoom')" :disabled="creating">
            <span v-if="creating" class="spinner"></span>
            {{ creating ? '创建中...' : '🎮 创建房间' }}
          </button>
        </div>

        <div class="divider">
          <span class="divider-line"></span>
          <span class="divider-text">或</span>
          <span class="divider-line"></span>
        </div>

        <div class="lobby-section">
          <h3>加入房间</h3>
          <p class="section-desc">输入好友分享的房间码加入</p>
          <div class="join-form">
            <input
              v-model="joinCode"
              class="code-input"
              type="text"
              maxlength="6"
              placeholder="输入6位房间码"
              @input="joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, '')"
            />
            <button
              class="action-btn join-btn"
              @click="$emit('joinRoom', joinCode)"
              :disabled="joinCode.length !== 6"
            >
              🚪 加入房间
            </button>
          </div>
          <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- 等待对手状态 -->
      <div v-else-if="networkState === 'waiting'" class="waiting-section">
        <div class="room-code-display">
          <p class="code-label">房间码</p>
          <div class="code-value" @click="copyCode">
            <span v-for="(ch, i) in roomCode.split('')" :key="i" class="code-char">{{ ch }}</span>
          </div>
          <p class="code-hint">点击房间码复制，分享给好友</p>
        </div>
        <div class="waiting-status">
          <span class="waiting-dot"></span>
          等待对手加入...
        </div>
        <button class="cancel-btn" @click="$emit('leaveRoom')">取消等待</button>
      </div>

      <!-- 游戏已开始 -->
      <div v-else-if="networkState === 'playing'" class="playing-section">
        <p class="playing-text">🎯 游戏进行中</p>
        <button class="cancel-btn" @click="$emit('leaveRoom')">退出房间</button>
      </div>

      <!-- 断开连接 -->
      <div v-else-if="networkState === 'disconnected'" class="disconnected-section">
        <p class="disconnected-text">⚠️ 连接已断开</p>
        <button class="action-btn create-btn" @click="$emit('close')">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { NetworkState } from '../composables/useNetwork'

interface Props {
  networkState: NetworkState
  roomCode: string
  errorMessage: string
  creating: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'createRoom'): void
  (e: 'joinRoom', code: string): void
  (e: 'leaveRoom'): void
}>()

const joinCode = ref('')
const copied = ref(false)

function copyCode() {
  const el = document.querySelector('.code-value')
  if (!el) return
  const code = el.textContent?.replace(/\s/g, '') || ''
  navigator.clipboard.writeText(code).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}
</script>

<style scoped>
.lobby-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.lobby-panel {
  background: linear-gradient(135deg, #2d1f4e, #1a1035);
  border-radius: 16px;
  padding: 32px;
  width: 90%;
  max-width: 420px;
  position: relative;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #a0aec0;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.lobby-title {
  text-align: center;
  color: #e9d8fd;
  font-size: 22px;
  margin: 0 0 24px 0;
}

.lobby-section {
  text-align: center;
}

.lobby-section h3 {
  color: #d6bcfa;
  font-size: 16px;
  margin: 0 0 8px 0;
}

.section-desc {
  color: #a0aec0;
  font-size: 13px;
  margin: 0 0 16px 0;
}

.action-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-btn {
  background: linear-gradient(135deg, #805ad5, #6b46c1);
  color: white;
  box-shadow: 0 4px 12px rgba(128, 90, 213, 0.3);
}

.create-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #9f7aea, #805ad5);
  box-shadow: 0 6px 16px rgba(128, 90, 213, 0.4);
}

.join-btn {
  background: linear-gradient(135deg, #38a169, #2f855a);
  color: white;
  box-shadow: 0 4px 12px rgba(56, 161, 105, 0.3);
}

.join-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #48bb78, #38a169);
  box-shadow: 0 6px 16px rgba(56, 161, 105, 0.4);
}

.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 20px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(167, 139, 250, 0.3), transparent);
}

.divider-text {
  color: #718096;
  font-size: 13px;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.code-input {
  width: 180px;
  padding: 12px 16px;
  border: 2px solid rgba(167, 139, 250, 0.3);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: white;
  font-size: 22px;
  text-align: center;
  letter-spacing: 8px;
  font-family: 'Courier New', monospace;
  outline: none;
  transition: border-color 0.2s;
  text-transform: uppercase;
}

.code-input:focus {
  border-color: #805ad5;
}

.code-input::placeholder {
  letter-spacing: 2px;
  font-size: 14px;
  color: #718096;
}

.error-msg {
  color: #fc8181;
  font-size: 13px;
  margin: 8px 0 0 0;
}

.waiting-section {
  text-align: center;
}

.room-code-display {
  margin-bottom: 20px;
}

.code-label {
  color: #a0aec0;
  font-size: 13px;
  margin: 0 0 8px 0;
}

.code-value {
  display: flex;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.code-value:hover {
  background: rgba(255, 255, 255, 0.05);
}

.code-char {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 52px;
  background: rgba(167, 139, 250, 0.15);
  border: 2px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  color: #e9d8fd;
  font-size: 24px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.code-hint {
  color: #718096;
  font-size: 12px;
  margin: 8px 0 0 0;
}

.waiting-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #e9d8fd;
  font-size: 16px;
  margin-bottom: 20px;
}

.waiting-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #805ad5;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.cancel-btn {
  padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  color: #a0aec0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: white;
}

.playing-section, .disconnected-section {
  text-align: center;
}

.playing-text {
  color: #e9d8fd;
  font-size: 18px;
  margin: 0 0 16px 0;
}

.disconnected-text {
  color: #fc8181;
  font-size: 18px;
  margin: 0 0 16px 0;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
