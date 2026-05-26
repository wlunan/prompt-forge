<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useAppSettings } from '../stores/app'
import { copyText, showNotification, hideMainWindow } from '../utils/platform'
import { renderVariables } from '../utils/index'
import CommandBar from '../components/CommandBar.vue'
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
      text = renderVariables(unit.body, prompt.variableValues.value)
      // 检查必填项
      const missing = unit.variables
        .filter(v => v.required)
        .filter(v => !prompt.variableValues.value[v.name]?.trim())
      if (missing.length > 0) {
        showNotification(`请填写必填变量: ${missing.map(v => v.name).join(', ')}`)
        return
      }
    } else {
      text = unit.body
    }
    await copyText(text)
    showNotification('✓ 提示词已复制到剪贴板')
    prompt.recordUsage(unit.id)
    if (appSettings.settings.value.closeAfterCopy) {
      hideMainWindow()
    }
    // 复制成功后返回搜索
    prompt.resetSelection()
  } catch (e: any) {
    showNotification(`复制失败: ${e.message || e}`)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  // 全局快捷键
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
    if (!isInput && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'l') && prompt.activeItem.value) {
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
        copyText(item.body).then(() => {
          showNotification('✓ 提示词已复制到剪贴板')
          prompt.recordUsage(item.id)
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
    <CommandBar />
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
    <div class="call-footer">
      <span class="footer-info">
        <span class="info-dot">i</span>
        {{ prompt.phase.value === 'search'
          ? `共 ${prompt.filteredItems.value.length} 条提示词`
          : (prompt.selectedUnit.value?.variables?.length ? '填写变量后按 Enter 复制' : '按 Enter 复制') }}
      </span>
      <div class="footer-keys">
        <span v-if="prompt.phase.value === 'search'">
          <kbd>↑</kbd><kbd>↓</kbd> 选择
          <kbd style="margin-left:8px">Enter</kbd> 复制
          <kbd style="margin-left:8px">E</kbd> 编辑
          <kbd style="margin-left:8px">Esc</kbd> 关闭
        </span>
        <span v-else>
          <kbd>Tab</kbd> 切换
          <kbd style="margin-left:8px">Esc</kbd> 返回
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg);
  user-select: none;
  overflow: hidden;
}
.call-body {
  flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
}
.call-footer {
  height: 40px; flex-shrink: 0;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
  display: flex; align-items: center;
  padding: 0 16px; gap: 10px;
  font-size: 12px; color: var(--pf-text-muted);
}
.footer-info {
  display: flex; align-items: center; gap: 8px;
  flex: 1; overflow: hidden; white-space: nowrap;
  text-overflow: ellipsis;
}
.info-dot {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--pf-primary-soft); color: var(--pf-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-style: italic; font-weight: 600; font-size: 10px;
  flex-shrink: 0;
}
.footer-keys {
  color: var(--pf-text-faint); font-size: 11px;
  display: flex; gap: 4px; align-items: center;
}
</style>
