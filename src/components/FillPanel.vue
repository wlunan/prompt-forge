<script setup lang="ts">
import { computed } from 'vue'
import type { PromptUnit } from '../types'
import { renderVariables } from '../utils/index'

const props = defineProps<{
  unit: PromptUnit | null
  values: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'update:values', values: Record<string, string>): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const variables = computed(() => props.unit?.variables || [])
const missingCount = computed(() =>
  variables.value.filter(v => v.required && !props.values[v.name]?.trim()).length
)
const preview = computed(() => {
  if (!props.unit) return ''
  return renderVariables(props.unit.body, props.values)
})

function updateValue(name: string, value: string) {
  emit('update:values', { ...props.values, [name]: value })
}
</script>

<template>
  <div class="fill-wrap">
    <!-- 变量表单 -->
    <div class="form-scroll">
      <div v-if="variables.length > 0" class="var-form">
        <div v-for="v in variables" :key="v.name" class="field">
          <label>
            {{ v.name }}
            <span v-if="v.required" class="req">*</span>
            <span class="hint">{{ v.required ? '必填' : '可选' }}</span>
          </label>
          <input
            :value="values[v.name]"
            type="text"
            :placeholder="v.defaultValue ? `默认: ${v.defaultValue}` : '请输入…'"
            @input="updateValue(v.name, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div v-else class="no-vars">无需变量，直接复制即可</div>
    </div>

    <!-- 预览 -->
    <div class="preview-bar" :class="{ ready: missingCount === 0 && variables.length > 0 }">
      <span v-if="variables.length > 0 && missingCount > 0" class="preview-text">
        还需填写 {{ missingCount }} 个变量
      </span>
      <span v-else-if="variables.length > 0" class="preview-text">
        ✓ 已就绪
      </span>
      <span v-else class="preview-text">无需变量</span>
      <span class="preview-body">{{ preview.slice(0, 60) }}{{ preview.length > 60 ? '…' : '' }}</span>
    </div>

    <!-- 底部按钮 -->
    <div class="actions">
      <button class="btn" @click="emit('cancel')">
        <kbd>Esc</kbd> 返回
      </button>
      <span class="spacer"></span>
      <button class="btn primary" @click="emit('submit')">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        复制
      </button>
    </div>
  </div>
</template>

<style scoped>
.fill-wrap {
  height: 100%; display: flex; flex-direction: column;
  background: var(--pf-bg);
}
.form-scroll {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 20px;
}
.var-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.var-form:has(.field:only-child) { grid-template-columns: 1fr; }
.field {
  display: flex; flex-direction: column; gap: 6px;
}
.field label {
  font-size: 12px; font-weight: 600;
  color: var(--pf-text-secondary);
  display: flex; align-items: center; gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.req { color: var(--pf-danger); }
.hint {
  margin-left: auto;
  font-size: 10px; font-weight: 500;
  color: var(--pf-text-faint);
  text-transform: none;
  letter-spacing: 0;
  padding: 1px 6px;
  background: var(--pf-surface-raised);
  border-radius: var(--pf-radius-xs);
}
.field input {
  height: 40px;
  padding: 0 14px;
  background: var(--pf-surface);
  border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius-sm);
  font-size: 13.5px;
  color: var(--pf-text);
  transition: all 0.15s ease;
}
.field input:focus {
  border-color: var(--pf-accent);
  box-shadow: 0 0 0 3px var(--pf-accent-soft);
  outline: none;
}
.field input::placeholder { color: var(--pf-text-faint); }
.no-vars {
  display: flex; align-items: center; justify-content: center;
  height: 100%; font-size: 14px; color: var(--pf-text-muted);
}

.preview-bar {
  padding: 10px 20px;
  border-top: 1px solid var(--pf-border);
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-surface);
  display: flex; align-items: center; gap: 12px;
  font-size: 12px;
}
.preview-bar.ready { border-color: var(--pf-success); }
.preview-text {
  font-weight: 600;
  color: var(--pf-text-secondary);
  white-space: nowrap;
}
.preview-bar.ready .preview-text { color: var(--pf-success); }
.preview-body {
  color: var(--pf-text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--pf-font-mono); font-size: 11.5px;
}

.actions {
  padding: 12px 20px;
  display: flex; align-items: center; gap: 10px;
  background: var(--pf-bg-elevated);
}
.spacer { flex: 1; }
</style>
