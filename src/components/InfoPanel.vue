<template>
  <div class="info-panel">
    <div class="player-card black-card">
      <div class="player-header">
        <div class="player-avatar black-avatar">⚫</div>
        <div class="player-name">黑方</div>
      </div>
      <div class="player-stats">
        <div class="stat-item">
          <span class="stat-label">棋盘</span>
          <span class="stat-value">{{ blackBoardCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">备用</span>
          <span class="stat-value">{{ reserves.black }}</span>
        </div>
      </div>
    </div>
    
    <div class="vs-divider">
      <div class="vs-line"></div>
      <div class="vs-badge">VS</div>
      <div class="vs-line"></div>
    </div>
    
    <div class="player-card white-card">
      <div class="player-header">
        <div class="player-avatar white-avatar">⚪</div>
        <div class="player-name">白方</div>
      </div>
      <div class="player-stats">
        <div class="stat-item">
          <span class="stat-label">棋盘</span>
          <span class="stat-value">{{ whiteBoardCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">备用</span>
          <span class="stat-value">{{ reserves.white }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Reserves } from '../types'

interface Props {
  reserves: Reserves
  blackBoardCount: number
  whiteBoardCount: number
}

defineProps<Props>()
</script>

<style scoped>
.info-panel {
  display: flex;
  align-items: stretch;
  width: 100%;
  background: linear-gradient(135deg, #6b3e2e, #5a3325);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.player-card {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.black-card {
  background: rgba(0, 0, 0, 0.15);
}

.white-card {
  background: rgba(255, 255, 255, 0.08);
}

.player-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.black-avatar {
  background: linear-gradient(135deg, #4a5568, #2d3748);
  border: 2px solid #a0aec0;
}

.white-avatar {
  background: linear-gradient(135deg, #ffffff, #e2e8f0);
  border: 2px solid #718096;
}

.player-name {
  font-weight: bold;
  font-size: 16px;
  color: #fbd38d;
}

.player-stats {
  display: flex;
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: #c8a882;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.vs-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.vs-line {
  width: 2px;
  flex: 1;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.3), transparent);
}

.vs-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c05621, #9c4221);
  color: white;
  font-weight: bold;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(192, 86, 33, 0.4);
  margin: 8px 0;
}

@media (max-width: 480px) {
  .player-card {
    padding: 10px;
    gap: 8px;
  }
  
  .player-avatar {
    width: 30px;
    height: 30px;
    font-size: 14px;
  }
  
  .player-name {
    font-size: 14px;
  }
  
  .stat-label {
    font-size: 10px;
  }
  
  .stat-value {
    font-size: 18px;
  }
  
  .vs-badge {
    width: 28px;
    height: 28px;
    font-size: 11px;
  }
}
</style>