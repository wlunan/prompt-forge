<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useProjectStore } from '../stores/project'
import { extractVariables } from '../utils/index'
import type { PromptItem, Variable } from '../types'
import { showNotification } from '../utils/platform'

const router = useRouter()
const prompt = usePromptStore()
const projectStore = useProjectStore()

const selectedId = ref('')
const editTab = ref<'content' | 'vars' | 'stats'>('content')
const editBody = ref('')
const editTitle = ref('')
const editTags = ref<string[]>([])
const tagInput = ref('')
const editVars = ref<Variable[]>([])

const selectedUnit = computed(() => prompt.rawItems.value.find(i => i.id === selectedId.value) || null)

watch(selectedUnit, (u) => {
  if (!u) return
  editBody.value = u.content || ''; editTitle.value = u.title || ''
  editTags.value = [...(u.tags || [])]
  editVars.value = u.variables ? JSON.parse(JSON.stringify(u.variables)) : []
}, { immediate: true })

function addTag() { const t = tagInput.value.trim(); if (t && !editTags.value.includes(t)) editTags.value.push(t); tagInput.value = '' }
function removeTag(t: string) { editTags.value = editTags.value.filter(x => x !== t) }
function addVar() { editVars.value.push({ name: `var_${editVars.value.length + 1}`, required: true, defaultValue: '' }) }
function removeVar(i: number) { editVars.value.splice(i, 1) }

async function saveEdit() {
  const u = selectedUnit.value
  if (!u) return
  const bodyChanged = editBody.value !== u.content
  const detected = extractVariables(editBody.value)
  const seen = new Set<string>()
  const vars: Variable[] = []
  for (const d of detected) {
    const existing = editVars.value.find(v => v.name === d.name)
    vars.push({ name: d.name, required: existing?.required ?? d.required, defaultValue: existing?.defaultValue ?? d.defaultValue })
    seen.add(d.name)
  }
  for (const v of editVars.value) { if (!seen.has(v.name)) { vars.push({ ...v }); seen.add(v.name) } }
  const newVersion = bodyChanged ? (u.version || 1) + 1 : (u.version || 1)
  const now = Date.now()
  if (bodyChanged && u.snapshots) u.snapshots.push({ version: u.version || 1, body: u.content, note: `编辑 V${newVersion}`, createdAt: now })
  prompt.updateItem(u.id, {
    title: editTitle.value.trim() || u.title,
    content: editBody.value, tags: editTags.value, variables: vars,
    version: newVersion,
  })
  showNotification('✓ 保存成功')
}

async function deleteUnit() {
  const u = selectedUnit.value; if (!u) return
  if (!confirm(`确定删除「${u.title}」？`)) return
  prompt.softDelete(u.id)
  selectedId.value = ''
}

onMounted(() => { prompt.ensureReady() })
</script>

<template>
  <div class="manage">
    <div class="m-sidebar">
      <div class="m-head">
        <input v-model="prompt.query.value" class="m-search" placeholder="搜索…" />
      </div>
      <div class="m-list">
        <div v-for="item in prompt.liveItems.value" :key="item.id" :class="['m-item', { active: item.id === selectedId }]" @click="selectedId = item.id">
          <div class="mi-title"><span v-if="item.favorite" class="star">★</span>{{ item.title }}</div>
          <div class="mi-meta"><span class="type-tag">{{ item.type }}</span><span class="spacer"></span><span class="cnt">{{ item.usageCount }}次</span></div>
        </div>
      </div>
      <div class="m-foot"><button class="btn" @click="router.enterWizard('')">+ 新建</button></div>
    </div>
    <div v-if="selectedUnit" class="m-editor">
      <div class="tabs">
        <button :class="{ active: editTab === 'content' }" @click="editTab = 'content'">正文</button>
        <button :class="{ active: editTab === 'vars' }" @click="editTab = 'vars'">变量</button>
        <button :class="{ active: editTab === 'stats' }" @click="editTab = 'stats'">统计</button>
        <span class="ti">v{{ selectedUnit.version || 1 }}</span>
      </div>
      <div class="ec">
        <template v-if="editTab === 'content'">
          <div class="field"><label>标题</label><input v-model="editTitle" /></div>
          <div class="field"><label>正文</label><textarea v-model="editBody" class="body-editor" /></div>
        </template>
        <template v-else-if="editTab === 'vars'">
          <div class="vh"><h3>变量配置</h3><button class="btn" @click="addVar">+ 添加</button></div>
          <div v-if="editVars.length" class="vt">
            <div class="vr header"><div>变量名</div><div>默认值</div><div style="text-align:center">必填</div><div></div></div>
            <div v-for="(v, i) in editVars" :key="i" class="vr"><input v-model="v.name" /><input v-model="v.defaultValue" placeholder="默认…" /><div style="text-align:center"><input type="checkbox" v-model="v.required" /></div><button class="db" @click="removeVar(i)">×</button></div>
          </div>
          <div v-else class="empty">没有变量</div>
        </template>
        <template v-else>
          <div class="stats-grid">
            <div class="sc"><div class="sv">{{ selectedUnit.usageCount }}</div><div class="sl">复制次数</div></div>
            <div class="sc"><div class="sv">v{{ selectedUnit.version || 1 }}</div><div class="sl">版本</div></div>
            <div class="sc"><div class="sv">{{ selectedUnit.variables?.length || 0 }}</div><div class="sl">变量</div></div>
          </div>
        </template>
      </div>
      <div class="ef"><button class="btn danger" @click="deleteUnit">删除</button><span class="spacer"></span><button class="btn primary" @click="saveEdit">保存</button></div>
    </div>
    <div v-else class="m-empty">在左侧选择提示词</div>
  </div>
</template>

<style scoped>
.manage { width: 100%; flex: 1; min-height: 0; display: grid; grid-template-columns: 260px 1fr; background: var(--pf-bg); overflow: hidden; }
.m-sidebar { display: flex; flex-direction: column; border-right: 1px solid var(--pf-border); background: var(--pf-bg-elevated); }
.m-head { padding: 10px; border-bottom: 1px solid var(--pf-border); }
.m-search { width: 100%; height: 32px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); background: var(--pf-surface); padding: 0 10px; font-size: 12.5px; }
.m-search:focus { border-color: var(--pf-accent); outline: none; }
.m-list { flex: 1; overflow-y: auto; padding: 6px; }
.m-item { padding: 8px 10px; border-radius: var(--pf-radius-sm); cursor: pointer; border: 1px solid transparent; transition: all 0.12s; }
.m-item:hover { background: var(--pf-surface-hover); }
.m-item.active { background: var(--pf-accent-soft); border-color: var(--pf-accent); }
.mi-title { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.star { color: var(--pf-warning); font-size: 11px; }
.mi-meta { display: flex; gap: 6px; align-items: center; font-size: 11px; color: var(--pf-text-muted); margin-top: 2px; }
.type-tag { background: var(--pf-accent-soft); color: var(--pf-accent); padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 600; }
.spacer { flex: 1; }
.cnt { color: var(--pf-accent); font-weight: 600; }
.m-foot { padding: 8px; border-top: 1px solid var(--pf-border); }
.m-foot .btn { width: 100%; justify-content: center; }
.m-editor { display: flex; flex-direction: column; background: var(--pf-surface); }
.tabs { height: 36px; display: flex; align-items: center; gap: 4px; padding: 0 16px; border-bottom: 1px solid var(--pf-border); background: var(--pf-bg-elevated); }
.tabs button { border: 0; background: none; color: var(--pf-text-muted); padding: 4px 12px; font-size: 13px; font-weight: 500; height: 36px; }
.tabs button.active { color: var(--pf-accent); font-weight: 600; }
.ti { margin-left: auto; font-size: 11px; color: var(--pf-text-faint); font-family: var(--pf-font-mono); }
.ec { flex: 1; overflow-y: auto; padding: 16px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; font-weight: 600; color: var(--pf-text-secondary); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
.field input, .field textarea { width: 100%; border: 1px solid var(--pf-border); background: var(--pf-surface); border-radius: var(--pf-radius-sm); padding: 10px 14px; font-size: 13.5px; }
.field input:focus, .field textarea:focus { border-color: var(--pf-accent); outline: none; box-shadow: 0 0 0 3px var(--pf-accent-soft); }
.body-editor { min-height: 200px; resize: vertical; font-family: var(--pf-font-mono); line-height: 1.6; }
.vh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.vh h3 { font-size: 14px; margin: 0; }
.vt { border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); }
.vr { display: grid; grid-template-columns: 1fr 1fr 50px 30px; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--pf-border); }
.vr.header { font-size: 11px; font-weight: 600; color: var(--pf-text-muted); background: var(--pf-bg-elevated); }
.vr input { height: 28px; padding: 2px 6px; font-size: 12px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-xs); }
.vr input:focus { border-color: var(--pf-accent); outline: none; }
.db { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--pf-danger); color: var(--pf-danger); background: var(--pf-danger-soft); display: flex; align-items: center; justify-content: center; font-size: 14px; }
.db:hover { background: var(--pf-danger); color: #fff; }
.empty { padding: 24px; text-align: center; color: var(--pf-text-muted); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.sc { border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); padding: 14px; text-align: center; background: var(--pf-bg-elevated); }
.sv { font-size: 20px; font-weight: 700; color: var(--pf-accent); }
.sl { font-size: 11px; color: var(--pf-text-faint); margin-top: 4px; }
.ef { height: 48px; border-top: 1px solid var(--pf-border); padding: 0 16px; display: flex; align-items: center; gap: 8px; background: var(--pf-bg-elevated); }
.m-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--pf-text-faint); font-size: 13px; }
</style>
