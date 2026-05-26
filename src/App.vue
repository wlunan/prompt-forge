<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from './stores/router'
import { usePromptStore } from './stores/prompt'
import { useAppSettings } from './stores/app'
import CallView from './views/CallView.vue'
import WizardView from './views/WizardView.vue'
import LibraryView from './views/LibraryView.vue'
import QuickSaveView from './views/QuickSaveView.vue'
import ComposeView from './views/ComposeView.vue'
import SettingsView from './views/SettingsView.vue'

const router = useRouter()
const promptStore = usePromptStore()
const appSettings = useAppSettings()
const ready = ref(false)

onMounted(async () => {
  await promptStore.ensureReady()
  await appSettings.load()
  ready.value = true

  const ztools = (window as any).ztools
  if (ztools) {
    ztools.onPluginEnter(async (param: any) => {
      if (param.code === 'promptforge_call') {
        router.navigateTo('call')
      } else if (param.code === 'promptforge_quick_save') {
        const content = param.type === 'over'
          ? String(param.payload ?? '')
          : ''
        if (content.length >= 20) {
          router.enterQuickSave(content, param.type === 'over' ? 'selected' : 'clipboard')
        }
      }
    })
    ztools.onPluginOut(() => {
      router.resetSelection()
    })
  }
})

const viewMap: Record<string, any> = {
  call: CallView,
  wizard: WizardView,
  library: LibraryView,
  'quick-save': QuickSaveView,
  compose: ComposeView,
  settings: SettingsView,
}

const currentView = ref('call')
router.currentRoute.value // 初始触发响应

// 使用 computed 而非 watch，以实时响应路由变化
import { computed } from 'vue'
const activeComponent = computed(() => viewMap[router.currentRoute.value] || CallView)
</script>

<template>
  <div class="app-shell">
    <template v-if="ready">
      <component :is="activeComponent" />
    </template>
    <div v-else class="loading">
      <span class="loading-text">PromptForge 加载中…</span>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  background: var(--pf-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-text {
  font-size: 13px;
  color: var(--pf-text-muted);
}
</style>
