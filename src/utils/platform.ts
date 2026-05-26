/** 复制文本到剪贴板 */
export async function copyText(text: string): Promise<void> {
  const ztools = (window as any).ztools
  if (ztools?.copyText) {
    ztools.copyText(text)
    return
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  throw new Error('Clipboard API not available')
}

/** 显示通知 */
export function showNotification(message: string) {
  const ztools = (window as any).ztools
  if (ztools?.showNotification) {
    ztools.showNotification(message)
  }
}

/** 延迟隐藏主窗口 */
export function hideMainWindow(delay = 200) {
  const ztools = (window as any).ztools
  if (!ztools?.hideMainWindow) return
  setTimeout(() => {
    ztools.hideMainWindow()
  }, delay)
}

/** 退出插件 */
export async function outPlugin() {
  const ztools = (window as any).ztools
  if (ztools?.outPlugin) {
    await ztools.outPlugin()
  }
}

/** 在资源管理器中显示文件 */
export function showInFolder(path: string) {
  const ztools = (window as any).ztools
  if (ztools?.shellShowItemInFolder) {
    ztools.shellShowItemInFolder(path)
  }
}
