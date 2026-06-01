import { ref } from 'vue'
import { usePromptStore } from './prompt'

/** 路由状态 */
const currentView = ref<'space' | 'wizard' | 'compose' | 'manage' | 'quick-save' | 'settings'>('space')
const wizardPrefillTitle = ref('')
const wizardProjectId = ref('')
const quickSaveContent = ref('')
const quickSaveSource = ref<string>('manual')
const quickSaveProjectId = ref('')

export function useRouter() {
  function navigateTo(view: 'space' | 'wizard' | 'compose' | 'manage' | 'quick-save' | 'settings') {
    const prompt = usePromptStore()
    prompt.resetSelection()
    currentView.value = view
  }

  function enterWizard(prefillTitle = '', projectId = '') {
    wizardPrefillTitle.value = prefillTitle
    wizardProjectId.value = projectId
    currentView.value = 'wizard'
  }

  function consumeWizardPrefill() {
    const val = wizardPrefillTitle.value
    wizardPrefillTitle.value = ''
    return val
  }

  function consumeWizardProjectId() {
    const val = wizardProjectId.value
    wizardProjectId.value = ''
    return val
  }

  function enterQuickSave(content: string, source: string, projectId = '') {
    quickSaveContent.value = content
    quickSaveSource.value = source
    quickSaveProjectId.value = projectId
    currentView.value = 'quick-save'
  }

  return {
    currentView,
    wizardPrefillTitle,
    wizardProjectId,
    quickSaveContent,
    quickSaveSource,
    quickSaveProjectId,
    navigateTo,
    enterWizard,
    consumeWizardPrefill,
    consumeWizardProjectId,
    enterQuickSave,
  }
}
