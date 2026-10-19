// Shared number/date formatting for sidebar widgets.

/** Locale integer with a safe fallback for non-finite values. */
export function fmt(n: unknown): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "0"
}

/** Dollar cost, fixed to `precision` decimals (default 4); strings pass through untouched. */
export function fmtCost(v: unknown, precision = 4): string {
  if (typeof v === "number" && Number.isFinite(v)) return `$${v.toFixed(precision)}`
  if (typeof v === "string" && v.trim() !== "") return v
  return `$${(0).toFixed(precision)}`
}

/** ISO timestamp -> compact countdown ("2h 5m", "3d 4h"); "" when absent. */
export function until(iso: string | undefined): string {
  if (!iso) return ""
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ""
  const mins = Math.max(0, Math.round((ms - Date.now()) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 48) return `${h}h ${mins % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

/** Compact token-like counts: 999, 1k, 12.3k, 123k, 1.5M, 2B. */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const abs = Math.abs(value)
  if (abs < 1000) return String(Math.round(value))
  const [size, suffix] =
    abs >= 1_000_000_000 ? [1_000_000_000, "B"] : abs >= 1_000_000 ? [1_000_000, "M"] : [1_000, "k"]
  const scaled = value / size
  const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2
  return `${trimFixed(scaled, digits)}${suffix}`
}

/** Cost with precision that stays legible from sub-cent to hundreds of dollars. */
export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0"
  if (value < 0.0001) return "<$0.0001"
  if (value < 1) return `$${trimFixed(value, 4)}`
  if (value < 100) return `$${trimFixed(value, 2)}`
  return `$${Math.round(value)}`
}

/** Human duration from milliseconds ("12ms", "1.5s", "1m 1s", "1h 1m"). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—"
  if (ms < 10) return "<10ms"
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${trimFixed(ms / 1000, 1)}s`
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const leftover = minutes % 60
  return leftover ? `${hours}h ${leftover}m` : `${hours}h`
}

/** Local wall-clock time (HH:MM:SS); "—" for absent timestamps. */
export function formatClock(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—"
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Elapsed time since the previous event, for spotting idle gaps. */
export function formatDelta(previous: number, timestamp: number): string {
  if (!Number.isFinite(previous) || !Number.isFinite(timestamp) || previous <= 0 || timestamp < previous) return ""
  if (timestamp === previous) return ""
  return `+${formatDuration(timestamp - previous)}`
}

/** Ratio (0–1) as a percentage: 0.245 -> "25%", 0.05 -> "5%". */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0%"
  const percent = ratio * 100
  return `${percent >= 10 ? Math.round(percent) : trimFixed(percent, 1)}%`
}

/** Collapse a path to its tail so the filename survives narrow widths. */
export function shortPath(value: string, max = 40): string {
  const normalized = value.replaceAll("\\", "/")
  if (max <= 1) return "…"
  if (normalized.length <= max) return normalized
  const parts = normalized.split("/").filter(Boolean)
  const base = parts[parts.length - 1] ?? normalized
  if (base.length >= max) return `${base.slice(0, Math.max(1, max - 1))}…`
  let tail = base
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const next = `${parts[index]}/${tail}`
    if (next.length + 2 > max) break
    tail = next
  }
  return `…/${tail}`
}

/** Collapse whitespace and ellipsize to a single line of at most `max` chars. */
export function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim()
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max <= 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

function trimFixed(value: number, digits: number): string {
  return value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1")
}
