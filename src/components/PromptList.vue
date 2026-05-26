<script setup lang="ts">
import type { PromptUnit } from '../types'

defineProps<{
  items: PromptUnit[]
  activeIndex: number
  selectedId?: string
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'activate'): void
  (e: 'enterWizard'): void
}>()

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <div class="prompt-list">
    <!-- 有内容时 -->
    <template v-if="items.length > 0">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        :class="['list-item', { active: index === activeIndex, selected: item.id === selectedId }]"
        @click="emit('select', index); emit('activate')"
      >
        <span :class="['fav-dot', { on: item.favorited }]">●</span>
        <span class="item-title">{{ item.title }}</span>
        <span class="item-tags">
          <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag">#{{ tag }}</span>
          <span v-if="item.variables?.length" class="var-pill">
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            {{ item.variables.length }}
          </span>
        </span>
        <span class="item-meta">
          <span v-if="item.usageCount" class="usage-count">↻ {{ item.usageCount }}</span>
          <span v-if="item.lastUsedAt" class="date">{{ formatDate(item.lastUsedAt) }}</span>
        </span>
      </div>
    </template>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>未找到匹配的提示词</h3>
      <p v-if="prompt.query.value.trim()">按 <kbd>Enter</kbd> 或点击下方按钮新建</p>
      <p v-else>试试搜索其他关键词，或直接新建一个</p>
      <button class="btn primary" @click="emit('enterWizard')">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M8 3v10M3 8h10" />
        </svg>
        新建提示词
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { usePromptStore } from '../stores/prompt'
// 用于 template 中访问 prompt.query
const prompt = usePromptStore()
export default { setup() { return { prompt } } }
</script>

<style scoped>
.prompt-list {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 6px 10px 4px;
}
.list-item {
  height: 44px; display: flex; align-items: center;
  gap: 10px; padding: 0 12px;
  border-radius: var(--pf-radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.08s;
}
.list-item:hover { background: rgba(74, 111, 165, 0.04); }
.list-item.active,
.list-item.selected {
  background: var(--pf-primary-soft);
  border-color: rgba(74, 111, 165, 0.3);
  box-shadow: var(--pf-shadow-sm);
}
.fav-dot {
  flex: 0 0 8px; font-size: 8px;
  color: var(--pf-text-faint);
}
.fav-dot.on { color: var(--pf-gold); }
.item-title {
  font-size: 13.5px; font-weight: 500;
  color: var(--pf-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.005em;
}
.item-tags {
  display: flex; gap: 5px; flex: 0 0 auto; align-items: center;
}
.tag {
  font-size: 11px; color: var(--pf-tag-text);
  background: var(--pf-tag-bg); padding: 1px 7px;
  border-radius: 3px; line-height: 1.4; font-weight: 500;
}
.var-pill {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10.5px; color: var(--pf-primary);
  background: var(--pf-primary-soft); padding: 1px 6px 1px 4px;
  border-radius: 4px; font-weight: 600;
}
.item-meta {
  margin-left: auto; flex: 0 0 auto;
  display: flex; align-items: center; gap: 12px;
  font-size: 11.5px; color: var(--pf-text-faint);
}
.usage-count { color: var(--pf-gold); font-weight: 600; }

.empty-state {
  height: 100%; display: flex;
  flex-direction: column; align-items: center;
  justify-content: center; gap: 6px;
  color: var(--pf-text-muted);
}
.empty-icon { font-size: 24px; }
.empty-state h3 { font-size: 14px; font-weight: 500; color: var(--pf-text); margin: 0; }
.empty-state p { font-size: 12px; color: var(--pf-text-faint); margin: 0; }
.empty-state .btn { margin-top: 10px; }
</style>
