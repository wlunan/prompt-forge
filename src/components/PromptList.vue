<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { PromptItem } from '../types'
import { usePromptStore } from '../stores/prompt'

defineProps<{
  items: PromptItem[]
  activeIndex: number
  selectedId?: string
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'activate'): void
  (e: 'enterWizard'): void
  (e: 'toggleFavorite', id: string): void
}>()

const prompt = usePromptStore()

function timeAgo(dateVal?: string | number): string {
  if (!dateVal) return ''
  const diff = Date.now() - new Date(dateVal).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
</script>

<template>
  <div class="list-wrap">
    <template v-if="items.length > 0">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        :class="['card', { active: index === activeIndex }]"
        @click="emit('select', index); emit('activate')"
      >
        <div class="card-left">
          <button :class="['dot', { fav: item.favorite }]" @click.stop="emit('toggleFavorite', item.id)">
            {{ item.favorite ? '★' : '☆' }}
          </button>
        </div>
        <div class="card-body">
          <div class="card-title">{{ item.title }}</div>
          <div class="card-meta">
            <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag">#{{ tag }}</span>
            <span v-if="item.variables?.length" class="tag accent">{{ item.variables.length }} 变量</span>
            <span v-if="item.usageCount" class="usage">{{ item.usageCount }}次</span>
            <span v-if="item.lastUsedAt" class="time">{{ timeAgo(item.lastUsedAt) }}</span>
          </div>
        </div>
        <div class="card-right">
          <span class="ver">v{{ item.version || 1 }}</span>
        </div>
      </div>
    </template>

    <div v-else class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <p class="empty-title">没有找到提示词</p>
      <p class="empty-desc">{{ prompt.query.value.trim() ? '试试其他关键词' : '点击右上角 + 创建第一个' }}</p>
      <button v-if="!prompt.query.value.trim()" class="btn primary" @click="emit('enterWizard')">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        创建提示词
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-wrap {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 12px 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.card {
  display: flex; align-items: center;
  gap: 14px; padding: 14px 16px;
  border-radius: var(--pf-radius-md);
  border: 1px solid var(--pf-border);
  background: var(--pf-surface);
  cursor: pointer;
  transition: all 0.15s ease;
}
.card:hover {
  border-color: var(--pf-border-hover);
  background: var(--pf-surface-hover);
  transform: translateY(-1px);
  box-shadow: var(--pf-shadow-sm);
}
.card.active {
  border-color: var(--pf-accent);
  background: var(--pf-accent-soft);
  box-shadow: 0 0 0 1px var(--pf-accent-soft);
}
.card-left { flex-shrink: 0; }
.dot {
  width: 20px; height: 20px; border-radius: 50%;
  background: none; border: none; cursor: pointer;
  font-size: 14px; color: var(--pf-text-faint);
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s;
}
.dot:hover { color: var(--pf-warning); }
.dot.fav { color: var(--pf-warning); }
.card-body { flex: 1; min-width: 0; }
.card-title {
  font-size: 14px; font-weight: 600;
  color: var(--pf-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 4px;
}
.card.active .card-title { color: var(--pf-accent); }
.card-meta {
  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
}
.tag {
  font-size: 11px; font-weight: 500;
  padding: 2px 8px; border-radius: var(--pf-radius-pill);
  background: var(--pf-surface-raised);
  color: var(--pf-text-muted);
}
.tag.accent {
  background: var(--pf-accent-soft);
  color: var(--pf-accent);
  font-weight: 600;
}
.usage {
  font-size: 11px; font-weight: 600;
  color: var(--pf-accent);
  font-family: var(--pf-font-mono);
}
.time {
  font-size: 11px;
  color: var(--pf-text-faint);
  margin-left: auto;
}
.card-right { flex-shrink: 0; }
.ver {
  font-size: 11px; font-weight: 600;
  color: var(--pf-text-faint);
  font-family: var(--pf-font-mono);
  padding: 2px 8px;
  background: var(--pf-surface-raised);
  border-radius: var(--pf-radius-xs);
}

.empty {
  flex: 1; display: flex;
  flex-direction: column; align-items: center;
  justify-content: center; gap: 8px;
  padding: 40px 20px;
}
.empty-icon { color: var(--pf-text-faint); opacity: 0.5; }
.empty-title { font-size: 15px; font-weight: 600; color: var(--pf-text); margin: 0; }
.empty-desc { font-size: 13px; color: var(--pf-text-muted); margin: 0; }
.empty .btn { margin-top: 8px; }
</style>
