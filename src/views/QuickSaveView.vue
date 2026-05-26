<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { extractVariables, fnvHash, inferTitle, inferCategory, generateId, detectDuplicate } from '../utils/index'
import type { PromptUnit } from '../types'
import { showNotification, outPlugin } from '../utils/platform'

const router = useRouter()
const promptStore = usePromptStore()

const content = computed(() => router.quickSaveContent.value || '')
const source = computed(() => {
  const s = router.quickSaveSource.value
  return s === 'selected' ? '选中文本' : s === 'clipboard' ? '剪贴板' : '手动输入'
})
const detectedVars = computed(() => extractVariables(content.value))

const title = ref('')
const category = ref('其它')
const tags = ref<string[]>([])
const tagInput = ref('')
const contentHash = ref('')
const dupPhase = ref<'normal' | 'exact' | 'similar'>('normal')
const dupExact = ref<PromptUnit | null>(null)
const dupSimilar = ref<Array<{ item: PromptUnit; score: number }>>([])
const resultMsg = ref('')

onMounted(async () => {
  await promptStore.ensureReady()
  title.value = inferTitle(content.value)
  category.value = inferCategory(content.value)
  contentHash.value = fnvHash(content.value)
  // 检测重复
  try {
    const result = await detectDuplicate(
      promptStore.rawItems.value.map(u => ({ ...u, body: u.body })),
      content.value,
      ''
    )
    dupPhase.value = result.phase
    if (result.phase === 'exact' && result.exactId) {
      dupExact.value = promptStore.rawItems.value.find(u => u.id === result.exactId) || null
    }
    if (result.phase === 'similar') {
      dupSimilar.value = result.similarItems.map(s => ({
        item: promptStore.rawItems.value.find(u => u.id === s.id)!,
        score: s.score,
      })).filter(s => s.item)
    }
  } catch (e) {
    console.error('Duplicate detection failed:', e)
  }
  window.addEventListener('keydown', handleKey)
})
onUnmounted(() => window.removeEventListener('keydown', handleKey))

function handleKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (!e.shiftKey) saveNew()
    else saveAsNewVersion()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    goBack()
  }
}

function goBack() {
  router.navigateTo('call')
}

function addTag() {
  const t = tagInput.value.trim()
  if (t && !tags.value.includes(t)) tags.value.push(t)
  tagInput.value = ''
}
function removeTag(t: string) { tags.value = tags.value.filter(x => x !== t) }

async function saveNew() {
  if (dupPhase.value === 'exact' || !title.value.trim()) return
  await promptStore.ensureReady()
  const now = new Date().toISOString()
  const unit: PromptUnit = {
    id: generateId(),
    title: title.value.trim(),
    type: 'prompt',
    status: 'active',
    category: category.value,
    tags: tags.value,
    body: content.value,
    variables: detectedVars.value,
    version: 1,
    usageCount: 0,
    favorited: false,
    snapshots: [],
    createdAt: now,
    updatedAt: now,
  }
  promptStore.rawItems.value.push(unit)
  await promptStore.persistAll()
  showNotification('✓ 保存成功')
  setTimeout(() => { router.navigateTo('call') }, 300)
}

async function saveAsNewVersion(target?: PromptUnit) {
  const unit = target || dupExact.value || dupSimilar.value[0]?.item
  if (!unit) return
  await promptStore.ensureReady()
  const now = new Date().toISOString()
  const idx = promptStore.rawItems.value.findIndex(u => u.id === unit.id)
  if (idx === -1) return
  // 快照
  const old = promptStore.rawItems.value[idx]
  old.snapshots = old.snapshots || []
  old.snapshots.push({ version: old.version || 1, body: old.body, note: `QuickSave 保存前的快照`, createdAt: now })
  old.body = content.value
  old.variables = detectedVars.value
  old.version = (old.version || 1) + 1
  old.updatedAt = now
  await promptStore.persistAll()
  showNotification(`✓ 已保存为新版本 V${old.version}`)
  setTimeout(() => { router.navigateTo('call') }, 300)
}

const highlightedContent = computed(() => {
  let html = content.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/(\{\{[a-zA-Z0-9_-]+(?:=[^}]+)?\}\}|\$\{[a-zA-Z0-9_-]+(?:=[^}]+)?\})/g, '<span class="hl-var">$1</span>')
  return html
})
</script>

<template>
  <div class="qsave-view">
    <!-- 顶栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="goBack">←</button>
      <span class="bar-title">快速保存</span>
      <span class="spacer"></span>
    </div>

    <div class="qsave-body">
      <!-- 预览区 -->
      <div class="preview-card">
        <div class="preview-head">
          <span class="src-tag">{{ source }}</span>
          <span>检测到 <b>{{ detectedVars.length }}</b> 个变量 · <b>{{ content.length }}</b> 字符</span>
        </div>
        <div class="preview-body" v-html="highlightedContent"></div>
      </div>

      <!-- 重复提示 -->
      <div v-if="dupPhase === 'exact'" class="dup-banner exact">
        ⚠ 完全相同：「{{ dupExact?.title }}」已存在
        <span class="dup-actions">
          <a @click="saveAsNewVersion()">保存为新版本</a>
        </span>
      </div>
      <div v-if="dupPhase === 'similar'" class="dup-banner similar">
        ⚠ 发现 {{ dupSimilar.length }} 条高相似项（≥80%）
      </div>

      <!-- 表单 -->
      <div class="qsave-form">
        <div class="form-field span-2">
          <label>标题 <span class="req">*</span></label>
          <input v-model="title" :disabled="dupPhase === 'exact'" />
        </div>
        <div class="form-field">
          <label>分类</label>
          <select v-model="category" :disabled="dupPhase === 'exact'">
            <option>其它</option><option>评审</option><option>写作</option>
            <option>翻译</option><option>编码</option><option>问答</option>
          </select>
        </div>
        <div class="form-field">
          <label>标签 <span class="hint-sm">（回车添加）</span></label>
          <div class="tags-input">
            <span v-for="t in tags" :key="t" class="chip">{{ t }} <span class="x" @click="removeTag(t)">×</span></span>
            <input v-model="tagInput" @keydown.enter.prevent="addTag" placeholder="添加标签…" :disabled="dupPhase === 'exact'" />
          </div>
        </div>
        <div class="form-field span-2">
          <label>检测到的变量</label>
          <div class="vars-bar">
            <span v-for="v in detectedVars" :key="v.name" class="var-pill">{{ v.name }}</span>
            <span v-if="detectedVars.length === 0" class="no-vars">无变量</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 -->
    <div class="qsave-footer">
      <template v-if="dupPhase === 'exact'">
        <button class="btn primary" disabled>保存</button>
        <button class="btn primary" @click="saveAsNewVersion()">保存为新版本</button>
      </template>
      <template v-else>
        <button class="btn primary" @click="saveNew">保存</button>
        <button class="btn" @click="saveAsNewVersion()">保存为已有项新版本</button>
      </template>
      <span class="spacer"></span>
      <span class="footer-hint">
        <kbd>Esc</kbd> 取消
        <kbd style="margin-left:6px">Ctrl+S</kbd> 保存
      </span>
    </div>
  </div>
</template>

<style scoped>
.qsave-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg); user-select: none; overflow: hidden;
}
.top-bar {
  height: 48px; flex-shrink: 0;
  display: flex; align-items: center; padding: 0 16px; gap: 10px;
  border-bottom: 1px solid var(--pf-border-soft);
  background: var(--pf-surface);
}
.back-btn {
  width: 28px; height: 28px; border: 0; background: transparent;
  color: var(--pf-text-muted); font-size: 16px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.back-btn:hover { background: var(--pf-bg); }
.bar-title { font-size: 13.5px; font-weight: 600; color: var(--pf-text); }
.spacer { flex: 1; }

.qsave-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 14px 18px; display: flex; flex-direction: column; gap: 12px;
}
.preview-card {
  background: var(--pf-surface); border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm); display: flex; flex-direction: column;
  min-height: 120px; max-height: 240px; overflow-y: auto;
}
.preview-head {
  padding: 8px 12px; border-bottom: 1px solid var(--pf-border-soft);
  background: var(--pf-surface-raised); display: flex; align-items: center;
  gap: 8px; font-size: 11.5px; color: var(--pf-text-muted); flex-shrink: 0;
}
.src-tag {
  background: var(--pf-success-soft); color: var(--pf-success);
  padding: 2px 6px; border-radius: 3px; font-size: 10.5px; font-weight: 600;
}
.preview-body {
  padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; line-height: 1.55; color: var(--pf-text);
  white-space: pre-wrap;
}
.preview-body :deep(.hl-var) {
  background: var(--pf-primary-soft); color: var(--pf-primary);
  padding: 1px 4px; border-radius: 3px; font-weight: 600; font-size: 11.5px;
}

.dup-banner {
  padding: 8px 12px; font-size: 11.5px; border-radius: var(--pf-radius-xs);
  display: flex; align-items: center; gap: 8px;
}
.dup-banner.exact { background: var(--pf-danger-soft); color: #8B2020; border: 1px solid var(--pf-danger); }
.dup-banner.similar { background: var(--pf-warning-soft); color: #7A4520; border: 1px solid var(--pf-warning); }
.dup-actions { margin-left: auto; }
.dup-actions a { color: var(--pf-primary); cursor: pointer; text-decoration: underline; }

.qsave-form {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
}
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field.span-2 { grid-column: 1 / -1; }
.form-field label { font-size: 11px; color: var(--pf-text-muted); font-weight: 500; display: flex; align-items: center; gap: 6px; }
.req { color: var(--pf-danger); }
.hint-sm { font-size: 10px; color: var(--pf-text-faint); font-weight: 400; }
.form-field input, .form-field select {
  height: 30px; padding: 0 10px; border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm); background: var(--pf-surface);
  color: var(--pf-text); font-size: 12px; outline: none;
}
.form-field input:focus, .form-field select:focus { border-color: var(--pf-primary); }
.form-field input:disabled { background: var(--pf-surface-raised); color: var(--pf-text-faint); }
.tags-input {
  display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 6px;
  border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm);
  background: var(--pf-surface); min-height: 30px; align-items: center;
}
.chip {
  background: var(--pf-tag-bg); color: var(--pf-tag-text);
  padding: 1px 6px 1px 8px; border-radius: 10px; font-size: 11px;
  display: inline-flex; align-items: center; gap: 4px; font-weight: 500;
}
.chip .x { cursor: pointer; opacity: 0.5; font-size: 11px; }
.chip .x:hover { opacity: 0.9; }
.tags-input input {
  border: 0 !important; outline: none !important; background: transparent !important;
  flex: 1; min-width: 50px; height: 24px !important; font-size: 12px; padding: 0 !important;
}
.vars-bar {
  display: flex; flex-wrap: wrap; gap: 5px; padding: 6px 8px;
  background: var(--pf-surface-raised); border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm); min-height: 30px; align-items: center;
}
.var-pill {
  background: var(--pf-primary-soft); border: 0; color: var(--pf-primary);
  padding: 2px 8px; border-radius: 10px; font-size: 11px;
  font-weight: 600; font-family: ui-monospace, monospace;
}
.no-vars { color: var(--pf-text-faint); font-size: 11px; font-style: italic; }

.qsave-footer {
  height: 48px; flex-shrink: 0;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-surface-raised);
  display: flex; align-items: center; gap: 8px; padding: 0 18px;
}
.footer-hint { font-size: 11px; color: var(--pf-text-faint); display: flex; align-items: center; gap: 4px; }
</style>
