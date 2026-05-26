<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useAppSettings } from '../stores/app'
import { copyText, showNotification, hideMainWindow } from '../utils/platform'
import { renderVariables } from '../utils/index'
import PromptList from '../components/PromptList.vue'
import FillPanel from '../components/FillPanel.vue'

const router = useRouter()
const prompt = usePromptStore()
const appSettings = useAppSettings()

const categories = ['全部', '评审', '编码', '翻译', '写作', '问答', '其它']
const allTags = computed(() => {
  const tagSet = new Set<string>()
  for (const item of prompt.rawItems.value) {
    for (const t of item.tags) tagSet.add(t)
  }
  return [...tagSet].sort()
})
function countByCategory(cat: string) {
  if (cat === '全部') return prompt.rawItems.value.length
  return prompt.rawItems.value.filter(u => (u.category || '其它') === cat).length
}

async function handleCopy() {
  const unit = prompt.selectedUnit.value
  if (!unit) return
  try {
    let text: string
    if (unit.variables && unit.variables.length > 0) {
      const missing = unit.variables
        .filter(v => v.required)
        .filter(v => !prompt.variableValues.value[v.name]?.trim())
      if (missing.length > 0) {
        showNotification(`请填写: ${missing.map(v => v.name).join(', ')}`)
        return
      }
      text = renderVariables(unit.body, prompt.variableValues.value)
    } else {
      text = unit.body
    }
    await copyText(text)
    showNotification('✓ 已复制')
    await prompt.recordUsage(unit.id)
    if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
    prompt.resetSelection()
  } catch (e: any) {
    showNotification(`复制失败: ${e.message}`)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault()
    router.enterWizard(prompt.query.value.trim())
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault()
    router.navigateTo('settings')
    return
  }

  if (prompt.phase.value === 'search') {
    const tag = (e.target as HTMLElement)?.tagName
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

    if (e.key === 'Enter' && prompt.filteredItems.value.length === 0 && prompt.query.value.trim()) {
      e.preventDefault()
      router.enterWizard(prompt.query.value.trim())
      return
    }
    if (!isInput && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      router.navigateTo('compose')
      return
    }
    if (!isInput && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'e') && prompt.activeItem.value) {
      e.preventDefault()
      router.navigateTo('library')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      prompt.moveSelection('down')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      prompt.moveSelection('up')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = prompt.activeItem.value
      if (!item) return
      if (item.variables && item.variables.length > 0) {
        prompt.selectActive()
      } else {
        copyText(item.body).then(async () => {
          showNotification('✓ 已复制')
          await prompt.recordUsage(item.id)
          if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
        })
      }
    }
  } else if (prompt.phase.value === 'fill') {
    if (e.key === 'Escape') {
      e.preventDefault()
      prompt.phase.value = 'search'
      prompt.selectedUnit.value = null
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleCopy()
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <div class="call-view">
    <!-- 左侧分类栏（仅搜索阶段显示） -->
    <aside v-if="prompt.phase.value === 'search'" class="call-sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">分类</div>
        <button
          v-for="cat in categories"
          :key="cat"
          :class="['sidebar-btn', { active: prompt.filterCategory.value === cat }]"
          @click="prompt.filterCategory.value = cat"
        >
          <span class="btn-label">{{ cat }}</span>
          <span class="btn-count">{{ countByCategory(cat) }}</span>
        </button>
      </div>
      <div class="sidebar-section" v-if="allTags.length">
        <div class="sidebar-title">标签</div>
        <div class="tag-list">
          <button
            v-for="tag in allTags"
            :key="tag"
            :class="['tag-btn', { active: prompt.filterTag.value === tag }]"
            @click="prompt.filterTag.value = prompt.filterTag.value === tag ? '' : tag"
          >
            #{{ tag }}
          </button>
        </div>
      </div>
    </aside>

    <!-- 主内容区：列表 + footer 纵向排列 -->
    <div class="call-main">
      <div class="call-body">
        <template v-if="prompt.phase.value === 'search'">
          <PromptList
            :items="prompt.filteredItems.value"
            :active-index="prompt.keyboardIndex.value"
            :selected-id="prompt.selectedUnit.value?.id"
            @select="(i: number) => { prompt.keyboardIndex.value = i }"
            @activate="prompt.selectActive()"
            @enter-wizard="router.enterWizard(prompt.query.value.trim())"
          />
        </template>
        <template v-else>
          <FillPanel
            :unit="prompt.selectedUnit.value"
            :values="prompt.variableValues.value"
            @update:values="(v: Record<string, string>) => prompt.variableValues.value = v"
            @submit="handleCopy"
            @cancel="prompt.phase.value = 'search'; prompt.selectedUnit.value = null"
          />
        </template>
      </div>
      <footer class="call-footer">
        <span class="status-text">
          {{ prompt.phase.value === 'search'
            ? prompt.filteredItems.value.length + ' 条提示词'
            : '填写完成后按 Enter 复制' }}
        </span>
        <div class="keys">
          <template v-if="prompt.phase.value === 'search'">
            <kbd>↑</kbd><kbd>↓</kbd> 选择 <kbd>Enter</kbd> 复制 <kbd>E</kbd> 编辑
          </template>
          <template v-else>
            <kbd>Tab</kbd> 切换 <kbd>Esc</kbd> 返回
          </template>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.call-view {
  width: 100%; flex: 1; min-height: 0;
  display: flex;
  background: var(--pf-bg);
  user-select: none; overflow: hidden;
}
.call-sidebar {
  width: 160px; flex-shrink: 0;
  background: var(--pf-bg-elevated);
  border-right: 1px solid var(--pf-border);
  overflow-y: auto;
  padding: 12px;
  display: flex; flex-direction: column; gap: 16px;
}
.sidebar-title {
  font-size: 10.5px; font-weight: 700;
  color: var(--pf-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0 4px 6px;
}
.sidebar-btn {
  display: flex; align-items: center;
  width: 100%; padding: 6px 10px;
  border-radius: var(--pf-radius-sm);
  font-size: 12.5px; font-weight: 500;
  color: var(--pf-text-muted);
  transition: all 0.12s;
  text-align: left;
}
.sidebar-btn:hover { background: var(--pf-surface-hover); color: var(--pf-text); }
.sidebar-btn.active {
  background: var(--pf-accent-soft);
  color: var(--pf-accent);
  font-weight: 600;
}
.btn-label { flex: 1; }
.btn-count {
  font-size: 10.5px; font-weight: 600;
  color: var(--pf-text-faint);
  font-family: var(--pf-font-mono);
}
.sidebar-btn.active .btn-count { color: var(--pf-accent); }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 4px; }
.tag-btn {
  font-size: 11px; font-weight: 500;
  padding: 3px 8px;
  border-radius: var(--pf-radius-pill);
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  color: var(--pf-text-muted);
  transition: all 0.12s;
}
.tag-btn:hover { border-color: var(--pf-border-hover); color: var(--pf-text); }
.tag-btn.active {
  background: var(--pf-accent);
  color: #fff;
  border-color: var(--pf-accent);
}
.call-body {
  flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
}
.call-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.call-footer {
  height: 34px; flex-shrink: 0;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg-elevated);
  display: flex; align-items: center;
  padding: 0 20px; gap: 16px;
  font-size: 12px;
}
.status-text { color: var(--pf-text-muted); flex: 1; }
.keys { display: flex; gap: 4px; align-items: center; font-size: 11px; color: var(--pf-text-faint); }
.keys kbd {
  font: 9px/1 var(--pf-font-mono);
  background: var(--pf-surface-raised);
  border: 1px solid var(--pf-border);
  border-radius: 3px; padding: 1px 4px;
  color: var(--pf-text-muted);
}
</style>
