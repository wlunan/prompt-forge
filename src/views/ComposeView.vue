<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useAppSettings } from '../stores/app'
import { extractVariables, renderVariables, generateId } from '../utils/index'
import { copyText, showNotification, hideMainWindow } from '../utils/platform'
import type { PromptUnit } from '../types'

const router = useRouter()
const promptStore = usePromptStore()
const appSettings = useAppSettings()
const baseSearch = ref('')
const fragSearch = ref('')
const selectedBaseId = ref('')
const canvasFrags = ref<PromptUnit[]>([])
const varOverrides = ref<Record<string, string>>({})

const basePrompts = computed(() => promptStore.rawItems.value.filter(u => u.type === 'prompt' && (!baseSearch.value.trim() || u.title.toLowerCase().includes(baseSearch.value.toLowerCase()) || u.body.toLowerCase().includes(baseSearch.value.toLowerCase()))))
const fragments = computed(() => promptStore.rawItems.value.filter(u => u.type === 'fragment' && (!fragSearch.value.trim() || u.title.toLowerCase().includes(fragSearch.value.toLowerCase()) || u.body.toLowerCase().includes(fragSearch.value.toLowerCase()))))
const selectedBase = computed(() => promptStore.rawItems.value.find(u => u.id === selectedBaseId.value) || basePrompts.value[0] || null)
if (basePrompts.value.length && !selectedBaseId.value) selectedBaseId.value = basePrompts.value[0].id

const composedText = computed(() => { let t = selectedBase.value?.body || ''; if (canvasFrags.value.length) { t += '\n\n请遵循以下要求：\n'; canvasFrags.value.forEach(f => { t += `- ${f.body}\n` }) }; return t })
const composedVars = computed(() => extractVariables(composedText.value))
const renderedText = computed(() => { let t = composedText.value; composedVars.value.forEach(v => { const val = varOverrides.value[v.name] || v.defaultValue || `{{${v.name}}}`; t = t.replace(new RegExp(`\\{\\{${v.name}(?:=[^}]+)?\\}\\}`, 'g'), val) }); return t })

function addFrag(f: PromptUnit) { if (canvasFrags.value.some(x => x.id === f.id)) { showNotification('已在画布中'); return }; canvasFrags.value.push(f) }
function removeFrag(i: number) { canvasFrags.value.splice(i, 1) }
function moveFrag(i: number, dir: 'up' | 'down') { const t = dir === 'up' ? i - 1 : i + 1; if (t < 0 || t >= canvasFrags.value.length) return; [canvasFrags.value[i], canvasFrags.value[t]] = [canvasFrags.value[t], canvasFrags.value[i]] }

async function copyComposite() { try { await copyText(renderedText.value); showNotification('✓ 已复制'); if (appSettings.settings.value.closeAfterCopy) hideMainWindow() } catch (e: any) { showNotification(`失败: ${e.message}`) } }

async function saveAsNew() {
  const name = prompt('请输入标题：', `组合 ${new Date().toLocaleDateString()}`)
  if (!name?.trim()) return
  await promptStore.ensureReady()
  const now = new Date().toISOString()
  promptStore.rawItems.value.push({ id: generateId(), title: name.trim(), type: 'prompt', status: 'active', category: '其它', tags: ['Composed'], body: composedText.value, variables: composedVars.value, version: 1, usageCount: 0, favorited: false, snapshots: [], createdAt: now, updatedAt: now })
  await promptStore.persistAll()
  showNotification('✓ 已另存')
  router.navigateTo('library')
}
</script>

<template>
  <div class="compose-view">
    <div class="compose-body">
      <div class="compose-col">
        <div class="col-head">基础提示词</div>
        <div class="col-search"><input v-model="baseSearch" placeholder="搜索…" /></div>
        <div class="col-list"><div v-for="p in basePrompts" :key="p.id" :class="['mini-card', { active: p.id === selectedBaseId }]" @click="selectedBaseId = p.id"><div class="card-title">{{ p.title }}</div><div class="card-desc">{{ p.body }}</div></div></div>
      </div>
      <div class="canvas-col">
        <div class="canvas-card muted"><div class="card-head">基础提示词</div><div class="card-title">{{ selectedBase?.title || '未选择' }}</div><div class="card-body">{{ selectedBase?.body }}</div></div>
        <div v-for="(f, i) in canvasFrags" :key="f.id" class="canvas-card"><div class="card-head"><span>片段 {{ i + 1 }}</span><span class="moves"><button :disabled="i === 0" @click="moveFrag(i, 'up')">▲</button><button :disabled="i === canvasFrags.length - 1" @click="moveFrag(i, 'down')">▼</button></span><span class="x-btn" @click="removeFrag(i)">×</span></div><div class="card-title">{{ f.title }}</div><div class="card-body">{{ f.body }}</div></div>
        <div v-if="!canvasFrags.length" class="empty-canvas">在右侧选择片段添加至此</div>
        <div class="canvas-card preview"><div class="card-head">合成预览</div><div class="card-body mono">{{ renderedText }}</div><div v-if="composedVars.length" class="compose-vars"><span v-for="v in composedVars" :key="v.name" class="var-tag">{{ v.name }} <input v-model="varOverrides[v.name]" :placeholder="v.defaultValue || '输入…'" /></span></div></div>
      </div>
      <div class="compose-col">
        <div class="col-head">添加片段</div>
        <div class="col-search"><input v-model="fragSearch" placeholder="搜索…" /></div>
        <div class="col-list"><div v-for="f in fragments" :key="f.id" class="mini-card" @click="addFrag(f)"><div class="card-title">{{ f.title }} <span class="add-icon">+</span></div><div class="card-desc">{{ f.body }}</div></div></div>
      </div>
    </div>
    <div class="compose-footer">
      <span class="footer-ok">✔ 变量已自动去重</span>
      <span class="spacer"></span>
      <button class="btn" @click="saveAsNew">另存</button>
      <button class="btn primary" @click="copyComposite">复制合成提示词</button>
    </div>
  </div>
</template>

<style scoped>
.compose-view { width: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--pf-bg); overflow: hidden; }
.compose-body { flex: 1; display: grid; grid-template-columns: 220px 1fr 220px; }
.compose-col { display: flex; flex-direction: column; border-right: 1px solid var(--pf-border); background: var(--pf-bg-elevated); }
.compose-col:last-child { border-right: 0; border-left: 1px solid var(--pf-border); }
.col-head { padding: 12px 14px 6px; font-size: 11px; font-weight: 600; color: var(--pf-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.col-search { padding: 0 12px 8px; }
.col-search input { height: 30px; border-radius: var(--pf-radius-sm); background: var(--pf-surface); border: 1px solid var(--pf-border); padding: 0 10px; font-size: 12px; width: 100%; }
.col-search input:focus { border-color: var(--pf-accent); outline: none; }
.col-list { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
.mini-card { padding: 10px 12px; border-radius: var(--pf-radius-sm); background: var(--pf-surface); border: 1px solid var(--pf-border); cursor: pointer; margin-bottom: 5px; transition: all 0.12s; }
.mini-card:hover { border-color: var(--pf-accent); }
.mini-card.active { border-color: var(--pf-accent); background: var(--pf-accent-soft); }
.card-title { font-size: 12.5px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.card-desc { font-size: 11px; color: var(--pf-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
.add-icon { color: var(--pf-text-faint); }
.mini-card:hover .add-icon { color: var(--pf-accent); }
.canvas-col { background: var(--pf-bg); overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.canvas-card { background: var(--pf-surface); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); padding: 12px; }
.canvas-card.muted { background: var(--pf-surface-raised); border-style: dashed; }
.canvas-card.preview { border-color: var(--pf-accent); }
.card-head { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--pf-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.moves { display: flex; gap: 2px; margin-left: 6px; }
.moves button { border: 0; background: none; font-size: 10px; color: var(--pf-text-muted); }
.moves button:disabled { opacity: 0.3; }
.x-btn { margin-left: auto; color: var(--pf-text-faint); cursor: pointer; font-size: 14px; }
.x-btn:hover { color: var(--pf-danger); }
.canvas-card .card-body { font-size: 12px; color: var(--pf-text-muted); line-height: 1.5; }
.canvas-card .card-body.mono { font-family: var(--pf-font-mono); white-space: pre-wrap; color: var(--pf-text); }
.empty-canvas { border: 1px dashed var(--pf-border); border-radius: var(--pf-radius-sm); padding: 24px; text-align: center; color: var(--pf-text-faint); font-size: 12px; }
.compose-vars { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--pf-border); }
.var-tag { display: inline-flex; align-items: center; gap: 4px; background: var(--pf-accent-soft); color: var(--pf-accent); padding: 2px 8px; border-radius: var(--pf-radius-xs); font-size: 11px; font-weight: 500; }
.var-tag input { width: 80px; border: 0; border-bottom: 1px solid var(--pf-border); background: transparent; font-size: 11px; }
.var-tag input:focus { border-bottom-color: var(--pf-accent); outline: none; }
.compose-footer { height: 50px; flex-shrink: 0; border-top: 1px solid var(--pf-border); background: var(--pf-bg-elevated); display: flex; align-items: center; gap: 10px; padding: 0 16px; }
.footer-ok { font-size: 12px; color: var(--pf-success); font-weight: 600; }
.spacer { flex: 1; }
</style>
