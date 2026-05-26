<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from './stores/router'
import { usePromptStore } from './stores/prompt'
import { useAppSettings } from './stores/app'
import { useTheme } from './stores/theme'
import CommandBar from './components/CommandBar.vue'
import CallView from './views/CallView.vue'
import WizardView from './views/WizardView.vue'
import LibraryView from './views/LibraryView.vue'
import QuickSaveView from './views/QuickSaveView.vue'
import ComposeView from './views/ComposeView.vue'
import SettingsView from './views/SettingsView.vue'

const router = useRouter()
const promptStore = usePromptStore()
const appSettings = useAppSettings()
const themeStore = useTheme()
const ready = ref(false)

onMounted(async () => {
  await promptStore.ensureReady()
  await appSettings.load()
  await themeStore.init()
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

const activeComponent = computed(() => viewMap[router.currentRoute.value] || CallView)
</script>

<template>
  <div class="app-shell">
    <template v-if="ready">
      <CommandBar />
      <component :is="activeComponent" />
    </template>
    <div v-else class="loading">
      <div class="loading-spinner"></div>
      <span>PromptForge</span>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%; height: 100%;
  background: var(--pf-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.loading {
  flex: 1; display: flex;
  flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px;
  color: var(--pf-text-muted);
  font-size: 14px; font-weight: 600;
}
.loading-spinner {
  width: 24px; height: 24px;
  border: 2.5px solid var(--pf-border);
  border-top-color: var(--pf-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
