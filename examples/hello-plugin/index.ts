// Minimal OpenCode sidebar plugin using opencode-plugin-kit.
//
// This example demonstrates the three most common kit patterns:
// 1. createCachedStore — persist UI state across TUI restarts
// 2. createViewPicker — slash command + dialog to switch views
// 3. Formatting helpers — format numbers, costs, and durations
//
// To use: install this plugin in your OpenCode config and restart the TUI.
import type { Context } from "@opencode/plugin/tui/context"
import { createViewPicker, createCachedStore, fmtCost, formatDuration } from "opencode-plugin-kit"

export default {
  id: "hello",
  name: "Hello",
  setup(context: Context) {
    // --- Pattern 1: Persisted state ------------------------------------
    // The cached store survives TUI restarts and supports stale-while-
    // revalidate patterns. Here we persist the user's name.
    const nameStore = createCachedStore<string>(context, "hello.name", {
      initial: "",
      staleAfterMs: 30_000,
    })

    // --- Pattern 2: View picker ---------------------------------------
    // A registry of views, a slash command, a dialog, and a toast.
    const picker = createViewPicker(context, {
      registry: [
        { id: "tokens", title: "Token count", description: "Show token usage" },
        { id: "cost", title: "Cost", description: "Show cost in USD" },
      ],
      storageKey: "hello.view",
      command: {
        id: "hello.view",
        group: "Hello",
        name: "hello-view",
        title: (v) => `Hello: current view (${v.title})`,
        description: "Switch the hello widget view",
      },
      dialog: { title: "Hello view", message: "Choose what to display" },
      toastPrefix: "Hello",
    })
    picker.registerCommand()

    // --- Pattern 3: Formatting helpers --------------------------------
    // Pure functions that format numbers, costs, and durations
    // consistently across all plugins.
    const tokens = 12500
    const cost = 0.042
    const elapsed = 3_661_000 // 1h 1m 1s in ms

    const formatted = {
      tokens: tokens.toLocaleString(), // "12,500"
      cost: fmtCost(cost), // "$0.042"
      duration: formatDuration(elapsed), // "1h 1m"
    }

    // --- Render the sidebar widget ------------------------------------
    context.ui.slot({
      append: "sidebar.footer",
      render: () => {
        const name = nameStore.value
        const view = picker.current()
        return {
          type: "text",
          content: `Hello${name ? ` ${name}` : ""}! View: ${view.title} | ${formatted.tokens} tokens | ${formatted.cost} | ${formatted.duration}`,
        }
      },
    })

    return () => {
      nameStore.set("")
    }
  },
}
