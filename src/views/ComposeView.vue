<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useAppSettings } from '../stores/app'
import { extractVariables, renderVariables, generateId } from '../utils/index'
import { copyText, showNotification, hideMainWindow } from '../utils/platform'
import type { PromptItem } from '../types'

const router = useRouter()
const promptStore = usePromptStore()
const appSettings = useAppSettings()
const selectedBaseId = ref('')
const canvasFrags = ref<PromptItem[]>([])
const varOverrides = ref<Record<string, string>>({})

const basePrompts = computed(() => promptStore.liveItems.value.filter(i => i.type === 'prompt'))
const snippets = computed(() => promptStore.liveItems.value.filter(i => i.type === 'snippet'))
const selectedBase = computed(() => promptStore.liveItems.value.find(i => i.id === selectedBaseId.value) || basePrompts.value[0] || null)
onMounted(async () => {
  await promptStore.ensureReady()
  if (basePrompts.value.length && !selectedBaseId.value) selectedBaseId.value = basePrompts.value[0].id
})

const composedText = computed(() => {
  let t = selectedBase.value?.content || ''
  if (canvasFrags.value.length) {
    t += '\n\n请遵循以下要求：\n'
    canvasFrags.value.forEach(f => { t += `- ${f.content}\n` })
  }
  return t
})
const composedVars = computed(() => extractVariables(composedText.value))
const renderedText = computed(() => {
  let t = composedText.value
  composedVars.value.forEach(v => {
    const val = varOverrides.value[v.name] || v.defaultValue || `{{${v.name}}}`
    t = t.replace(new RegExp(`\\{\\{${v.name}(?:=[^}]+)?\\}\\}`, 'g'), val)
  })
  return t
})

function addFrag(f: PromptItem) {
  if (canvasFrags.value.some(x => x.id === f.id)) { showNotification('已在画布中'); return }
  canvasFrags.value.push(f)
}
function removeFrag(i: number) { canvasFrags.value.splice(i, 1) }
function moveFrag(i: number, dir: 'up' | 'down') {
  const t = dir === 'up' ? i - 1 : i + 1
  if (t < 0 || t >= canvasFrags.value.length) return
  ;[canvasFrags.value[i], canvasFrags.value[t]] = [canvasFrags.value[t], canvasFrags.value[i]]
}

async function copyComposite() {
  try {
    await copyText(renderedText.value)
    showNotification('✓ 已复制')
    if (appSettings.settings.value.closeAfterCopy) hideMainWindow()
  } catch (e: any) { showNotification(`失败: ${e.message}`) }
}

async function saveAsNew() {
  const name = prompt('请输入标题：', `组合 ${new Date().toLocaleDateString()}`)
  if (!name?.trim()) return
  const now = Date.now()
  promptStore.addItem({
    id: generateId(), title: name.trim(), content: composedText.value,
    type: 'prompt', tags: ['Composed'], variables: composedVars.value,
    favorite: false, usageCount: 0, version: 1, snapshots: [],
    createdAt: now, updatedAt: now,
  })
  showNotification('✓ 已另存')
  router.navigateTo('manage')
}
</script>

<template>
  <div class="compose">
    <div class="compose-body">
      <!-- 左：基础 -->
      <div class="col"><div class="ch">基础提示词</div><div class="cl" v-for="p in basePrompts" :key="p.id" :class="{ active: p.id === selectedBaseId }" @click="selectedBaseId = p.id"><div class="ct">{{ p.title }}</div><div class="cd">{{ p.content }}</div></div></div>
      <!-- 中：画布 -->
      <div class="canvas">
        <div class="cc muted"><div class="cc-h">基础</div><div class="ct">{{ selectedBase?.title || '未选择' }}</div><div class="cc-b">{{ selectedBase?.content }}</div></div>
        <div v-for="(f, i) in canvasFrags" :key="f.id" class="cc">
          <div class="cc-h"><span>片段 {{ i+1 }}</span><span class="moves"><button :disabled="i===0" @click="moveFrag(i,'up')">▲</button><button :disabled="i===canvasFrags.length-1" @click="moveFrag(i,'down')">▼</button></span><span class="x" @click="removeFrag(i)">×</span></div>
          <div class="ct">{{ f.title }}</div><div class="cc-b">{{ f.content }}</div>
        </div>
        <div v-if="!canvasFrags.length" class="empty-c">在右侧选择片段添加至此</div>
        <div class="cc preview"><div class="cc-h">合成预览</div><div class="cc-b mono">{{ renderedText }}</div>
          <div v-if="composedVars.length" class="vars"><span v-for="v in composedVars" :key="v.name" class="vt">{{ v.name }} <input v-model="varOverrides[v.name]" :placeholder="v.defaultValue||'输入…'" /></span></div>
        </div>
      </div>
      <!-- 右：片段 -->
      <div class="col"><div class="ch">添加片段</div><div class="cl" v-for="f in snippets" :key="f.id" @click="addFrag(f)"><div class="ct">{{ f.title }} <span class="add">+</span></div><div class="cd">{{ f.content }}</div></div></div>
    </div>
    <div class="compose-foot"><span class="ok">✔ 变量已自动去重</span><span class="spacer"></span><button class="btn" @click="saveAsNew">另存</button><button class="btn primary" @click="copyComposite">复制合成提示词</button></div>
  </div>
</template>

<style scoped>
.compose { width: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--pf-bg); overflow: hidden; }
.compose-body { flex: 1; display: grid; grid-template-columns: 200px 1fr 200px; min-height: 0; overflow: hidden; }
.col { display: flex; flex-direction: column; border-right: 1px solid var(--pf-border); background: var(--pf-bg-elevated); }
.col:last-child { border-right: 0; border-left: 1px solid var(--pf-border); }
.ch { padding: 10px 12px 6px; font-size: 11px; font-weight: 600; color: var(--pf-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.cl { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
.mini-card, .cl > div { padding: 8px 10px; border-radius: var(--pf-radius-sm); background: var(--pf-surface); border: 1px solid var(--pf-border); cursor: pointer; margin-bottom: 4px; transition: all 0.12s; }
.cl > div:hover, .cl > div.active { border-color: var(--pf-accent); background: var(--pf-accent-soft); }
.ct { font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.cd { font-size: 11px; color: var(--pf-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
.add { color: var(--pf-text-faint); }
.cl > div:hover .add { color: var(--pf-accent); }
.canvas { background: var(--pf-bg); overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.cc { background: var(--pf-surface); border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); padding: 10px; }
.cc.muted { background: var(--pf-surface-raised); border-style: dashed; }
.cc.preview { border-color: var(--pf-accent); }
.cc-h { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--pf-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.cc-b { font-size: 11.5px; color: var(--pf-text-muted); line-height: 1.5; }
.cc-b.mono { font-family: var(--pf-font-mono); white-space: pre-wrap; color: var(--pf-text); }
.moves { display: flex; gap: 2px; margin-left: 4px; }
.moves button { border: 0; background: none; font-size: 10px; color: var(--pf-text-muted); }
.moves button:disabled { opacity: 0.3; }
.x { margin-left: auto; color: var(--pf-text-faint); cursor: pointer; }
.x:hover { color: var(--pf-danger); }
.empty-c { border: 1px dashed var(--pf-border); border-radius: var(--pf-radius-sm); padding: 20px; text-align: center; color: var(--pf-text-faint); font-size: 12px; }
.vars { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--pf-border); }
.vt { display: inline-flex; align-items: center; gap: 4px; background: var(--pf-accent-soft); color: var(--pf-accent); padding: 2px 6px; border-radius: var(--pf-radius-xs); font-size: 11px; font-weight: 500; }
.vt input { width: 70px; border: 0; border-bottom: 1px solid var(--pf-border); background: transparent; font-size: 11px; }
.vt input:focus { border-bottom-color: var(--pf-accent); outline: none; }
.compose-foot { height: 48px; flex-shrink: 0; border-top: 1px solid var(--pf-border); background: var(--pf-bg-elevated); display: flex; align-items: center; gap: 8px; padding: 0 14px; }
.ok { font-size: 12px; color: var(--pf-success); font-weight: 600; }
.spacer { flex: 1; }
</style>
