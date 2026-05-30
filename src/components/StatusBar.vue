<template>
  <div class="status-container">
    <div class="status-bar" :style="{ color: statusColor }">
      {{ statusText }}
    </div>
    <div class="mode-display">
      {{ modeText }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  statusText: string
  statusColor: string
  modeText: string
}

defineProps<Props>()
</script>

<style scoped>
.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.status-bar {
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  min-height: 28px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.mode-display {
  font-size: 13px;
  color: #e5d5c5;
  background: linear-gradient(135deg, #6b3e2e, #5a3325);
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

@media (max-width: 480px) {
  .status-bar {
    font-size: 16px;
  }
  
  .mode-display {
    font-size: 12px;
    padding: 5px 12px;
  }
}
</style>