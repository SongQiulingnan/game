<template>
  <Transition name="rules">
    <div class="rules-box" v-if="show">
      <div class="rules-header">
        <h3>游戏规则</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="rules-content">
        <div class="rule-section">
          <h4>一、棋盘与初始布局</h4>
          <p>棋盘由主棋盘（4×4方格，5×5交点）与顶部菱形区域（田字/山）组成。黑方5枚棋子初始位于左侧（x=0），白方5枚棋子初始位于右侧（x=4）。双方各有5枚备用棋子用于吃子后补位。</p>
        </div>
        <div class="rule-section">
          <h4>二、移动规则</h4>
          <p>游戏支持一步模式与多步模式，可在对局中随时切换。一步模式每步只能沿连线移动一格；多步模式可沿直线（横、竖、对角）移动任意格数，不可越过其他棋子。</p>
        </div>
        <div class="rule-section rule-highlight">
          <h4>三、延长点定义</h4>
          <p><strong>延长点</strong>是指吃子结构两端沿直线方向延伸的<strong>第一个交点</strong>，只检查这一个位置，更远的点不检查。</p>
          <p class="rule-example">夹吃：[延长点] 己—敌—己 [延长点]</p>
          <p class="rule-example">挑吃：[延长点] 敌—己—敌 [延长点]</p>
        </div>
        <div class="rule-section">
          <h4>四、夹吃</h4>
          <p>在同一直线上，两枚己方棋子紧夹一枚敌方棋子（己—敌—己）。限制：该吃子结构两端的延长点上不能有敌方棋子，仅限此三子都在的那一条线上。若延长点上有己方棋子，不影响吃子。执行：吃掉被夹的敌棋，在其原位补上一枚己方备用棋子。</p>
        </div>
        <div class="rule-section">
          <h4>五、挑吃</h4>
          <p>一枚己方棋子移动到两枚敌方棋子中间（敌—己—敌）。限制：该吃子结构两端的延长点上不能有敌方棋子，仅限此三子都在的那一条线上。执行：同时吃掉两枚敌棋，在两枚被吃棋子原位各补上一枚己方备用棋子。</p>
        </div>
        <div class="rule-section">
          <h4>六、连环吃子</h4>
          <p>吃子后，如果补位的棋子又形成新的吃子条件，则继续执行吃子。连环吃子自动进行，无次数限制，直到不能继续吃子为止。</p>
        </div>
        <div class="rule-section">
          <h4>七、独子不夹</h4>
          <p>当敌方棋盘上仅剩一枚棋子时，该子不能被夹吃；当敌方棋盘上仅剩两枚棋子时，该两子不能被挑吃。此时只能通过围困使其无路可走，从而获胜。</p>
        </div>
        <div class="rule-section">
          <h4>八、围困获胜</h4>
          <p>将敌方棋子吃到仅剩一枚，并将其围困在顶部菱形区域内使其无法移动，即判获胜。</p>
        </div>
        <div class="rule-section">
          <h4>九、无子可动获胜</h4>
          <p>若敌方棋子数量大于1，但全局无任何棋子可以移动，则当前行棋方直接获胜。</p>
        </div>
        <div class="rule-section">
          <h4>十、复活机制</h4>
          <p>当同时满足以下三个条件时触发复活：己方仅剩最后一枚棋子；该棋子不在顶部菱形区域内；该棋子当前无法移动。复活操作：可在主棋盘任意空交点落子，消耗1枚己方备用棋子，回合交给对方。若备用棋子已耗尽则无法复活。</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  show: boolean
}

defineProps<Props>()

defineEmits<{
  (e: 'close'): void
}>()
</script>

<style scoped>
.rules-box {
  max-width: 560px;
  width: 100%;
  background: linear-gradient(135deg, #6b3e2e, #5a3325);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  align-self: center;
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: rgba(0, 0, 0, 0.15);
}

.rules-header h3 {
  color: #fbd38d;
  font-size: 16px;
  margin: 0;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #e5d5c5;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.rules-content {
  padding: 16px 18px;
  max-height: 400px;
  overflow-y: auto;
}

.rule-section {
  margin-bottom: 14px;
}

.rule-section:last-child {
  margin-bottom: 0;
}

.rule-section h4 {
  color: #fbd38d;
  font-size: 14px;
  margin: 0 0 6px 0;
  padding-left: 10px;
  border-left: 3px solid #c05621;
}

.rule-section p {
  color: #e5d5c5;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

.rule-highlight {
  background: rgba(192, 86, 33, 0.15);
  padding: 10px 12px;
  border-radius: 8px;
  border-left: 3px solid #c05621;
}

.rule-example {
  font-family: monospace;
  color: #fbd38d;
  margin-top: 6px;
  font-size: 12px;
}

/* 动画 */
.rules-enter-active {
  transition: all 0.3s ease-out;
}

.rules-leave-active {
  transition: all 0.2s ease-in;
}

.rules-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.rules-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (min-width: 768px) {
  .rules-box {
    max-width: 600px;
  }
}

@media (max-width: 480px) {
  .rules-content {
    padding: 12px 14px;
    max-height: 300px;
  }
  
  .rule-section h4 {
    font-size: 13px;
  }
  
  .rule-section p {
    font-size: 12px;
  }
}
</style>