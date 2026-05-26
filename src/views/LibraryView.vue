<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { extractVariables } from '../utils/index'
import type { PromptUnit, Variable } from '../types'
import { useAppSettings } from '../stores/app'
import { copyText, showNotification, hideMainWindow } from '../utils/platform'

const router = useRouter()
const promptStore = usePromptStore()
const appSettings = useAppSettings()

const scope = ref<'prompt' | 'fragment'>('prompt')
const searchQuery = ref('')
const categoryFilter = ref('全部分类')
const selectedId = ref('')

const selectedUnit = computed(() => promptStore.rawItems.value.find(u => u.id === selectedId.value) || null)

// 编辑状态
const editTab = ref<'body' | 'vars' | 'stats'>('body')
const editBody = ref('')
const editTitle = ref('')
const editCategory = ref('其它')
const editTags = ref<string[]>([])
const tagInput = ref('')
const editVars = ref<Variable[]>([])

// 当选中项变化时同步编辑状态
watch(selectedUnit, (unit) => {
  if (!unit) return
  editBody.value = unit.body
  editTitle.value = unit.title
  editCategory.value = unit.category || '其它'
  editTags.value = [...unit.tags]
  editVars.value = unit.variables ? JSON.parse(JSON.stringify(unit.variables)) : []
}, { immediate: true })

const filteredItems = computed(() => {
  return promptStore.sortedItems.value.filter(u => {
    if (u.type !== scope.value) return false
    if (categoryFilter.value !== '全部分类' && (u.category || '其它') !== categoryFilter.value) return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      return u.title.toLowerCase().includes(q) ||
        u.body.toLowerCase().includes(q) ||
        u.tags.some(t => t.toLowerCase().includes(q))
    }
    return true
  })
})

watch(filteredItems, (items) => {
  if (items.length === 0) { selectedId.value = ''; return }
  if (!selectedId.value || !items.some(i => i.id === selectedId.value)) {
    selectedId.value = items[0]?.id || ''
  }
}, { immediate: true })

function addTag() {
  const t = tagInput.value.trim()
  if (t && !editTags.value.includes(t)) editTags.value.push(t)
  tagInput.value = ''
}
function removeTag(t: string) { editTags.value = editTags.value.filter(x => x !== t) }

function addVar() {
  editVars.value.push({ name: `var_${editVars.value.length + 1}`, required: true, defaultValue: '' })
}
function removeVar(i: number) { editVars.value.splice(i, 1) }

async function saveEdit() {
  await promptStore.ensureReady()
  const unit = selectedUnit.value
  if (!unit) return
  const bodyChanged = editBody.value !== unit.body
  const idx = promptStore.rawItems.value.findIndex(u => u.id === unit.id)
  if (idx === -1) return
  // 提取变量
  const detected = extractVariables(editBody.value)
  const vars = detected.map(d => {
    const existing = editVars.value.find(v => v.name === d.name)
    return { name: d.name, required: existing?.required ?? d.required, defaultValue: existing?.defaultValue ?? d.defaultValue }
  })
  const newVersion = bodyChanged ? (unit.version || 1) + 1 : (unit.version || 1)
  const now = new Date().toISOString()
  // 保存快照
  if (bodyChanged && unit.snapshots) {
    unit.snapshots.push({ version: unit.version || 1, body: unit.body, note: `编辑保存为版本 V${newVersion}`, createdAt: now })
  }
  promptStore.rawItems.value[idx] = {
    ...unit,
    title: editTitle.value.trim() || unit.title,
    body: editBody.value,
    category: editCategory.value,
    tags: editTags.value,
    variables: vars,
    version: newVersion,
    updatedAt: now,
  }
  await promptStore.persistAll()
  showNotification('✓ 保存成功！')
}

async function deleteUnit() {
  const unit = selectedUnit.value
  if (!unit) return
  if (!confirm(`确定要彻底删除《${unit.title}》吗？`)) return
  promptStore.rawItems.value = promptStore.rawItems.value.filter(u => u.id !== unit.id)
  await promptStore.persistAll()
  selectedId.value = filteredItems.value[0]?.id || ''
  showNotification('✓ 已删除')
}

async function handleCopy() {
  const unit = selectedUnit.value
  if (!unit) return
  try {
    await copyText(unit.body)
    showNotification('✓ 已复制')
    await promptStore.recordUsage(unit.id)
    if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
  } catch (e: any) {
    showNotification(`复制失败: ${e.message}`)
  }
}

// 键盘导航
function handleKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    const items = filteredItems.value
    if (items.length === 0) return
    const idx = items.findIndex(i => i.id === selectedId.value)
    const next = e.key === 'ArrowDown'
      ? Math.min(idx + 1, items.length - 1)
      : Math.max(idx - 1, 0)
    selectedId.value = items[next]?.id || ''
  }
}
onMounted(() => window.addEventListener('keydown', handleKey))
onUnmounted(() => window.removeEventListener('keydown', handleKey))
</script>

<template>
  <div class="library-view">
    <!-- 顶栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="router.navigateTo('call')">←</button>
      <span class="bar-title">编辑库</span>
      <div class="view-switcher">
        <button :class="{ active: scope === 'prompt' }" @click="scope = 'prompt'">
          提示词
          <span class="badge">{{ promptStore.rawItems.value.filter(u => u.type === 'prompt').length }}</span>
        </button>
        <button :class="{ active: scope === 'fragment' }" @click="scope = 'fragment'">
          片段
          <span class="badge">{{ promptStore.rawItems.value.filter(u => u.type === 'fragment').length }}</span>
        </button>
      </div>
      <div class="spacer"></div>
      <button class="new-btn" title="新建" @click="router.enterWizard('')">+</button>
      <div class="more-btn" title="设置" @click="router.navigateTo('settings')">⋮</div>
    </div>

    <div class="library-body">
      <!-- 左侧列表 -->
      <div class="lib-sidebar">
        <div class="lib-search">
          <input v-model="searchQuery" placeholder="搜索…" />
          <select v-model="categoryFilter">
            <option>全部分类</option>
            <option>评审</option>
            <option>写作</option>
            <option>翻译</option>
            <option>编码</option>
            <option>其它</option>
          </select>
        </div>
        <div class="lib-list">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            :class="['lib-item', { active: item.id === selectedId }]"
            @click="selectedId = item.id"
          >
            <div class="item-head">
              <span v-if="item.favorited" class="star">★</span>
              {{ item.title }}
            </div>
            <div class="item-meta">
              <span class="v-tag">v{{ item.version || 1 }}</span>
              <span>{{ item.category || '其它' }}</span>
              <span class="spacer"></span>
              <span class="count">{{ item.usageCount }} 次</span>
            </div>
          </div>
          <div v-if="filteredItems.length === 0" class="empty-list">没有匹配的提示词</div>
        </div>
        <div class="lib-footer">
          <button class="btn" @click="router.enterWizard('')">+ 新建</button>
        </div>
      </div>

      <!-- 右侧编辑器 -->
      <div v-if="selectedUnit" class="lib-editor">
        <div class="editor-tabs">
          <button :class="{ active: editTab === 'body' }" @click="editTab = 'body'">正文</button>
          <button :class="{ active: editTab === 'vars' }" @click="editTab = 'vars'">变量</button>
          <button :class="{ active: editTab === 'stats' }" @click="editTab = 'stats'">统计</button>
          <span class="tab-info">v{{ selectedUnit.version || 1 }}</span>
        </div>

        <div class="editor-content">
          <template v-if="editTab === 'body'">
            <div class="field">
              <label>标题</label>
              <input v-model="editTitle" placeholder="提示词标题" />
            </div>
            <div class="field">
              <label>正文</label>
              <textarea v-model="editBody" class="body-editor" placeholder="编写提示词正文…" />
            </div>
          </template>
          <template v-else-if="editTab === 'vars'">
            <div class="var-config-head">
              <h3>变量配置</h3>
              <button class="btn" @click="addVar">+ 添加变量</button>
            </div>
            <div v-if="editVars.length" class="var-config-table">
              <div class="var-row header">
                <div>变量名</div><div>默认值</div><div style="text-align:center">必填</div><div></div>
              </div>
              <div v-for="(v, i) in editVars" :key="i" class="var-row">
                <input v-model="v.name" class="mini-input" />
                <input v-model="v.defaultValue" class="mini-input" placeholder="默认值…" />
                <div style="text-align:center"><input type="checkbox" v-model="v.required" /></div>
                <button class="del-btn" @click="removeVar(i)">×</button>
              </div>
            </div>
            <div v-else class="no-vars-hint">没有变量。可直接写静态提示词内容。</div>
          </template>
          <template v-else>
            <div class="stats-grid">
              <div class="stat-card"><div class="stat-val">{{ selectedUnit.usageCount }}</div><div class="stat-lbl">累计复制</div></div>
              <div class="stat-card"><div class="stat-val">v{{ selectedUnit.version || 1 }}</div><div class="stat-lbl">当前版本</div></div>
              <div class="stat-card"><div class="stat-val">{{ selectedUnit.variables?.length || 0 }}</div><div class="stat-lbl">变量数量</div></div>
            </div>
            <div class="stat-row"><strong>创建时间：</strong>{{ new Date(selectedUnit.createdAt).toLocaleString() }}</div>
            <div class="stat-row"><strong>更新时间：</strong>{{ new Date(selectedUnit.updatedAt).toLocaleString() }}</div>
          </template>
        </div>

        <div class="editor-footer">
          <button class="btn danger" @click="deleteUnit">删除</button>
          <span class="spacer"></span>
          <button class="btn" @click="handleCopy">复制正文</button>
          <button class="btn primary" @click="saveEdit">保存 v{{ (selectedUnit.version || 1) + (editBody !== selectedUnit.body ? 1 : 0) }}</button>
        </div>
      </div>

      <div v-else class="empty-editor">
        <div>请在左侧选择需要编辑的提示词</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg);
  user-select: none; overflow: hidden;
}
.top-bar {
  height: 50px; flex-shrink: 0;
  display: grid; grid-template-columns: auto auto 1fr auto auto;
  align-items: center; gap: 12px;
  padding: 0 14px;
  background: var(--pf-surface);
  border-bottom: 1px solid var(--pf-border);
}
.back-btn {
  width: 28px; height: 28px; border: 0; background: transparent;
  color: var(--pf-text-muted); font-size: 16px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.back-btn:hover { background: var(--pf-bg); }
.bar-title { font-size: 13px; font-weight: 600; color: var(--pf-text); }
.view-switcher {
  display: flex; background: var(--pf-bg);
  border: 1px solid var(--pf-border); border-radius: 8px;
  padding: 3px; gap: 2px;
}
.view-switcher button {
  border: 0; background: transparent; color: var(--pf-text-muted);
  padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 5px;
}
.view-switcher button.active { background: var(--pf-primary); color: #fff; }
.badge {
  font-size: 10px; background: rgba(255,255,255,0.25);
  padding: 0 5px; border-radius: 8px;
}
.view-switcher button:not(.active) .badge { background: var(--pf-tag-bg); color: var(--pf-text-muted); }
.spacer { flex: 1; }
.new-btn {
  width: 30px; height: 30px; border-radius: var(--pf-radius-sm);
  border: 1px solid var(--pf-border); background: var(--pf-surface);
  color: var(--pf-text-muted); font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}
.new-btn:hover { background: var(--pf-primary-soft); color: var(--pf-primary); }
.more-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  color: var(--pf-text-muted); border-radius: 6px; font-size: 16px; font-weight: 700;
}
.more-btn:hover { background: rgba(0,0,0,0.04); }

.library-body {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: 240px 1fr; gap: 0;
}
.lib-sidebar {
  border-right: 1px solid var(--pf-border);
  background: var(--pf-bg);
  display: flex; flex-direction: column; min-height: 0;
}
.lib-search { padding: 10px 10px 8px; display: flex; flex-direction: column; gap: 6px; }
.lib-search input {
  height: 30px; border: 1px solid var(--pf-border); border-radius: 6px;
  background: var(--pf-surface); padding: 0 10px; font-size: 12px; outline: none;
}
.lib-search input:focus { border-color: var(--pf-primary); }
.lib-search select {
  height: 24px; font-size: 11px; border: 1px solid var(--pf-border);
  border-radius: 4px; background: var(--pf-surface); padding: 0 6px; outline: none;
}
.lib-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 6px 10px; }
.lib-item {
  padding: 8px 10px; border-radius: var(--pf-radius-sm);
  cursor: pointer; border: 1px solid transparent;
}
.lib-item:hover { background: rgba(74, 111, 165, 0.04); }
.lib-item.active { background: var(--pf-primary-soft); border-color: var(--pf-primary); }
.item-head {
  font-size: 13px; font-weight: 500; color: var(--pf-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
}
.star { color: var(--pf-gold); font-size: 11px; }
.item-meta {
  display: flex; gap: 8px; align-items: center;
  font-size: 11px; color: var(--pf-text-muted); margin-top: 3px;
}
.v-tag { background: var(--pf-success-soft); color: var(--pf-success); padding: 0 4px; border-radius: 3px; font-size: 10px; font-weight: 600; }
.count { color: var(--pf-gold); font-weight: 600; }
.empty-list { padding: 24px 0; text-align: center; font-size: 12px; color: var(--pf-text-faint); }
.lib-footer { padding: 8px 10px; border-top: 1px solid var(--pf-border); display: flex; gap: 6px; }
.lib-footer .btn { flex: 1; justify-content: center; }

.lib-editor {
  display: flex; flex-direction: column; min-height: 0;
  background: var(--pf-surface);
}
.editor-tabs {
  height: 36px; flex-shrink: 0;
  display: flex; align-items: center; gap: 4px;
  padding: 0 14px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-surface-raised);
}
.editor-tabs button {
  border: 0; background: transparent; color: var(--pf-text-muted);
  padding: 4px 10px; font-size: 12.5px; font-weight: 500;
  position: relative; height: 36px;
}
.editor-tabs button.active { color: var(--pf-primary); font-weight: 600; }
.editor-tabs button.active::after {
  content: ''; position: absolute; left: 8px; right: 8px; bottom: 0;
  height: 2px; background: var(--pf-primary); border-radius: 1px;
}
.tab-info { margin-left: auto; font-size: 11px; color: var(--pf-text-faint); }

.editor-content { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; color: var(--pf-text-muted); font-weight: 500; margin-bottom: 6px; }
.field input, .field textarea {
  width: 100%; border: 1px solid var(--pf-border);
  background: var(--pf-surface); color: var(--pf-text);
  border-radius: var(--pf-radius-sm); padding: 8px 10px;
  font-size: 13px; outline: 0;
}
.field input:focus, .field textarea:focus { border-color: var(--pf-primary); }
.body-editor { min-height: 200px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.6; }
.var-config-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.var-config-head h3 { font-size: 14px; font-weight: 600; margin: 0; }
.var-config-table { border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); }
.var-row {
  display: grid; grid-template-columns: 1fr 1fr 50px 30px;
  gap: 8px; align-items: center; padding: 6px 10px;
  border-bottom: 1px solid var(--pf-border-soft);
}
.var-row.header { font-size: 11px; font-weight: 600; color: var(--pf-text-muted); background: var(--pf-surface-raised); }
.mini-input {
  height: 28px; padding: 2px 6px; font-size: 12px;
  border: 1px solid var(--pf-border); border-radius: var(--pf-radius-xs);
  background: var(--pf-surface); outline: none; width: 100%;
}
.mini-input:focus { border-color: var(--pf-primary); }
.del-btn {
  width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--pf-danger);
  color: var(--pf-danger); background: var(--pf-danger-soft);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; cursor: pointer;
}
.del-btn:hover { background: var(--pf-danger); color: #fff; }
.no-vars-hint { padding: 24px; text-align: center; font-size: 12.5px; color: var(--pf-text-muted); }

.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.stat-card {
  border: 1px solid var(--pf-border); background: var(--pf-surface-raised);
  border-radius: var(--pf-radius-sm); padding: 16px; text-align: center;
}
.stat-val { font-size: 22px; font-weight: 700; color: var(--pf-primary); }
.stat-lbl { font-size: 11px; color: var(--pf-text-faint); margin-top: 4px; }
.stat-row { font-size: 12.5px; color: var(--pf-text); margin-bottom: 6px; }
.stat-row strong { color: var(--pf-text-muted); }

.editor-footer {
  height: 48px; flex-shrink: 0;
  border-top: 1px solid var(--pf-border);
  padding: 0 16px; display: flex; align-items: center; gap: 8px;
  background: var(--pf-surface-raised);
}
.empty-editor {
  flex: 1; display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--pf-text-faint);
}
</style>
