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
    <!-- 顶栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="goBack">←</button>
      <span class="title">新建提示词</span>
      <span class="spacer"></span>
    </div>

    <!-- 步骤指示器 -->
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

    <!-- 内容区 -->
    <div class="wizard-content">
      <!-- Step 1: 正文 -->
      <div v-if="step === 1" class="step-pane">
        <h2>编写提示词正文</h2>
        <p class="hint-sub">直接输入内容。用 <code v-text="`{{name}}`"></code> 标记变量。按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 可极速保存。</p>
        <div class="field">
          <label>正文内容 <span class="req">*</span></label>
          <textarea v-model="body" class="body-input" placeholder="你是一位 {{role}} 专家。请基于以下代码开展评审…" />
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="detectedVars.length > 0" class="detected-bar">
          <span class="detected-label">识别到 {{ detectedVars.length }} 个变量：</span>
          <span v-for="v in detectedVars" :key="v.name" class="var-badge">{{ v.name }}</span>
        </div>
      </div>

      <!-- Step 2: 基本信息 -->
      <div v-if="step === 2" class="step-pane">
        <h2>设置基本信息</h2>
        <p class="hint-sub">设置标题和标签，不填则自动生成。</p>
        <div class="field">
          <label>标题 <span class="hint">（可选，默认：{{ autoTitle }}）</span></label>
          <input v-model="title" type="text" placeholder="如：PRD 评审建议生成器" />
        </div>
        <div class="field">
          <label>分类</label>
          <select v-model="category">
            <option>其它</option>
            <option>评审</option>
            <option>写作</option>
            <option>翻译</option>
            <option>编码</option>
            <option>问答</option>
          </select>
        </div>
        <div class="field">
          <label>标签 <span class="hint">（逗号分隔）</span></label>
          <input v-model="tagsRaw" type="text" placeholder="PRD, 评审, 产品经理" />
        </div>
      </div>

      <!-- Step 3: 变量配置 -->
      <div v-if="step === 3" class="step-pane">
        <h2>变量精细配置</h2>
        <p class="hint-sub">配置每个变量的必填性和默认值。</p>
        <div v-if="detectedVars.length > 0" class="var-table">
          <div class="var-row header">
            <div>变量名</div>
            <div>默认值</div>
            <div style="text-align:center">必填</div>
          </div>
          <div v-for="v in detectedVars" :key="v.name" class="var-row">
            <div class="var-name">{{ v.name }}</div>
            <div><input :value="variableConfigs[v.name]?.defaultValue ?? v.defaultValue ?? ''" @input="variableConfigs[v.name] = { required: variableConfigs[v.name]?.required ?? v.required, defaultValue: ($event.target as HTMLInputElement).value }" placeholder="默认值…" /></div>
            <div style="text-align:center"><input type="checkbox" :checked="variableConfigs[v.name]?.required ?? v.required" @change="variableConfigs[v.name] = { required: ($event.target as HTMLInputElement).checked, defaultValue: variableConfigs[v.name]?.defaultValue ?? v.defaultValue ?? '' }" /></div>
          </div>
        </div>
        <div v-else class="no-vars-hint">💡 本提示词没有变量。保存后可一键直接复制。</div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="wizard-footer">
      <button v-if="step > 1" class="btn" @click="prevStep">← 上一步</button>
      <button v-else class="btn" @click="goBack">取消</button>
      <span class="spacer"></span>
      <template v-if="step === 1">
        <button class="btn" :disabled="saving" @click="savePrompt('active')">
          {{ saving ? '保存中…' : '⚡ 极速保存' }}
        </button>
        <button class="btn primary" @click="nextStep">配置高级项 →</button>
      </template>
      <template v-else-if="step === 2">
        <button class="btn" :disabled="saving" @click="savePrompt('active')">
          {{ saving ? '保存中…' : '直接保存' }}
        </button>
        <button class="btn primary" @click="nextStep">下一步 (变量配置) →</button>
      </template>
      <template v-else>
        <button class="btn" :disabled="saving" @click="savePrompt('draft')">
          {{ saving ? '保存中…' : '保存为草稿' }}
        </button>
        <button class="btn primary" :disabled="saving" @click="savePrompt('active')">
          {{ saving ? '保存中…' : '发布并启用 V1' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wizard-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg);
  user-select: none;
}
.top-bar {
  height: 48px; flex-shrink: 0;
  display: flex; align-items: center;
  padding: 0 16px; gap: 10px;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-surface);
}
.back-btn {
  width: 28px; height: 28px;
  border: 0; background: transparent;
  color: var(--pf-text-muted); font-size: 16px;
  border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.back-btn:hover { background: var(--pf-bg); color: var(--pf-text); }
.title { font-size: 13.5px; font-weight: 600; color: var(--pf-text); }
.spacer { flex: 1; }

.stepper {
  height: 52px; flex-shrink: 0;
  display: flex; align-items: center;
  justify-content: center; gap: 16px;
  border-bottom: 1px solid var(--pf-border-soft);
  background: var(--pf-surface-raised);
}
.step {
  font-size: 12.5px; color: var(--pf-text-faint);
  display: flex; align-items: center; gap: 6px; font-weight: 500;
}
.step.active { color: var(--pf-primary); font-weight: 600; }
.step.done { color: var(--pf-success); font-weight: 600; }
.step-num {
  width: 20px; height: 20px; border-radius: 50%;
  border: 1.5px solid var(--pf-border-strong);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.step.active .step-num { border-color: var(--pf-primary); background: var(--pf-primary-soft); color: var(--pf-primary); }
.step.done .step-num { border-color: var(--pf-success); background: var(--pf-success-soft); color: var(--pf-success); }
.divider { width: 32px; height: 1.5px; background: var(--pf-border); }
.divider.done { background: var(--pf-success); }

.wizard-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 24px 32px;
}
.step-pane h2 { font-size: 17px; font-weight: 600; color: var(--pf-text); margin: 0 0 4px; }
.hint-sub { font-size: 12.5px; color: var(--pf-text-muted); margin: 0 0 20px; }
.hint-sub code {
  background: var(--pf-primary-soft); color: var(--pf-primary);
  padding: 1px 5px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 11px;
}
.field { margin-bottom: 16px; }
.field label {
  display: block; font-size: 12px; color: var(--pf-text-muted);
  font-weight: 500; margin-bottom: 6px;
}
.field .req { color: var(--pf-danger); }
.field .hint { font-size: 11px; color: var(--pf-text-faint); font-weight: 400; }
.field input, .field select, .field textarea {
  width: 100%; border: 1px solid var(--pf-border);
  background: var(--pf-surface); color: var(--pf-text);
  border-radius: var(--pf-radius-sm); padding: 8px 12px;
  font-size: 13px; outline: 0;
}
.field input:focus, .field select:focus, .field textarea:focus {
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px var(--pf-primary-soft);
}
.body-input { min-height: 200px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.error-msg {
  padding: 8px 10px; border: 1px solid var(--pf-danger);
  background: var(--pf-danger-soft); color: #8B2020;
  border-radius: var(--pf-radius-sm); font-size: 12px; margin-bottom: 12px;
}
.detected-bar {
  margin-top: 12px; padding: 10px 14px;
  background: var(--pf-primary-soft); border-radius: var(--pf-radius-sm);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.detected-label { font-size: 12px; font-weight: 600; color: var(--pf-primary); }
.var-badge {
  background: var(--pf-surface); color: var(--pf-primary);
  border: 1px solid var(--pf-border); border-radius: 12px;
  padding: 2px 10px; font-family: ui-monospace, monospace;
  font-size: 11px; font-weight: 600;
}
.var-table { border: 1px solid var(--pf-border); border-radius: var(--pf-radius-sm); background: var(--pf-surface); }
.var-row {
  display: grid; grid-template-columns: 1fr 1fr 60px;
  gap: 10px; align-items: center; padding: 8px 14px;
  border-bottom: 1px solid var(--pf-border-soft);
}
.var-row:last-child { border-bottom: 0; }
.var-row.header { font-size: 11px; font-weight: 600; color: var(--pf-text-muted); background: var(--pf-surface-raised); }
.var-name { font-family: ui-monospace, monospace; font-weight: 600; color: var(--pf-primary); font-size: 12.5px; }
.var-row input {
  height: 28px; padding: 2px 8px; font-size: 12px;
  border: 1px solid var(--pf-border); border-radius: var(--pf-radius-xs);
  background: var(--pf-surface); color: var(--pf-text); outline: none; width: 100%;
}
.var-row input:focus { border-color: var(--pf-primary); }
.no-vars-hint { padding: 24px; text-align: center; font-size: 12.5px; color: var(--pf-text-muted); }

.wizard-footer {
  height: 52px; flex-shrink: 0;
  padding: 10px 24px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-surface-raised);
  display: flex; align-items: center; gap: 8px;
}
</style>
