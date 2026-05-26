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

const editTab = ref<'body' | 'vars' | 'stats'>('body')
const editBody = ref('')
const editTitle = ref('')
const editCategory = ref('其它')
const editTags = ref<string[]>([])
const tagInput = ref('')
const editVars = ref<Variable[]>([])

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
      return u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q) || u.tags.some(t => t.toLowerCase().includes(q))
    }
    return true
  })
})

watch(filteredItems, (items) => {
  if (items.length === 0) { selectedId.value = ''; return }
  // 不自动选中第一条，让用户自己点
}, { immediate: true })

function addTag() { const t = tagInput.value.trim(); if (t && !editTags.value.includes(t)) editTags.value.push(t); tagInput.value = '' }
function removeTag(t: string) { editTags.value = editTags.value.filter(x => x !== t) }
function addVar() { editVars.value.push({ name: `var_${editVars.value.length + 1}`, required: true, defaultValue: '' }) }
function removeVar(i: number) { editVars.value.splice(i, 1) }

async function saveEdit() {
  await promptStore.ensureReady()
  const unit = selectedUnit.value
  if (!unit) return
  const bodyChanged = editBody.value !== unit.body
  const idx = promptStore.rawItems.value.findIndex(u => u.id === unit.id)
  if (idx === -1) return
  const detected = extractVariables(editBody.value)
  // 合并：正文中的变量 + 手动添加的变量（去重）
  const seen = new Set<string>()
  const vars: Variable[] = []
  for (const d of detected) {
    const existing = editVars.value.find(v => v.name === d.name)
    vars.push({ name: d.name, required: existing?.required ?? d.required, defaultValue: existing?.defaultValue ?? d.defaultValue })
    seen.add(d.name)
  }
  for (const v of editVars.value) {
    if (!seen.has(v.name)) { vars.push({ ...v }); seen.add(v.name) }
  }
  const newVersion = bodyChanged ? (unit.version || 1) + 1 : (unit.version || 1)
  const now = new Date().toISOString()
  if (bodyChanged && unit.snapshots) { unit.snapshots.push({ version: unit.version || 1, body: unit.body, note: `编辑保存为版本 V${newVersion}`, createdAt: now }) }
  promptStore.rawItems.value[idx] = { ...unit, title: editTitle.value.trim() || unit.title, body: editBody.value, category: editCategory.value, tags: editTags.value, variables: vars, version: newVersion, updatedAt: now }
  await promptStore.persistAll()
  showNotification('✓ 保存成功')
}

async function deleteUnit() {
  const unit = selectedUnit.value
  if (!unit) return
  if (!confirm(`确定删除「${unit.title}」？`)) return
  promptStore.rawItems.value = promptStore.rawItems.value.filter(u => u.id !== unit.id)
  await promptStore.persistAll()
  selectedId.value = filteredItems.value[0]?.id || ''
}

async function handleCopy() {
  const unit = selectedUnit.value
  if (!unit) return
  try { await copyText(unit.body); showNotification('✓ 已复制'); await promptStore.recordUsage(unit.id) } catch {}
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    const items = filteredItems.value
    if (items.length === 0) return
    const idx = items.findIndex(i => i.id === selectedId.value)
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0)
    selectedId.value = items[next]?.id || ''
  }
}
onMounted(() => window.addEventListener('keydown', handleKey))
onUnmounted(() => window.removeEventListener('keydown', handleKey))
</script>

<template>
  <div class="library-view">
    <!-- 左侧列表 -->
    <div class="lib-sidebar">
      <div class="sidebar-head">
        <div class="scope-switch">
          <button :class="{ active: scope === 'prompt' }" @click="scope = 'prompt'">提示词 <span class="badge">{{ promptStore.rawItems.value.filter(u => u.type === 'prompt').length }}</span></button>
          <button :class="{ active: scope === 'fragment' }" @click="scope = 'fragment'">片段 <span class="badge">{{ promptStore.rawItems.value.filter(u => u.type === 'fragment').length }}</span></button>
        </div>
        <div class="sidebar-search">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="searchQuery" placeholder="搜索…" />
        </div>
        <select v-model="categoryFilter" class="filter-select">
          <option>全部分类</option><option>评审</option><option>写作</option><option>翻译</option><option>编码</option><option>其它</option>
        </select>
      </div>
      <div class="lib-list">
        <div v-for="item in filteredItems" :key="item.id" :class="['lib-item', { active: item.id === selectedId }]" @click="selectedId = item.id">
          <div class="item-head"><span v-if="item.favorited" class="star">★</span>{{ item.title }}</div>
          <div class="item-meta"><span class="v-tag">v{{ item.version || 1 }}</span><span>{{ item.category || '其它' }}</span><span class="spacer"></span><span class="count">{{ item.usageCount }}次</span></div>
        </div>
        <div v-if="filteredItems.length === 0" class="empty-list">没有匹配项</div>
      </div>
      <div class="sidebar-foot">
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
          <div class="field"><label>标题</label><input v-model="editTitle" /></div>
          <div class="field"><label>正文</label><textarea v-model="editBody" class="body-editor" /></div>
        </template>
        <template v-else-if="editTab === 'vars'">
          <div class="var-head"><h3>变量配置</h3><button class="btn" @click="addVar">+ 添加</button></div>
          <div v-if="editVars.length" class="var-table">
            <div class="var-row header"><div>变量名</div><div>默认值</div><div style="text-align:center">必填</div><div></div></div>
            <div v-for="(v, i) in editVars" :key="i" class="var-row"><input v-model="v.name" /><input v-model="v.defaultValue" placeholder="默认值…" /><div style="text-align:center"><input type="checkbox" v-model="v.required" /></div><button class="del-btn" @click="removeVar(i)">×</button></div>
          </div>
          <div v-else class="empty-msg">没有变量</div>
        </template>
        <template v-else>
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-val">{{ selectedUnit.usageCount }}</div><div class="stat-lbl">累计复制</div></div>
            <div class="stat-card"><div class="stat-val">v{{ selectedUnit.version || 1 }}</div><div class="stat-lbl">当前版本</div></div>
            <div class="stat-card"><div class="stat-val">{{ selectedUnit.variables?.length || 0 }}</div><div class="stat-lbl">变量数</div></div>
          </div>
          <div class="stat-row"><strong>创建：</strong>{{ new Date(selectedUnit.createdAt).toLocaleString() }}</div>
          <div class="stat-row"><strong>更新：</strong>{{ new Date(selectedUnit.updatedAt).toLocaleString() }}</div>
        </template>
      </div>
      <div class="editor-footer">
        <button class="btn danger" @click="deleteUnit">删除</button>
        <span class="spacer"></span>
        <button class="btn" @click="handleCopy">复制</button>
        <button class="btn primary" @click="saveEdit">保存 v{{ (selectedUnit.version || 1) + (editBody !== selectedUnit.body ? 1 : 0) }}</button>
      </div>
    </div>
    <div v-else class="empty-editor">请在左侧选择提示词</div>
  </div>
</template>

<style scoped>
.library-view { width: 100%; flex: 1; min-height: 0; display: grid; grid-template-columns: 260px 1fr; background: var(--pf-bg); overflow: hidden; }
.lib-sidebar { display: flex; flex-direction: column; border-right: 1px solid var(--pf-border); background: var(--pf-bg-elevated); }
.sidebar-head { padding: 12px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--pf-border); }
.scope-switch { display: flex; gap: 4px; }
.scope-switch button { flex: 1; height: 30px; border-radius: var(--pf-radius-sm); font-size: 12px; font-weight: 500; color: var(--pf-text-muted); background: var(--pf-surface); border: 1px solid var(--pf-border); display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s; }
.scope-switch button.active { background: var(--pf-accent); color: #fff; border-color: var(--pf-accent); }
.badge { font-size: 10px; background: rgba(255,255,255,0.25); padding: 0 5px; border-radius: 8px; }
.scope-switch button:not(.active) .badge { background: var(--pf-surface-raised); color: var(--pf-text-muted); }
.sidebar-search { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; background: var(--pf-surface); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); }
.sidebar-search svg { opacity: 0.4; flex-shrink: 0; }
.sidebar-search input { flex: 1; font-size: 12.5px; }
.filter-select { height: 28px; font-size: 11.5px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-xs); background: var(--pf-surface); padding: 0 8px; }
.lib-list { flex: 1; overflow-y: auto; padding: 8px; }
.lib-item { padding: 10px 12px; border-radius: var(--pf-radius-sm); cursor: pointer; border: 1px solid transparent; transition: all 0.12s; }
.lib-item:hover { background: var(--pf-surface-hover); }
.lib-item.active { background: var(--pf-accent-soft); border-color: var(--pf-accent); }
.item-head { font-size: 13px; font-weight: 500; color: var(--pf-text); display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.star { color: var(--pf-warning); font-size: 11px; }
.item-meta { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--pf-text-muted); margin-top: 3px; }
.v-tag { background: var(--pf-success-soft); color: var(--pf-success); padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 600; }
.count { color: var(--pf-accent); font-weight: 600; }
.spacer { flex: 1; }
.empty-list { padding: 24px; text-align: center; font-size: 12px; color: var(--pf-text-faint); }
.sidebar-foot { padding: 10px; border-top: 1px solid var(--pf-border); }
.sidebar-foot .btn { width: 100%; justify-content: center; }

.lib-editor { display: flex; flex-direction: column; background: var(--pf-surface); }
.editor-tabs { height: 38px; display: flex; align-items: center; gap: 4px; padding: 0 16px; border-bottom: 1px solid var(--pf-border); background: var(--pf-bg-elevated); }
.editor-tabs button { border: 0; background: none; color: var(--pf-text-muted); padding: 4px 12px; font-size: 13px; font-weight: 500; position: relative; height: 38px; transition: color 0.15s; }
.editor-tabs button.active { color: var(--pf-accent); font-weight: 600; }
.editor-tabs button.active::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: 0; height: 2px; background: var(--pf-accent); border-radius: 1px; }
.tab-info { margin-left: auto; font-size: 11px; color: var(--pf-text-faint); font-family: var(--pf-font-mono); }
.editor-content { flex: 1; overflow-y: auto; padding: 20px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 12px; font-weight: 600; color: var(--pf-text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.field input, .field textarea { width: 100%; border: 1px solid var(--pf-border); background: var(--pf-surface); border-radius: var(--pf-radius-sm); padding: 10px 14px; font-size: 13.5px; }
.field input:focus, .field textarea:focus { border-color: var(--pf-accent); outline: none; box-shadow: 0 0 0 3px var(--pf-accent-soft); }
.body-editor { min-height: 200px; resize: vertical; font-family: var(--pf-font-mono); line-height: 1.6; }
.var-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.var-head h3 { font-size: 14px; margin: 0; }
.var-table { border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); }
.var-row { display: grid; grid-template-columns: 1fr 1fr 50px 30px; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--pf-border); }
.var-row.header { font-size: 11px; font-weight: 600; color: var(--pf-text-muted); background: var(--pf-bg-elevated); }
.var-row input { height: 30px; padding: 2px 8px; font-size: 12px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-xs); }
.var-row input:focus { border-color: var(--pf-accent); outline: none; }
.del-btn { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--pf-danger); color: var(--pf-danger); background: var(--pf-danger-soft); display: flex; align-items: center; justify-content: center; font-size: 14px; }
.del-btn:hover { background: var(--pf-danger); color: #fff; }
.empty-msg { padding: 32px; text-align: center; color: var(--pf-text-muted); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.stat-card { border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); padding: 16px; text-align: center; background: var(--pf-bg-elevated); }
.stat-val { font-size: 22px; font-weight: 700; color: var(--pf-accent); }
.stat-lbl { font-size: 11px; color: var(--pf-text-faint); margin-top: 4px; }
.stat-row { font-size: 13px; margin-bottom: 6px; }
.stat-row strong { color: var(--pf-text-muted); }
.editor-footer { height: 50px; border-top: 1px solid var(--pf-border); padding: 0 16px; display: flex; align-items: center; gap: 8px; background: var(--pf-bg-elevated); }
.empty-editor { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--pf-text-faint); font-size: 13px; }
</style>
