import { ref } from 'vue'

/** 路由状态 */
const currentRoute = ref('call')
const quickSaveContent = ref('')
const quickSaveSource = ref<string>('manual')
const wizardPrefillTitle = ref('')

export function useRouter() {
  function navigateTo(route: string) {
    currentRoute.value = route
  }

  function enterQuickSave(content: string, source: string) {
    quickSaveContent.value = content
    quickSaveSource.value = source
    currentRoute.value = 'quick-save'
  }

  function enterWizard(prefillTitle = '') {
    wizardPrefillTitle.value = prefillTitle
    currentRoute.value = 'wizard'
  }

  function consumeWizardPrefill() {
    const val = wizardPrefillTitle.value
    wizardPrefillTitle.value = ''
    return val
  }

  return {
    currentRoute,
    quickSaveContent,
    quickSaveSource,
    wizardPrefillTitle,
    navigateTo,
    enterQuickSave,
    enterWizard,
    consumeWizardPrefill,
  }
}
