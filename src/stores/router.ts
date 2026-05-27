import { ref } from 'vue'
import { usePromptStore } from './prompt'

/** 路由状态 */
const currentView = ref<'space' | 'wizard' | 'compose' | 'manage' | 'quick-save' | 'settings'>('space')
const wizardPrefillTitle = ref('')
const quickSaveContent = ref('')
const quickSaveSource = ref<string>('manual')

export function useRouter() {
  function navigateTo(view: 'space' | 'wizard' | 'compose' | 'manage' | 'quick-save' | 'settings') {
    const prompt = usePromptStore()
    prompt.resetSelection()
    currentView.value = view
  }

  function enterWizard(prefillTitle = '') {
    wizardPrefillTitle.value = prefillTitle
    currentView.value = 'wizard'
  }

  function consumeWizardPrefill() {
    const val = wizardPrefillTitle.value
    wizardPrefillTitle.value = ''
    return val
  }

  function enterQuickSave(content: string, source: string) {
    quickSaveContent.value = content
    quickSaveSource.value = source
    currentView.value = 'quick-save'
  }

  return {
    currentView,
    wizardPrefillTitle,
    quickSaveContent,
    quickSaveSource,
    navigateTo,
    enterWizard,
    consumeWizardPrefill,
    enterQuickSave,
  }
}
