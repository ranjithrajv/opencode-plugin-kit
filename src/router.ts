// Plugin page routing helpers.
//
// Plugins that provide a full-screen UI (settings, configuration, data
// browsers) repeat the same wiring: register a page with the host's router,
// navigate to it programmatically, and read the current route reactively.
// This module owns that pattern.
import type { KitContext } from "./host.ts"

/** A plugin page definition. */
export interface PageDefinition {
  /** Unique page name, e.g. "my-plugin.settings". */
  readonly name: string
  /** Render the page content. */
  readonly render: (input: { data?: Record<string, unknown> }) => unknown
  /** Optional metadata for the page. */
  readonly data?: Record<string, unknown>
}

/** The current route, as reported by the host. */
export interface RouteInfo {
  readonly type: string
  readonly id?: string
  readonly name?: string
  readonly data?: Record<string, unknown>
}

export interface RouterHandle {
  /** The cleanup function returned by the host's router. */
  readonly cleanup: () => void
  /** Navigate to this plugin's page. */
  readonly navigate: () => void
  /** Whether this plugin's page is currently active. */
  readonly isActive: () => boolean
  /** The current route info, or undefined if the host has no router. */
  readonly current: () => RouteInfo | undefined
}

/**
 * Register a plugin page and return a handle for navigation.
 * Never throws: a host without router support yields a no-op handle.
 */
export function createPage(context: KitContext, page: PageDefinition): RouterHandle {
  const router = context?.ui?.router

  if (!router) {
    return {
      cleanup: () => {},
      navigate: () => {},
      isActive: () => false,
      current: () => undefined,
    }
  }

  const cleanup = router.register({
    name: page.name,
    render: page.render,
  })

  const navigate = () => {
    try {
      router.navigate({ type: "plugin", id: page.name, name: page.name, data: page.data })
    } catch {
      // Navigation failed (e.g. host is shutting down); ignore.
    }
  }

  const isActive = () => {
    try {
      const route = router.current()
      return route?.type === "plugin" && route?.id === page.name
    } catch {
      return false
    }
  }

  const current = (): RouteInfo | undefined => {
    try {
      return router.current()
    } catch {
      return undefined
    }
  }

  return { cleanup, navigate, isActive, current }
}

/**
 * Navigate to a plugin page by name. A no-op when the host has no router.
 */
export function navigateTo(context: KitContext, name: string, data?: Record<string, unknown>): void {
  try {
    context?.ui?.router?.navigate({ type: "plugin", id: name, name, data })
  } catch {
    // Router unavailable.
  }
}

/**
 * Read the current route reactively. Returns undefined when the host has no
 * router.
 */
export function currentRoute(context: KitContext): RouteInfo | undefined {
  try {
    return context?.ui?.router?.current()
  } catch {
    return undefined
  }
}
