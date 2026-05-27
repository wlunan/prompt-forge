<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useProjectStore } from '../stores/project'
import { useAppSettings } from '../stores/app'
import { copyText, showNotification, hideMainWindow } from '../utils/platform'
import { renderVariables } from '../utils/index'
import PromptList from '../components/PromptList.vue'
import FillPanel from '../components/FillPanel.vue'
import type { ProjectGroup } from '../types'

const router = useRouter()
const prompt = usePromptStore()
const projectStore = useProjectStore()
const appSettings = useAppSettings()

const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectGroup = ref<ProjectGroup>('开发')
const newProjectDesc = ref('')

const sideNav = computed(() => [
  { key: 'recent' as const, label: '最近', icon: '🕘' },
  { key: 'favorite' as const, label: '收藏', icon: '⭐' },
  { key: 'project' as const, label: '项目', icon: '📁' },
  { key: 'asset' as const, label: '资产', icon: '📦' },
  { key: 'trash' as const, label: '回收站', icon: '🗑' },
])

async function handleCopy() {
  const unit = prompt.selectedPrompt.value
  if (!unit) return
  try {
    let text: string
    if (unit.variables && unit.variables.length > 0) {
      const missing = unit.variables.filter(v => v.required).filter(v => !prompt.variableValues.value[v.name]?.trim())
      if (missing.length > 0) { showNotification(`请填写: ${missing.map(v => v.name).join(', ')}`); return }
      text = renderVariables(unit.content, prompt.variableValues.value)
    } else {
      text = unit.content
    }
    await copyText(text)
    showNotification('✓ 已复制')
    await prompt.recordUsage(unit.id)
    if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
    prompt.resetSelection()
  } catch (e: any) { showNotification(`复制失败: ${e.message}`) }
}

function createProject() {
  if (!newProjectName.value.trim()) return
  projectStore.addProject(newProjectName.value.trim(), newProjectGroup.value, newProjectDesc.value)
  newProjectName.value = ''; newProjectDesc.value = ''; showNewProject.value = false
  showNotification('✓ 项目已创建')
}

function selectProject(projectId: string) {
  prompt.filterProjectId.value = projectId
  prompt.spaceTab.value = 'project'
}

function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); router.enterWizard(prompt.query.value.trim()); return }

  if (prompt.phase.value === 'search') {
    const tag = (e.target as HTMLElement)?.tagName
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA'
    if (e.key === 'Enter' && prompt.filteredCallItems.value.length === 0 && prompt.query.value.trim()) {
      e.preventDefault(); router.enterWizard(prompt.query.value.trim()); return
    }
    if (!isInput && e.key.toLowerCase() === 'c') { e.preventDefault(); router.navigateTo('compose'); return }
    if (!isInput && e.key.toLowerCase() === 'e') { e.preventDefault(); router.navigateTo('manage'); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); prompt.moveSelection('down') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); prompt.moveSelection('up') }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const item = prompt.activeItem.value
      if (!item) return
      if (item.variables && item.variables.length > 0) prompt.selectActive()
      else {
        copyText(item.content).then(async () => {
          showNotification('✓ 已复制')
          await prompt.recordUsage(item.id)
          if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
        })
      }
    }
  } else if (prompt.phase.value === 'fill') {
    if (e.key === 'Escape') { e.preventDefault(); prompt.phase.value = 'search'; prompt.selectedPrompt.value = null }
    else if (e.key === 'Enter') { e.preventDefault(); handleCopy() }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  // 自动聚焦搜索框
  setTimeout(() => { const input = document.querySelector('.main-search') as HTMLInputElement; input?.focus() }, 100)
})
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<template>
  <div class="space-view">
    <aside class="space-sidebar">
      <div v-for="nav in sideNav" :key="nav.key"
        :class="['side-btn', { active: prompt.spaceTab.value === nav.key }]"
        @click="prompt.spaceTab.value = nav.key; prompt.activePromptId = ''"
      >
        <span class="side-icon">{{ nav.icon }}</span>
        <span class="side-label">{{ nav.label }}</span>
        <span v-if="nav.key === 'trash'" class="side-count">{{ prompt.trashItems.value.length }}</span>
      </div>
      <div class="side-foot">
        <button class="btn new-btn" @click="router.enterWizard('')">+ 新建</button>
        <button class="btn icon-sm" title="设置" @click="router.navigateTo('settings')">⚙</button>
      </div>
    </aside>

    <div class="space-main">
      <!-- 项目 tab：显示分组 -->
      <template v-if="prompt.spaceTab.value === 'project'">
        <div class="project-header">
          <span class="ph-title">项目</span>
          <button class="btn" @click="showNewProject = !showNewProject">+ 新建</button>
        </div>
        <div v-if="showNewProject" class="new-project-form">
          <input v-model="newProjectName" placeholder="项目名称" class="np-input" />
          <select v-model="newProjectGroup" class="np-select"><option v-for="g in projectStore.GROUPS" :key="g">{{ g }}</option></select>
          <button class="btn primary" @click="createProject">创建</button>
        </div>
        <div class="project-list">
          <div v-for="group in projectStore.GROUPS" :key="group">
            <template v-if="projectStore.groupedProjects.value[group]?.length">
              <div class="group-label">{{ group }}</div>
              <div v-for="p in projectStore.groupedProjects.value[group]" :key="p.id"
                :class="['project-item', { active: prompt.filterProjectId.value === p.id }]"
                @click="selectProject(p.id)">
                <span class="pi-name">{{ p.name }}</span>
                <span class="pi-count">{{ prompt.liveItems.value.filter(i => i.projectId === p.id).length }}</span>
              </div>
            </template>
          </div>
          <div v-if="!prompt.filterProjectId.value" class="all-prompts" @click="prompt.filterProjectId.value = ''">
            全部项目提示词 ({{ prompt.liveItems.value.filter(i => i.projectId).length }})
          </div>
        </div>
      </template>

      <!-- 其他 tab：标签栏 + 搜索 + 列表 -->
      <template v-else>
        <div v-if="prompt.spaceTab.value !== 'trash' && prompt.allTags.value.length" class="tag-bar">
          <button
            v-for="tag in prompt.allTags.value.slice(0, 10)"
            :key="tag"
            :class="['tag-pill', { active: prompt.filterTag.value === tag }]"
            @click="prompt.filterTag.value = prompt.filterTag.value === tag ? '' : tag"
          >
            #{{ tag }}
          </button>
        </div>
        <template v-if="prompt.phase.value === 'search'">
          <div class="search-bar">
            <input
              ref="inputRef"
              v-model="prompt.query.value"
              type="text"
              placeholder="搜索提示词…"
              class="main-search"
            />
            <button class="btn primary quick-create" @click="router.enterWizard(prompt.query.value.trim())">
              <svg viewBox="0 0 16 16" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
                <line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" />
              </svg>
              新建
            </button>
            <span class="result-count">{{ prompt.filteredCallItems.value.length }} 条</span>
          </div>
          <PromptList
            :items="prompt.filteredCallItems.value"
            :active-index="prompt.keyboardIndex.value"
            :selected-id="prompt.selectedPrompt.value?.id"
            @select="(i: number) => { prompt.keyboardIndex.value = i }"
            @activate="prompt.selectActive()"
            @enter-wizard="router.enterWizard(prompt.query.value.trim())"
          />
        </template>
        <template v-else>
          <FillPanel
            :unit="prompt.selectedPrompt.value"
            :values="prompt.variableValues.value"
            @update:values="(v: Record<string, string>) => prompt.variableValues.value = v"
            @submit="handleCopy"
            @cancel="prompt.phase.value = 'search'; prompt.selectedPrompt.value = null"
          />
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.space-view { width: 100%; flex: 1; min-height: 0; display: flex; background: var(--pf-bg); user-select: none; overflow: hidden; }

.space-sidebar {
  width: 180px; flex-shrink: 0;
  background: var(--pf-bg-elevated);
  border-right: 1px solid var(--pf-border);
  display: flex; flex-direction: column;
  padding: 8px;
}
.side-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: var(--pf-radius-sm);
  font-size: 13px; color: var(--pf-text-muted);
  cursor: pointer; transition: all 0.12s;
}
.side-btn:hover { background: var(--pf-surface-hover); color: var(--pf-text); }
.side-btn.active { background: var(--pf-accent-soft); color: var(--pf-accent); font-weight: 600; }
.side-icon { font-size: 15px; width: 20px; text-align: center; }
.side-label { flex: 1; }
.side-count { font-size: 11px; font-weight: 600; color: var(--pf-text-faint); font-family: var(--pf-font-mono); }
.side-foot { margin-top: auto; padding: 8px 0; display: flex; flex-direction: column; gap: 4px; }
.side-foot .new-btn { width: 100%; justify-content: center; font-size: 12px; }
.side-foot .icon-sm { width: 100%; justify-content: center; font-size: 16px; color: var(--pf-text-muted); padding: 6px; border-radius: var(--pf-radius-sm); }
.side-foot .icon-sm:hover { background: var(--pf-surface-hover); color: var(--pf-text); }

.space-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }

.tag-bar {
  display: flex; gap: 4px; padding: 8px 14px;
  border-bottom: 1px solid var(--pf-border);
  overflow-x: auto; flex-shrink: 0;
}
.tag-pill {
  font-size: 11px; font-weight: 500;
  padding: 3px 10px; border-radius: var(--pf-radius-pill);
  background: var(--pf-surface); border: 1px solid var(--pf-border);
  color: var(--pf-text-muted); white-space: nowrap;
  transition: all 0.12s;
}
.tag-pill:hover { border-color: var(--pf-border-hover); color: var(--pf-text); }
.tag-pill.active { background: var(--pf-accent); color: #fff; border-color: var(--pf-accent); }

.search-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; flex-shrink: 0;
}
.main-search {
  flex: 1; height: 36px;
  background: var(--pf-surface); border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-pill);
  padding: 0 16px; font-size: 13.5px; color: var(--pf-text);
}
.main-search:focus { border-color: var(--pf-accent); outline: none; box-shadow: 0 0 0 3px var(--pf-accent-soft); }
.main-search::placeholder { color: var(--pf-text-faint); }
.quick-create { flex-shrink: 0; height: 32px; padding: 0 12px; font-size: 12px; }
.result-count { font-size: 12px; color: var(--pf-text-muted); white-space: nowrap; }

/* 项目 */
.project-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--pf-border); }
.ph-title { font-size: 15px; font-weight: 700; }
.new-project-form { display: flex; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--pf-border); }
.np-input { flex: 1; height: 32px; padding: 0 10px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); background: var(--pf-surface); font-size: 12.5px; }
.np-input:focus { border-color: var(--pf-accent); outline: none; }
.np-select { height: 32px; padding: 0 8px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); background: var(--pf-surface); font-size: 12px; }
.project-list { flex: 1; overflow-y: auto; padding: 8px 12px; }
.group-label { font-size: 10.5px; font-weight: 700; color: var(--pf-text-faint); text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 4px 4px; }
.project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 10px; border-radius: var(--pf-radius-sm);
  cursor: pointer; transition: all 0.12s;
}
.project-item:hover { background: var(--pf-surface-hover); }
.project-item.active { background: var(--pf-accent-soft); color: var(--pf-accent); font-weight: 600; }
.pi-name { font-size: 13px; }
.pi-count { font-size: 11px; color: var(--pf-text-faint); font-family: var(--pf-font-mono); }
.all-prompts { padding: 8px 10px; font-size: 12px; color: var(--pf-text-muted); cursor: pointer; border-radius: var(--pf-radius-sm); }
.all-prompts:hover { background: var(--pf-surface-hover); }
</style>
