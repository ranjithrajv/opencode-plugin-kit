// Session tab helpers.
//
// Plugins that manage or observe session tabs repeat the same wiring: check
// whether tabs are enabled, read the current tab list reactively, open and
// focus tabs, and handle hosts without tab support. This module owns that
// pattern.
import type { KitContext } from "./host.ts"

/** A session tab entry. */
export interface TabInfo {
  readonly sessionID: string
  readonly title?: string
  readonly active: boolean
  readonly busy?: boolean
  readonly attention?: boolean
  readonly unread?: "activity" | "error"
}

export interface TabsHandle {
  /** Whether session tabs are enabled for this TUI. */
  readonly enabled: () => boolean
  /** The current tab list. Reactive when read in a Solid computation. */
  readonly list: () => readonly TabInfo[]
  /** The currently active tab, or undefined. */
  readonly active: () => TabInfo | undefined
  /** Open a tab for a session without focusing it. */
  readonly open: (sessionID: string) => boolean
  /** Open a tab and focus it. */
  readonly focus: (sessionID: string) => boolean
  /** Move a tab to a specific index. */
  readonly move: (sessionID: string, index: number) => boolean
  /** Close a tab. Closes the active tab when omitted. */
  readonly close: (sessionID?: string) => boolean
  /** Whether a specific session has an open tab. */
  readonly isOpen: (sessionID: string) => boolean
}

/**
 * Create a session tabs handle. Never throws: a host without tab support
 * yields a handle whose methods all return false/empty.
 */
export function createTabs(context: KitContext): TabsHandle {
  const tabs = context?.ui?.tabs

  if (!tabs) {
    return {
      enabled: () => false,
      list: () => [],
      active: () => undefined,
      open: () => false,
      focus: () => false,
      move: () => false,
      close: () => false,
      isOpen: () => false,
    }
  }

  const enabled = (): boolean => {
    try {
      return tabs.enabled()
    } catch {
      return false
    }
  }

  const list = (): readonly TabInfo[] => {
    try {
      return tabs.list()
    } catch {
      return []
    }
  }

  // `list()` already swallows host errors and returns [], so no try/catch here.
  const active = (): TabInfo | undefined => {
    const all = list()
    return all.find((t) => t.active) ?? all[0]
  }

  const open = (sessionID: string): boolean => {
    try {
      return tabs.open(sessionID)
    } catch {
      return false
    }
  }

  const focus = (sessionID: string): boolean => {
    try {
      return tabs.focus(sessionID)
    } catch {
      return false
    }
  }

  const move = (sessionID: string, index: number): boolean => {
    try {
      return tabs.move(sessionID, index)
    } catch {
      return false
    }
  }

  const close = (sessionID?: string): boolean => {
    try {
      return tabs.close(sessionID)
    } catch {
      return false
    }
  }

  // `list()` already swallows host errors and returns [], so no try/catch here.
  const isOpen = (sessionID: string): boolean => {
    return list().some((t) => t.sessionID === sessionID)
  }

  return { enabled, list, active, open, focus, move, close, isOpen }
}
