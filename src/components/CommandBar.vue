<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'

const router = useRouter()
const prompt = usePromptStore()
const inputRef = ref<HTMLInputElement | null>(null)
const focused = ref(false)
</script>

<template>
  <div class="command-bar">
    <!-- 搜索框 -->
    <div :class="['search-box', { focused: focused || prompt.query.value }]">
      <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref="inputRef"
        v-model="prompt.query.value"
        type="text"
        placeholder="搜索提示词…"
        @focus="focused = true"
        @blur="focused = false"
      />
      <span v-if="prompt.query.value" class="clear-btn" @click="prompt.query.value = ''">×</span>
    </div>

    <!-- 视图切换 -->
    <div class="view-switcher">
      <button :class="{ active: router.currentRoute.value === 'call' }" @click="router.navigateTo('call')">调用</button>
      <button :class="{ active: router.currentRoute.value === 'compose' }" @click="router.navigateTo('compose')">组合</button>
      <button :class="{ active: router.currentRoute.value === 'library' }" @click="router.navigateTo('library')">编辑</button>
    </div>

    <!-- 右侧按钮 -->
    <div class="right-actions">
      <button class="new-btn" title="新建提示词" @click="router.enterWizard(prompt.query.value.trim())">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
      <div class="more-btn" title="设置" @click="router.navigateTo('settings')">⋮</div>
    </div>
  </div>
</template>

<style scoped>
.command-bar {
  height: 50px; flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: 10px;
  padding: 0 14px;
  background: var(--pf-surface);
  border-bottom: 1px solid var(--pf-border);
}
.search-box {
  flex: 1; min-width: 0;
  height: 34px;
  background: var(--pf-bg);
  border: 1px solid var(--pf-border);
  border-radius: 8px;
  display: flex; align-items: center;
  gap: 8px; padding: 0 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-box.focused {
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px rgba(74, 111, 165, 0.1);
}
.search-icon { flex: 0 0 14px; opacity: 0.5; color: var(--pf-text-muted); }
.search-box input {
  flex: 1; min-width: 0; border: 0; outline: 0;
  background: transparent; font-size: 13px;
  color: var(--pf-text);
}
.search-box input::placeholder { color: var(--pf-text-faint); }
.clear-btn {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--pf-border-strong); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; cursor: pointer;
}
.view-switcher {
  display: flex;
  background: var(--pf-bg);
  border: 1px solid var(--pf-border);
  border-radius: 8px;
  padding: 3px; gap: 2px;
}
.view-switcher button {
  border: 0; background: transparent;
  color: var(--pf-text-muted); padding: 4px 14px;
  border-radius: 6px; font-size: 12px; font-weight: 500;
}
.view-switcher button.active {
  background: var(--pf-primary); color: #fff;
  box-shadow: var(--pf-shadow-xs);
}
.right-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.new-btn {
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--pf-radius-sm);
  border: 1px solid var(--pf-border);
  background: var(--pf-surface);
  color: var(--pf-text-muted);
  transition: background 0.12s, color 0.12s;
}
.new-btn:hover { background: var(--pf-primary-soft); color: var(--pf-primary); border-color: var(--pf-primary); }
.more-btn {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  color: var(--pf-text-muted); cursor: pointer;
  border-radius: 6px; font-size: 16px; font-weight: 700;
}
.more-btn:hover { background: rgba(0,0,0,0.04); }
</style>
