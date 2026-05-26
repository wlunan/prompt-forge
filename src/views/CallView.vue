<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
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
</template>

<style scoped>
.call-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg);
  user-select: none; overflow: hidden;
  flex: 1; min-height: 0;
}
.call-body {
  flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
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
