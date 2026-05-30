<template>
  <div class="controls">
    <div class="controls-row">
      <button class="btn btn-primary" @click="actions.reset">
        <span class="btn-icon">🔄</span>
        <span>重新开始</span>
      </button>
      <button class="btn btn-primary" @click="actions.toggleMoveMode">
        <span class="btn-icon">📐</span>
        <span>{{ modeButtonText }}</span>
      </button>
      <button class="btn btn-secondary" @click="actions.toggleRules">
        <span class="btn-icon">📖</span>
        <span>规则</span>
      </button>
    </div>
    <div class="controls-row">
      <button class="btn btn-accent" @click="actions.toggleAI">
        <span class="btn-icon">🤖</span>
        <span>{{ aiEnabled ? '关闭AI' : '开启AI' }}</span>
      </button>
      <button 
        v-if="aiEnabled"
        class="btn btn-accent" 
        @click="actions.switchAIPlayer"
      >
        <span class="btn-icon">👤</span>
        <span>AI:{{ aiPlayer === 'black' ? '黑方' : '白方' }}</span>
      </button>
    </div>
    <div v-if="aiEnabled" class="level-section">
      <div class="level-header">
        <span class="level-divider"></span>
        <span class="level-title">AI 难度</span>
        <span class="level-divider"></span>
      </div>
      <div class="level-grid">
        <button
          v-for="(config, level) in AI_LEVELS"
          :key="level"
          class="level-btn"
          :class="['level-' + level, { active: Number(level) === aiLevel }]"
          :title="config.description"
          @click="actions.changeAILevel(Number(level) as AILevel)"
        >
          <span class="level-icon">{{ levelIcons[level as unknown as keyof typeof levelIcons] }}</span>
          <span class="level-name">{{ config.name }}</span>
        </button>
      </div>
      <div class="level-hint" v-if="currentAIConfig">
        <span class="hint-icon">💡</span>
        {{ currentAIConfig.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PieceColor, AILevel, AILevelConfig } from '../types'

interface Props {
  modeButtonText: string
  aiEnabled: boolean
  aiPlayer: PieceColor
  aiLevel: AILevel
  currentAIConfig: AILevelConfig | null
  AI_LEVELS: Record<AILevel, AILevelConfig>
  actions: {
    reset: () => void
    toggleMoveMode: () => void
    toggleRules: () => void
    toggleAI: () => void
    switchAIPlayer: () => void
    changeAILevel: (level: AILevel) => void
  }
}

defineProps<Props>()

const levelIcons: Record<number, string> = {
  1: '⚪',
  2: '⚫',
  3: '♟️',
  4: '♞',
  5: '♜',
  6: '👑'
}
</script>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 560px;
  padding: 0 8px;
}

.controls-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 100px;
  white-space: nowrap;
}

.btn:active {
  transform: scale(0.95);
}

.btn-icon {
  font-size: 16px;
}

.btn-primary {
  background: linear-gradient(135deg, #c05621, #9c4221);
  color: white;
  box-shadow: 0 2px 4px rgba(192, 86, 33, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #dd6b20, #c05621);
  box-shadow: 0 4px 8px rgba(192, 86, 33, 0.4);
}

.btn-secondary {
  background: linear-gradient(135deg, #4a5568, #2d3748);
  color: white;
  box-shadow: 0 2px 4px rgba(74, 85, 104, 0.3);
}

.btn-secondary:hover {
  background: linear-gradient(135deg, #718096, #4a5568);
  box-shadow: 0 4px 8px rgba(74, 85, 104, 0.4);
}

.btn-accent {
  background: linear-gradient(135deg, #2b6cb0, #2c5282);
  color: white;
  box-shadow: 0 2px 4px rgba(43, 108, 176, 0.3);
}

.btn-accent:hover {
  background: linear-gradient(135deg, #3182ce, #2b6cb0);
  box-shadow: 0 4px 8px rgba(43, 108, 176, 0.4);
}

.level-section {
  padding: 16px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.level-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 14px;
}

.level-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(167, 243, 208, 0.3), transparent);
}

.level-title {
  color: #a7f3d0;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 2px;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.level-btn {
  padding: 14px 12px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.level-icon {
  font-size: 22px;
  line-height: 1;
}

.level-name {
  font-weight: 500;
}

.level-btn:hover {
  background: rgba(167, 243, 208, 0.12);
}

.level-1 { border-color: rgba(167, 243, 208, 0.3); }
.level-1:hover { border-color: #a7f3d0; }
.level-1.active {
  background: rgba(167, 243, 208, 0.2);
  border-color: #a7f3d0;
  color: white;
}

.level-2 { border-color: rgba(110, 231, 183, 0.3); }
.level-2:hover { border-color: #6ee7b7; }
.level-2.active {
  background: rgba(110, 231, 183, 0.2);
  border-color: #6ee7b7;
  color: white;
}

.level-3 { border-color: rgba(52, 211, 153, 0.3); }
.level-3:hover { border-color: #34d399; }
.level-3.active {
  background: rgba(52, 211, 153, 0.2);
  border-color: #34d399;
  color: white;
}

.level-4 { border-color: rgba(16, 185, 129, 0.3); }
.level-4:hover { border-color: #10b981; }
.level-4.active {
  background: rgba(16, 185, 129, 0.2);
  border-color: #10b981;
  color: white;
}

.level-5 { border-color: rgba(5, 150, 105, 0.3); }
.level-5:hover { border-color: #059669; }
.level-5.active {
  background: rgba(5, 150, 105, 0.25);
  border-color: #059669;
  color: white;
}

.level-6 { border-color: rgba(4, 120, 87, 0.4); }
.level-6:hover { border-color: #047857; }
.level-6.active {
  background: rgba(4, 120, 87, 0.3);
  border-color: #047857;
  color: white;
  box-shadow: 0 0 10px rgba(4, 120, 87, 0.3);
}

.level-hint {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  color: #e2e8f0;
  border-left: 3px solid #34d399;
}

.hint-icon {
  margin-right: 6px;
}

@media (max-width: 480px) {
  .btn {
    padding: 12px 12px;
    font-size: 13px;
    min-width: 80px;
  }
  
  .btn-icon {
    font-size: 14px;
  }
  
  .level-section {
    padding: 12px;
  }
  
  .level-btn {
    padding: 12px 10px;
    font-size: 13px;
  }
  
  .level-icon {
    font-size: 20px;
  }
  
  .level-hint {
    font-size: 13px;
    padding: 8px 12px;
  }
}
</style>