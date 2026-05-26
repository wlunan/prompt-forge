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
const canvasFragments = ref<PromptUnit[]>([])
const variableOverrides = ref<Record<string, string>>({})

const basePrompts = computed(() =>
  promptStore.rawItems.value.filter(u => {
    if (u.type !== 'prompt') return false
    if (baseSearch.value.trim()) {
      const q = baseSearch.value.toLowerCase()
      return u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q)
    }
    return true
  })
)

const fragments = computed(() =>
  promptStore.rawItems.value.filter(u => {
    if (u.type !== 'fragment') return false
    if (fragSearch.value.trim()) {
      const q = fragSearch.value.toLowerCase()
      return u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q)
    }
    return true
  })
)

const selectedBase = computed(() =>
  promptStore.rawItems.value.find(u => u.id === selectedBaseId.value) || basePrompts.value[0] || null
)

// 选中第一个基础提示词
if (basePrompts.value.length > 0 && !selectedBaseId.value) {
  selectedBaseId.value = basePrompts.value[0].id
}

const composedText = computed(() => {
  let text = selectedBase.value?.body || ''
  if (canvasFragments.value.length > 0) {
    text += '\n\n请遵循以下要求：\n'
    canvasFragments.value.forEach(f => { text += `- ${f.body}\n` })
  }
  return text
})

const composedVars = computed(() => extractVariables(composedText.value))

const renderedText = computed(() => {
  let text = composedText.value
  composedVars.value.forEach(v => {
    const val = variableOverrides.value[v.name] || v.defaultValue || `{{${v.name}}}`
    text = text.replace(new RegExp(`\\{\\{${v.name}(?:=[^}]+)?\\}\\}`, 'g'), val)
    text = text.replace(new RegExp(`\\$\\{${v.name}(?:=[^}]+)?\\}`, 'g'), val)
  })
  return text
})

function addFragment(frag: PromptUnit) {
  if (canvasFragments.value.some(f => f.id === frag.id)) {
    showNotification('该片段已在画布中')
    return
  }
  canvasFragments.value.push(frag)
}

function removeFragment(index: number) {
  canvasFragments.value.splice(index, 1)
}

function moveFragment(index: number, dir: 'up' | 'down') {
  const items = canvasFragments.value
  const target = dir === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= items.length) return
  ;[items[index], items[target]] = [items[target], items[index]]
}

async function copyComposite() {
  try {
    await copyText(renderedText.value)
    showNotification('✓ 合成提示词已复制')
    if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
  } catch (e: any) {
    showNotification(`复制失败: ${e.message}`)
  }
}

async function saveAsNew() {
  const name = prompt('请输入新提示词标题：', `组合提示词 ${new Date().toLocaleDateString()}`)
  if (!name?.trim()) return
  await promptStore.ensureReady()
  const now = new Date().toISOString()
  const unit: PromptUnit = {
    id: generateId(),
    title: name.trim(),
    type: 'prompt',
    status: 'active',
    category: '其它',
    tags: ['Composed'],
    body: composedText.value,
    variables: composedVars.value,
    version: 1,
    usageCount: 0,
    favorited: false,
    snapshots: [],
    createdAt: now,
    updatedAt: now,
  }
  promptStore.rawItems.value.push(unit)
  await promptStore.persistAll()
  showNotification('✓ 已另存为新提示词')
  router.navigateTo('library')
}
</script>

<template>
  <div class="compose-view">
    <!-- 顶栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="router.navigateTo('call')">←</button>
      <span class="bar-title">组合</span>
      <div class="view-switcher">
        <button @click="router.navigateTo('call')">调用</button>
        <button class="active">组合</button>
        <button @click="router.navigateTo('library')">编辑</button>
      </div>
      <div class="spacer"></div>
      <button class="new-btn" @click="router.enterWizard('')">+</button>
      <div class="more-btn" @click="router.navigateTo('settings')">⋮</div>
    </div>

    <div class="compose-body">
      <!-- 左：基础提示词 -->
      <div class="compose-col">
        <div class="col-head">基础提示词</div>
        <div class="col-search">
          <input v-model="baseSearch" placeholder="搜索…" />
        </div>
        <div class="col-list">
          <div v-for="p in basePrompts" :key="p.id" :class="['mini-card', { active: p.id === selectedBaseId }]" @click="selectedBaseId = p.id">
            <div class="card-title">{{ p.title }}</div>
            <div class="card-desc">{{ p.body }}</div>
          </div>
        </div>
      </div>

      <!-- 中：画布 -->
      <div class="canvas-col">
        <div class="canvas-card muted">
          <div class="card-head">基础提示词</div>
          <div class="card-title">{{ selectedBase?.title || '未选择' }}</div>
          <div class="card-body">{{ selectedBase?.body }}</div>
        </div>

        <div v-for="(frag, i) in canvasFragments" :key="frag.id" class="canvas-card">
          <div class="card-head">
            <span>片段 ({{ i + 1 }})</span>
            <span class="moves">
              <button :disabled="i === 0" @click="moveFragment(i, 'up')">▲</button>
              <button :disabled="i === canvasFragments.length - 1" @click="moveFragment(i, 'down')">▼</button>
            </span>
            <span class="x-btn" @click="removeFragment(i)">×</span>
          </div>
          <div class="card-title">{{ frag.title }}</div>
          <div class="card-body">{{ frag.body }}</div>
        </div>

        <div v-if="canvasFragments.length === 0" class="empty-canvas">💡 请在右侧选择片段添加至此</div>

        <!-- 合成预览 -->
        <div class="canvas-card preview">
          <div class="card-head">合成预览</div>
          <div class="card-body mono">{{ renderedText }}</div>
          <div v-if="composedVars.length > 0" class="compose-vars">
            <span v-for="v in composedVars" :key="v.name" class="var-tag">
              {{ v.name }}
              <input v-model="variableOverrides[v.name]" :placeholder="v.defaultValue || '输入值…'" />
            </span>
          </div>
        </div>
      </div>

      <!-- 右：片段列表 -->
      <div class="compose-col">
        <div class="col-head">添加片段</div>
        <div class="col-search">
          <input v-model="fragSearch" placeholder="搜索…" />
        </div>
        <div class="col-list">
          <div v-for="f in fragments" :key="f.id" class="mini-card insertable" @click="addFragment(f)">
            <div class="card-title">{{ f.title }} <span class="add-icon">+</span></div>
            <div class="card-desc">{{ f.body }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 -->
    <div class="compose-footer">
      <span class="footer-ok">✔ 变量名冲突已自动去重</span>
      <span class="spacer"></span>
      <button class="btn" @click="saveAsNew">另存为新提示词</button>
      <button class="btn primary" @click="copyComposite">复制合成提示词</button>
    </div>
  </div>
</template>

<style scoped>
.compose-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg); user-select: none; overflow: hidden;
}
.top-bar {
  height: 50px; flex-shrink: 0;
  display: grid; grid-template-columns: auto auto 1fr auto auto;
  align-items: center; gap: 12px; padding: 0 14px;
  background: var(--pf-surface); border-bottom: 1px solid var(--pf-border);
}
.back-btn, .new-btn, .more-btn { /* 同 LibraryView */ }
.back-btn {
  width: 28px; height: 28px; border: 0; background: transparent;
  color: var(--pf-text-muted); font-size: 16px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.bar-title { font-size: 13px; font-weight: 600; color: var(--pf-text); }
.view-switcher {
  display: flex; background: var(--pf-bg);
  border: 1px solid var(--pf-border); border-radius: 8px;
  padding: 3px; gap: 2px;
}
.view-switcher button {
  border: 0; background: transparent; color: var(--pf-text-muted);
  padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
}
.view-switcher button.active { background: var(--pf-primary); color: #fff; }
.spacer { flex: 1; }
.new-btn {
  width: 30px; height: 30px; border-radius: var(--pf-radius-sm);
  border: 1px solid var(--pf-border); background: var(--pf-surface);
  color: var(--pf-text-muted); font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}
.more-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  color: var(--pf-text-muted); border-radius: 6px; font-size: 16px; font-weight: 700;
}

.compose-body {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: 220px 1fr 220px; gap: 0;
}
.compose-col {
  display: flex; flex-direction: column;
  border-right: 1px solid var(--pf-border);
  background: var(--pf-bg); min-height: 0;
}
.compose-col:last-child { border-right: 0; border-left: 1px solid var(--pf-border); }
.col-head {
  padding: 10px 12px 6px; font-size: 11px; font-weight: 600;
  color: var(--pf-text-muted); text-transform: uppercase; letter-spacing: 0.06em;
}
.col-search { padding: 0 12px 8px; }
.col-search input {
  height: 28px; border-radius: 6px; background: var(--pf-surface);
  border: 1px solid var(--pf-border); padding: 0 10px; font-size: 12px; outline: none;
  width: 100%;
}
.col-search input:focus { border-color: var(--pf-primary); }
.col-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 10px; }

.mini-card {
  padding: 8px 10px; border-radius: var(--pf-radius-sm);
  background: var(--pf-surface); border: 1px solid var(--pf-border);
  cursor: pointer; margin-bottom: 5px;
  transition: border-color 0.12s;
}
.mini-card:hover { border-color: var(--pf-primary); }
.mini-card.active { border-color: var(--pf-primary); background: var(--pf-primary-soft); }
.card-title {
  font-size: 12px; font-weight: 600; color: var(--pf-text);
  margin-bottom: 2px; display: flex; align-items: center; justify-content: space-between;
}
.card-desc {
  font-size: 11px; color: var(--pf-text-muted); line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.add-icon { font-size: 13px; color: var(--pf-text-faint); }
.mini-card:hover .add-icon { color: var(--pf-primary); }

.canvas-col {
  background: var(--pf-bg); overflow-y: auto;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
}
.canvas-card {
  background: var(--pf-surface); border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm); padding: 10px 12px; flex-shrink: 0;
}
.canvas-card.muted { background: var(--pf-surface-raised); border-style: dashed; }
.canvas-card.preview { border-color: var(--pf-primary); }
.card-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; color: var(--pf-text-muted); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;
}
.moves { display: flex; gap: 2px; margin-left: 6px; }
.moves button { border: 0; background: none; font-size: 10px; color: var(--pf-text-muted); }
.moves button:disabled { opacity: 0.3; }
.x-btn { margin-left: auto; color: var(--pf-text-faint); cursor: pointer; font-size: 14px; }
.x-btn:hover { color: var(--pf-danger); }
.canvas-card .card-title { font-size: 12.5px; font-weight: 600; color: var(--pf-text); margin-bottom: 2px; }
.canvas-card .card-body {
  font-size: 12px; color: var(--pf-text-muted); line-height: 1.5;
}
.canvas-card .card-body.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; color: var(--pf-text); }
.empty-canvas {
  border: 1px dashed var(--pf-border); border-radius: var(--pf-radius-sm);
  padding: 24px; text-align: center; color: var(--pf-text-faint); font-size: 12px;
}
.compose-vars {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid var(--pf-border-soft);
}
.var-tag {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--pf-primary-soft); color: var(--pf-primary);
  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
}
.var-tag input {
  width: 80px; border: 0; border-bottom: 1px solid var(--pf-border);
  outline: 0; background: transparent; font-size: 11px;
}
.var-tag input:focus { border-bottom-color: var(--pf-primary); }

.compose-footer {
  height: 48px; flex-shrink: 0;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
  display: flex; align-items: center; gap: 10px; padding: 0 14px;
}
.footer-ok { font-size: 11.5px; color: var(--pf-success); font-weight: 600; }
</style>
