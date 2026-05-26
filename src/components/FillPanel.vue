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
  variables.value.filter(v => {
    if (!v.required) return false
    return !props.values[v.name]?.trim()
  }).length
)

const preview = computed(() => {
  if (!props.unit) return ''
  return renderVariables(props.unit.body, props.values)
})

function updateValue(name: string, value: string) {
  const newValues = { ...props.values, [name]: value }
  emit('update:values', newValues)
}
</script>

<template>
  <div class="fill-panel">
    <!-- 顶部状态栏 -->
    <div :class="['status-bar', { error: false, ready: missingCount === 0 && variables.length > 0 }]">
      <svg v-if="false" class="status-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <svg v-else class="status-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
        <circle cx="12" cy="12" r="10" /><polyline points="12 16 16 12 12 8" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>

      <span v-if="variables.length > 0 && missingCount > 0" class="status-text">
        待填 {{ missingCount }} / 共 {{ variables.length }}
      </span>
      <span v-else-if="variables.length > 0 && missingCount === 0" class="status-text">
        <b>就绪</b>: {{ preview.slice(0, 80) }}{{ preview.length > 80 ? '…' : '' }}
      </span>
      <span v-else class="status-text">无需变量，可以直接复制</span>
    </div>

    <!-- 变量表单 -->
    <div class="form-area">
      <div v-if="variables.length > 0" class="var-form">
        <div v-for="v in variables" :key="v.name" class="form-field">
          <label :for="v.name">
            {{ v.name }}
            <span v-if="v.required" class="required">*</span>
            <span class="type-hint">{{ v.required ? '必填' : '可选' }}</span>
          </label>
          <input
            :id="v.name"
            :value="values[v.name]"
            type="text"
            :placeholder="v.defaultValue ? `默认: ${v.defaultValue}` : '请输入值…'"
            @input="updateValue(v.name, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div v-else class="no-vars">无需任何参数。</div>
    </div>

    <!-- 底部操作 -->
    <div class="actions">
      <button class="btn" @click="emit('cancel')"><kbd>Esc</kbd> 取消</button>
      <span class="spacer"></span>
      <button class="btn primary" @click="emit('submit')"><kbd>Enter</kbd> 复制并关闭</button>
    </div>
  </div>
</template>

<style scoped>
.fill-panel {
  height: 100%; display: flex;
  flex-direction: column;
  background: var(--pf-bg);
}
.status-bar {
  display: flex; align-items: center;
  gap: 10px; padding: 0 14px;
  height: 38px; flex-shrink: 0;
  border-bottom: 1px solid var(--pf-border);
  background: var(--pf-surface-raised);
  font-size: 12px; color: var(--pf-text-muted);
}
.status-bar.ready { color: var(--pf-success); background: var(--pf-success-soft); border-bottom-color: var(--pf-success); }
.status-bar.error { color: var(--pf-danger); background: var(--pf-danger-soft); border-bottom-color: var(--pf-danger); }
.status-icon { flex: 0 0 14px; opacity: 0.6; }
.status-text b { font-weight: 600; color: var(--pf-text); }
.form-area {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 12px 16px;
}
.var-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
}
.var-form:has(.form-field:only-child) {
  grid-template-columns: 1fr;
}
.form-field {
  display: flex; flex-direction: column; gap: 5px; min-width: 0;
}
.form-field label {
  font-size: 11.5px; color: var(--pf-text-muted);
  font-weight: 500; display: flex; align-items: center; gap: 6px;
}
.required { color: var(--pf-danger); }
.type-hint {
  margin-left: auto; font-size: 10px; color: var(--pf-text-faint);
  font-weight: 400; background: var(--pf-tag-bg); padding: 1px 6px; border-radius: 3px;
}
.form-field input {
  font-size: 13px; color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-border); border-radius: 6px;
  padding: 8px 10px; outline: 0;
  transition: border-color 0.12s, box-shadow 0.12s;
  width: 100%;
}
.form-field input:focus {
  border-color: var(--pf-primary);
  box-shadow: 0 0 0 3px rgba(74, 111, 165, 0.1);
}
.form-field input::placeholder { color: var(--pf-text-faint); }
.no-vars {
  display: flex; align-items: center; justify-content: center;
  height: 100%; font-size: 13px; color: var(--pf-text-muted);
}
.actions {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--pf-border);
  background: var(--pf-bg);
}
.spacer { flex: 1; }
</style>
