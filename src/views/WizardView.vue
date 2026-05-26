<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { extractVariables, generateId, inferTitle, inferCategory } from '../utils/index'
import type { PromptUnit, Variable } from '../types'

const router = useRouter()
const promptStore = usePromptStore()

const step = ref(1)
const body = ref('')
const title = ref('')
const category = ref('其它')
const tagsRaw = ref('')
const variableConfigs = ref<Record<string, { required: boolean; defaultValue: string }>>({})
const error = ref('')
const saving = ref(false)

const detectedVars = computed(() => extractVariables(body.value))
const autoTitle = computed(() => {
  if (title.value.trim()) return title.value.trim()
  return inferTitle(body.value)
})
const tags = computed(() => tagsRaw.value.split(',').map(s => s.trim()).filter(Boolean))

onMounted(() => {
  const prefill = router.consumeWizardPrefill()
  if (prefill) body.value = prefill
  window.addEventListener('keydown', handleKey)
})
onUnmounted(() => window.removeEventListener('keydown', handleKey))

function handleKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && body.value.trim()) {
    e.preventDefault()
    savePrompt('active')
  }
}

function nextStep() {
  if (step.value === 1 && !body.value.trim()) {
    error.value = '提示词正文不能为空'
    return
  }
  error.value = ''
  if (step.value < 3) step.value++
}

function prevStep() {
  if (step.value > 1) step.value--
}

async function savePrompt(status: 'active' | 'draft') {
  if (saving.value) return
  if (!body.value.trim()) { error.value = '请先输入提示词正文'; return }
  saving.value = true
  try {
    await promptStore.ensureReady()
    const vars: Variable[] = detectedVars.value.map(v => {
      const cfg = variableConfigs.value[v.name]
      return {
        name: v.name,
        required: cfg ? cfg.required : v.required,
        defaultValue: cfg ? cfg.defaultValue : v.defaultValue,
      }
    })
    const now = new Date().toISOString()
    const unit: PromptUnit = {
      id: generateId(),
      title: autoTitle.value || '未命名提示词',
      type: 'prompt',
      status,
      category: category.value,
      tags: tags.value,
      body: body.value.trim(),
      variables: vars,
      version: 1,
      usageCount: 0,
      favorited: false,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    }
    promptStore.rawItems.value.push(unit)
    await promptStore.persistAll()
    router.navigateTo('call')
  } catch (e: any) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.navigateTo('call')
}
</script>

<template>
  <div class="wizard-view">
    <div class="top-bar">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="bar-title">新建提示词</span>
      <span class="spacer"></span>
    </div>

    <div class="stepper">
      <div :class="['step', { active: step === 1, done: step > 1 }]">
        <span class="step-num">{{ step > 1 ? '✓' : '1' }}</span>
        编写正文
      </div>
      <div :class="['divider', { done: step > 1 }]"></div>
      <div :class="['step', { active: step === 2, done: step > 2 }]">
        <span class="step-num">{{ step > 2 ? '✓' : '2' }}</span>
        基本信息
      </div>
      <div :class="['divider', { done: step > 2 }]"></div>
      <div :class="['step', { active: step === 3 }]">
        <span class="step-num">3</span>
        变量配置
      </div>
    </div>

    <div class="wizard-content">
      <div v-if="step === 1" class="step-pane">
        <h2>编写提示词正文</h2>
        <p class="hint-sub">用 <code v-text="`{{name}}`"></code> 标记变量。按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 极速保存。</p>
        <div class="field">
          <label>正文 <span class="req">*</span></label>
          <textarea v-model="body" class="body-input" placeholder="你是一位 {{role}} 专家。请基于以下代码开展评审…" />
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="detectedVars.length > 0" class="detected-bar">
          <span class="detected-label">识别到 {{ detectedVars.length }} 个变量</span>
          <span v-for="v in detectedVars" :key="v.name" class="var-badge">{{ v.name }}</span>
        </div>
      </div>

      <div v-if="step === 2" class="step-pane">
        <h2>设置基本信息</h2>
        <p class="hint-sub">标题和标签不填则自动生成。</p>
        <div class="field">
          <label>标题 <span class="hint">默认：{{ autoTitle }}</span></label>
          <input v-model="title" type="text" placeholder="如：PRD 评审建议生成器" />
        </div>
        <div class="field">
          <label>分类</label>
          <select v-model="category">
            <option>其它</option><option>评审</option><option>写作</option>
            <option>翻译</option><option>编码</option><option>问答</option>
          </select>
        </div>
        <div class="field">
          <label>标签 <span class="hint">逗号分隔</span></label>
          <input v-model="tagsRaw" type="text" placeholder="PRD, 评审, 产品经理" />
        </div>
      </div>

      <div v-if="step === 3" class="step-pane">
        <h2>变量配置</h2>
        <p class="hint-sub">配置每个变量的必填性和默认值。</p>
        <div v-if="detectedVars.length > 0" class="var-table">
          <div class="var-row header">
            <div>变量名</div><div>默认值</div><div style="text-align:center">必填</div>
          </div>
          <div v-for="v in detectedVars" :key="v.name" class="var-row">
            <div class="var-name">{{ v.name }}</div>
            <div><input :value="variableConfigs[v.name]?.defaultValue ?? v.defaultValue ?? ''" @input="variableConfigs[v.name] = { required: variableConfigs[v.name]?.required ?? v.required, defaultValue: ($event.target as HTMLInputElement).value }" placeholder="默认值…" /></div>
            <div style="text-align:center"><input type="checkbox" :checked="variableConfigs[v.name]?.required ?? v.required" @change="variableConfigs[v.name] = { required: ($event.target as HTMLInputElement).checked, defaultValue: variableConfigs[v.name]?.defaultValue ?? v.defaultValue ?? '' }" /></div>
          </div>
        </div>
        <div v-else class="no-vars-hint">本提示词没有变量，保存后可一键复制。</div>
      </div>
    </div>

    <div class="wizard-footer">
      <button v-if="step > 1" class="btn" @click="prevStep">← 上一步</button>
      <button v-else class="btn" @click="goBack">取消</button>
      <span class="spacer"></span>
      <template v-if="step === 1">
        <button class="btn" :disabled="saving" @click="savePrompt('active')">{{ saving ? '保存中…' : '⚡ 极速保存' }}</button>
        <button class="btn accent" @click="nextStep">下一步 →</button>
      </template>
      <template v-else-if="step === 2">
        <button class="btn" :disabled="saving" @click="savePrompt('active')">{{ saving ? '保存中…' : '直接保存' }}</button>
        <button class="btn accent" @click="nextStep">变量配置 →</button>
      </template>
      <template v-else>
        <button class="btn" :disabled="saving" @click="savePrompt('draft')">{{ saving ? '保存中…' : '保存为草稿' }}</button>
        <button class="btn accent" :disabled="saving" @click="savePrompt('active')">{{ saving ? '保存中…' : '发布 V1' }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wizard-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg); user-select: none;
}
.top-bar {
  height: 52px; flex-shrink: 0;
  display: flex; align-items: center;
  padding: 0 18px; gap: 12px;
  background: var(--pf-bg-elevated);
  border-bottom: 1px solid var(--pf-border);
}
.back-btn {
  width: 32px; height: 32px;
  border-radius: var(--pf-radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--pf-text-muted);
  transition: all 0.2s;
}
.back-btn:hover { background: var(--pf-surface); color: var(--pf-text); }
.bar-title { font-size: 14px; font-weight: 600; color: var(--pf-text); letter-spacing: 0.01em; }
.spacer { flex: 1; }

.stepper {
  height: 56px; flex-shrink: 0;
  display: flex; align-items: center;
  justify-content: center; gap: 20px;
  background: var(--pf-bg-elevated);
  border-bottom: 1px solid var(--pf-border);
}
.step {
  font-size: 12.5px; color: var(--pf-text-faint);
  display: flex; align-items: center; gap: 8px; font-weight: 500;
  transition: color 0.2s;
}
.step.active { color: var(--pf-accent); font-weight: 700; }
.step.done { color: var(--pf-success); font-weight: 600; }
.step-num {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--pf-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  transition: all 0.3s;
}
.step.active .step-num {
  border-color: var(--pf-accent);
  background: var(--pf-accent-soft);
  color: var(--pf-accent);
  box-shadow: 0 0 12px var(--pf-accent-glow);
}
.step.done .step-num {
  border-color: var(--pf-success);
  background: var(--pf-success-soft);
  color: var(--pf-success);
}
.divider { width: 40px; height: 2px; background: var(--pf-border); border-radius: 1px; }
.divider.done { background: var(--pf-success); }

.wizard-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 28px 36px;
}
.step-pane h2 {
  font-size: 20px; font-weight: 700; color: var(--pf-text);
  margin: 0 0 6px; letter-spacing: -0.01em;
}
.hint-sub { font-size: 13px; color: var(--pf-text-muted); margin: 0 0 24px; line-height: 1.5; }
.hint-sub code {
  background: var(--pf-accent-soft); color: var(--pf-accent);
  padding: 2px 8px; border-radius: 4px;
  font-family: var(--pf-font-mono); font-size: 12px; font-weight: 600;
}
.field { margin-bottom: 20px; }
.field label {
  display: block; font-size: 12px; color: var(--pf-text-muted);
  font-weight: 600; margin-bottom: 8px;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.field .req { color: var(--pf-accent); }
.field .hint { font-size: 11px; color: var(--pf-text-faint); font-weight: 400; text-transform: none; letter-spacing: 0; }
.field input, .field select, .field textarea {
  width: 100%; border: 1px solid var(--pf-border);
  background: var(--pf-bg-elevated); color: var(--pf-text);
  border-radius: var(--pf-radius-sm); padding: 10px 14px;
  font-size: 13.5px; outline: 0;
  transition: all 0.2s ease;
}
.field input:focus, .field select:focus, .field textarea:focus {
  border-color: var(--pf-accent);
  box-shadow: 0 0 0 3px var(--pf-accent-soft);
}
.body-input {
  min-height: 220px; resize: vertical;
  font-family: var(--pf-font-mono); line-height: 1.6;
}
.error-msg {
  padding: 10px 14px; border: 1px solid var(--pf-danger);
  background: var(--pf-danger-soft); color: var(--pf-danger);
  border-radius: var(--pf-radius-sm); font-size: 12.5px; margin-bottom: 14px;
  font-weight: 500;
}
.detected-bar {
  margin-top: 14px; padding: 12px 16px;
  background: var(--pf-accent-soft);
  border: 1px solid rgba(255, 107, 107, 0.15);
  border-radius: var(--pf-radius-md);
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.detected-label { font-size: 12.5px; font-weight: 700; color: var(--pf-accent); }
.var-badge {
  background: var(--pf-surface); color: var(--pf-accent);
  border: 1px solid rgba(255, 107, 107, 0.2);
  border-radius: var(--pf-radius-pill);
  padding: 3px 12px; font-family: var(--pf-font-mono);
  font-size: 11.5px; font-weight: 700;
}
.var-table {
  border: 1px solid var(--pf-border); border-radius: var(--pf-radius-md);
  background: var(--pf-surface); overflow: hidden;
}
.var-row {
  display: grid; grid-template-columns: 1fr 1fr 60px;
  gap: 12px; align-items: center; padding: 10px 16px;
  border-bottom: 1px solid var(--pf-border);
}
.var-row:last-child { border-bottom: 0; }
.var-row.header {
  font-size: 11px; font-weight: 700; color: var(--pf-text-muted);
  background: var(--pf-bg-elevated);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.var-name {
  font-family: var(--pf-font-mono); font-weight: 700;
  color: var(--pf-accent); font-size: 13px;
}
.var-row input {
  height: 32px; padding: 4px 10px; font-size: 12.5px;
  border: 1px solid var(--pf-border); border-radius: var(--pf-radius-xs);
  background: var(--pf-bg-elevated); color: var(--pf-text); outline: none; width: 100%;
  transition: border-color 0.15s;
}
.var-row input:focus { border-color: var(--pf-accent); }
.no-vars-hint {
  padding: 32px; text-align: center; font-size: 13px;
  color: var(--pf-text-muted);
}

.wizard-footer {
  height: 56px; flex-shrink: 0;
  padding: 10px 24px;
  background: var(--pf-bg-elevated);
  border-top: 1px solid var(--pf-border);
  display: flex; align-items: center; gap: 10px;
}
</style>
