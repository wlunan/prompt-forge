<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { extractVariables, fnvHash, inferTitle, inferCategory, generateId, detectDuplicate } from '../utils/index'
import type { PromptUnit } from '../types'
import { showNotification } from '../utils/platform'

const router = useRouter()
const promptStore = usePromptStore()
const content = computed(() => router.quickSaveContent.value || '')
const source = computed(() => router.quickSaveSource.value === 'selected' ? '选中文本' : '剪贴板')
const detectedVars = computed(() => extractVariables(content.value))
const title = ref('')
const category = ref('其它')
const tags = ref<string[]>([])
const tagInput = ref('')
const dupPhase = ref<'normal' | 'exact' | 'similar'>('normal')
const dupExact = ref<PromptUnit | null>(null)

onMounted(async () => {
  await promptStore.ensureReady()
  title.value = inferTitle(content.value)
  category.value = inferCategory(content.value)
  try {
    const r = await detectDuplicate(promptStore.rawItems.value.map(u => ({ ...u, body: u.body })), content.value, '')
    dupPhase.value = r.phase
    if (r.phase === 'exact' && r.exactId) dupExact.value = promptStore.rawItems.value.find(u => u.id === r.exactId) || null
  } catch {}
  window.addEventListener('keydown', handleKey)
})
onUnmounted(() => window.removeEventListener('keydown', handleKey))
function handleKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNew() }
  if (e.key === 'Escape') { e.preventDefault(); router.navigateTo('call') }
}
function goBack() { router.navigateTo('call') }
function addTag() { const t = tagInput.value.trim(); if (t && !tags.value.includes(t)) tags.value.push(t); tagInput.value = '' }
function removeTag(t: string) { tags.value = tags.value.filter(x => x !== t) }

async function saveNew() {
  if (dupPhase.value === 'exact' || !title.value.trim()) return
  await promptStore.ensureReady()
  const now = new Date().toISOString()
  const unit: PromptUnit = { id: generateId(), title: title.value.trim(), type: 'prompt', status: 'active', category: category.value, tags: tags.value, body: content.value, variables: detectedVars.value, version: 1, usageCount: 0, favorited: false, snapshots: [], createdAt: now, updatedAt: now }
  promptStore.rawItems.value.push(unit)
  await promptStore.persistAll()
  showNotification('✓ 已保存')
  setTimeout(() => router.navigateTo('call'), 300)
}

const highlighted = computed(() => {
  let html = content.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return html.replace(/(\{\{[a-zA-Z0-9_-]+(?:=[^}]+)?\}\})/g, '<span class="hl-var">$1</span>')
})
</script>

<template>
  <div class="qsave-view">
    <div class="qsave-body">
      <div class="preview-card">
        <div class="preview-head"><span class="src-tag">{{ source }}</span><span>{{ detectedVars.length }} 变量 · {{ content.length }} 字符</span></div>
        <div class="preview-body" v-html="highlighted"></div>
      </div>
      <div v-if="dupPhase === 'exact'" class="dup-banner exact">⚠ 完全相同：「{{ dupExact?.title }}」已存在</div>
      <div class="qsave-form">
        <div class="form-field span-2"><label>标题 *</label><input v-model="title" :disabled="dupPhase === 'exact'" /></div>
        <div class="form-field"><label>分类</label><select v-model="category"><option>其它</option><option>评审</option><option>写作</option><option>翻译</option><option>编码</option></select></div>
        <div class="form-field"><label>标签</label><div class="tags-input"><span v-for="t in tags" :key="t" class="chip">{{ t }} <span class="x" @click="removeTag(t)">×</span></span><input v-model="tagInput" @keydown.enter.prevent="addTag" placeholder="添加…" /></div></div>
        <div class="form-field span-2"><label>变量</label><div class="vars-bar"><span v-for="v in detectedVars" :key="v.name" class="var-pill">{{ v.name }}</span><span v-if="!detectedVars.length" class="no-vars">无</span></div></div>
      </div>
    </div>
    <div class="qsave-footer">
      <button class="btn primary" @click="saveNew">保存</button>
      <span class="spacer"></span>
      <span class="hint-text"><kbd>Esc</kbd> 取消 <kbd>Ctrl+S</kbd> 保存</span>
    </div>
  </div>
</template>

<style scoped>
.qsave-view { width: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--pf-bg); overflow: hidden; }
.qsave-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.preview-card { background: var(--pf-surface); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-md); min-height: 120px; max-height: 240px; overflow-y: auto; }
.preview-head { padding: 8px 14px; border-bottom: 1px solid var(--pf-border); background: var(--pf-bg-elevated); display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--pf-text-muted); }
.src-tag { background: var(--pf-success-soft); color: var(--pf-success); padding: 2px 8px; border-radius: var(--pf-radius-xs); font-size: 11px; font-weight: 600; }
.preview-body { padding: 12px 14px; font-family: var(--pf-font-mono); font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; color: var(--pf-text-secondary); }
.preview-body :deep(.hl-var) { background: var(--pf-accent-soft); color: var(--pf-accent); padding: 1px 5px; border-radius: 3px; font-weight: 600; }
.dup-banner { padding: 10px 14px; border-radius: var(--pf-radius-sm); font-size: 12.5px; }
.dup-banner.exact { background: var(--pf-danger-soft); color: var(--pf-danger); border: 1px solid var(--pf-danger); }
.qsave-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field.span-2 { grid-column: 1 / -1; }
.form-field label { font-size: 12px; font-weight: 600; color: var(--pf-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
.form-field input, .form-field select { height: 34px; padding: 0 12px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); background: var(--pf-surface); font-size: 13px; }
.form-field input:focus, .form-field select:focus { border-color: var(--pf-accent); outline: none; }
.tags-input { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 8px; border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); background: var(--pf-surface); min-height: 34px; align-items: center; }
.chip { background: var(--pf-surface-raised); padding: 2px 8px; border-radius: var(--pf-radius-pill); font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; }
.chip .x { cursor: pointer; opacity: 0.5; }
.chip .x:hover { opacity: 1; color: var(--pf-danger); }
.tags-input input { flex: 1; min-width: 50px; height: 24px !important; padding: 0 !important; border: 0 !important; }
.vars-bar { display: flex; flex-wrap: wrap; gap: 5px; padding: 6px 10px; background: var(--pf-surface); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); min-height: 34px; align-items: center; }
.var-pill { background: var(--pf-accent-soft); color: var(--pf-accent); padding: 2px 10px; border-radius: var(--pf-radius-pill); font-size: 11.5px; font-weight: 600; font-family: var(--pf-font-mono); }
.no-vars { color: var(--pf-text-faint); font-size: 12px; }
.qsave-footer { height: 50px; flex-shrink: 0; border-top: 1px solid var(--pf-border); background: var(--pf-bg-elevated); display: flex; align-items: center; gap: 10px; padding: 0 20px; }
.spacer { flex: 1; }
.hint-text { font-size: 11px; color: var(--pf-text-faint); display: flex; gap: 6px; align-items: center; }
</style>
