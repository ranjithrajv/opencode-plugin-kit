// Tolerant JSONC handling and comment-preserving `plugins` array edits.
//
// OpenCode configs may be JSONC (comments, trailing commas), and users keep
// those comments. Reading is one problem; editing the `plugins` array without
// rewriting the file is another. Both live here so every config-editing plugin
// shares one implementation (and one corpus of tests).

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Strip // and block comments plus trailing commas from JSONC text (string
 * contents are preserved verbatim) so JSON.parse can read the result. */
export function cleanJsonc(text: string): string {
  let out = ""
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      // Copy the string (with escapes) verbatim.
      let j = i + 1
      while (j < text.length) {
        if (text[j] === "\\") j += 2
        else if (text[j] === '"') {
          j++
          break
        } else j++
      }
      out += text.slice(i, j)
      i = j
      continue
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++
      continue // the newline itself is copied on the next iteration
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      out += " "
      continue
    }
    if (c === ",") {
      // Drop a trailing comma: skip whitespace/comments after it and check
      // whether the next significant character closes the current scope.
      let j = i + 1
      for (;;) {
        while (j < text.length && /\s/.test(text[j])) j++
        if (text[j] === "/" && text[j + 1] === "/") {
          while (j < text.length && text[j] !== "\n") j++
          continue
        }
        if (text[j] === "/" && text[j + 1] === "*") {
          j += 2
          while (j < text.length && !(text[j] === "*" && text[j + 1] === "/")) j++
          j += 2
          continue
        }
        break
      }
      if (text[j] === "}" || text[j] === "]") {
        i++ // drop the comma
        continue
      }
    }
    out += c
    i++
  }
  return out
}

/** Parse JSONC (or plain JSON). Returns undefined for unparseable input. */
export function tolerantParse(text: string): unknown {
  try {
    return JSON.parse(cleanJsonc(text))
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Editing the top-level `plugins` array textually
// ---------------------------------------------------------------------------

interface StrTok {
  t: "str"
  v: string
  start: number
  end: number
}
interface PTok {
  t: "p"
  ch: string
  start: number
}
type Tok = StrTok | PTok

/** Tokenize JSONC: strings (with offsets) and punctuation; comments skipped. */
function scanTokens(text: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === "\\") j += 2
        else if (text[j] === '"') {
          j++
          break
        } else j++
      }
      toks.push({ t: "str", v: text.slice(i + 1, j - 1), start: i, end: j })
      i = j
      continue
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++
      continue
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      continue
    }
    if ("{}[],:".includes(c)) toks.push({ t: "p", ch: c, start: i })
    i++
  }
  return toks
}

function indentOf(text: string, pos: number): string {
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1
  // `[ \t]*` always matches (possibly empty), so exec never returns null.
  return /^[ \t]*/.exec(text.slice(lineStart, pos))![0]
}

/** Locate the top-level `plugins` key. Returns the token index of its "[",
 * or null when the key is absent. `nonArray` flags `"plugins": <not-array>`.
 * Only the root-level key matches — nested objects that happen to have a
 * `plugins` key (e.g. under `mcp`) are ignored. */
function findPluginsArray(toks: Tok[]): { bracket: number; nonArray?: boolean } | null {
  // The document is an object, so its keys live at brace depth 1; anything
  // nested sits deeper.
  let depth = 0
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i]
    if (t.t === "p") {
      if (t.ch === "{" || t.ch === "[") depth++
      else if (t.ch === "}" || t.ch === "]") depth--
      continue
    }
    if (depth !== 1 || t.t !== "str" || t.v !== "plugins") continue
    const colon = toks[i + 1]
    if (colon.t !== "p" || colon.ch !== ":") continue
    const value = toks[i + 2]
    if (value.t === "p" && value.ch === "[") return { bracket: i + 2 }
    return { bracket: -1, nonArray: true }
  }
  return null
}

/** Collect the string items of the plugins array. Returns null when the array
 * holds anything besides strings and commas (not a plugin list) — callers
 * fall back to a full rewrite. */
function arrayItems(toks: Tok[], open: number, close: number): StrTok[] | null {
  const items: StrTok[] = []
  for (let i = open + 1; i < close; i++) {
    const t = toks[i]
    if (t.t === "str") items.push(t)
    else if (t.ch !== ",") return null
  }
  return items
}

function matchingClose(toks: Tok[], open: number): number {
  let depth = 0
  for (let i = open; i < toks.length; i++) {
    const t = toks[i]
    if (t.t !== "p") continue
    if (t.ch === "[" || t.ch === "{") depth++
    else if (t.ch === "]" || t.ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Insert a plugin specifier into the `plugins` array textually. Returns the
 * updated document, the original text when the spec is already present, or
 * null when there is no plugins array (the caller may insert one). */
export function addPluginSpec(raw: string, spec: string): string | null {
  const toks = scanTokens(raw)
  const found = findPluginsArray(toks)
  if (!found || found.nonArray || found.bracket < 0) return null
  const close = matchingClose(toks, found.bracket)
  if (close < 0) return null
  const items = arrayItems(toks, found.bracket, close)
  if (items === null) return null
  const q = JSON.stringify(spec)

  if (items.length === 0) {
    const openTok = toks[found.bracket] as PTok
    const closeTok = toks[close] as PTok
    if (!raw.slice(openTok.start, closeTok.start).includes("\n")) {
      return raw.slice(0, openTok.start + 1) + q + raw.slice(closeTok.start)
    }
    const ind = indentOf(raw, closeTok.start)
    return raw.slice(0, openTok.start + 1) + `\n${ind}  ${q}\n${ind}` + raw.slice(closeTok.start)
  }

  if (items.some((t) => t.v === spec)) return raw
  const last = items[items.length - 1]
  // Inline array: append without a newline.
  if (!raw.slice(toks[found.bracket].start, last.start).includes("\n")) {
    return raw.slice(0, last.end) + `,${q}` + raw.slice(last.end)
  }
  const ind = indentOf(raw, last.start)
  // A trailing comma (legal JSONC) right after the last item → insert after it.
  let after = last.end
  while (after < raw.length && (raw[after] === " " || raw[after] === "\t")) after++
  if (raw[after] === ",") {
    return raw.slice(0, after + 1) + `\n${ind}${q}` + raw.slice(after + 1)
  }
  return raw.slice(0, last.end) + `,\n${ind}${q}` + raw.slice(last.end)
}

/** Insert a `plugins` array (with one specifier) into a document that has no
 * plugins key, textually — preserving any comments. */
export function addPluginsKey(raw: string, spec: string): string | null {
  const toks = scanTokens(raw)
  let closeTok: PTok | undefined
  for (const t of toks) if (t.t === "p" && t.ch === "}") closeTok = t
  if (!closeTok) return null
  const q = JSON.stringify(spec)
  // Does the object already have members (a "," or ":" before the brace)?
  let needsComma = false
  for (const t of toks) {
    if (t.t === "p" && t.ch === "}" && t.start === closeTok.start) break
    if (t.t === "p" && (t.ch === "," || t.ch === ":")) needsComma = true
  }
  const ind = indentOf(raw, closeTok.start)
  const prefix = needsComma ? "," : ""
  return raw.slice(0, closeTok.start) + `${prefix}\n${ind}  "plugins": [${q}]\n${ind}` + raw.slice(closeTok.start)
}

/** Remove the first plugin specifier matching `matches` from the `plugins`
 * array, textually. Returns the text and whether anything was removed, or
 * null when there is no plugins array. */
export function removePluginSpec(
  raw: string,
  matches: (spec: string) => boolean,
): { text: string; removed: boolean } | null {
  const toks = scanTokens(raw)
  const found = findPluginsArray(toks)
  if (!found || found.nonArray || found.bracket < 0) return null
  const close = matchingClose(toks, found.bracket)
  if (close < 0) return null
  const items = arrayItems(toks, found.bracket, close)
  if (items === null) return null

  // Find the first matching item's token index directly.
  let at = -1
  for (let i = found.bracket + 1; i < close; i++) {
    const t = toks[i]
    if (t.t === "str" && matches(t.v)) {
      at = i
      break
    }
  }
  if (at < 0) return { text: raw, removed: false }
  const item = toks[at] as StrTok
  // Trim whitespace back to (and including) the item's newline, so a removed
  // multiline item doesn't leave a blank indented line behind.
  let cutStart = item.start
  while (cutStart > 0 && (raw[cutStart - 1] === " " || raw[cutStart - 1] === "\t")) cutStart--
  if (raw[cutStart - 1] === "\n") cutStart--
  const next = toks[at + 1]
  if (next && next.t === "p" && next.ch === ",") {
    // Drop the item and its trailing comma, collapsing the whitespace after
    // the comma to a single space so inline arrays keep a separator. When the
    // removed item was the first, no separator is needed after the "[".
    let end = (next as PTok).start + 1
    let ws = ""
    const isFirst = !toks.slice(found.bracket + 1, at).some((t) => t.t === "str")
    if (!isFirst) {
      while (end < raw.length && (raw[end] === " " || raw[end] === "\t")) {
        ws ||= " "
        end++
      }
    }
    return {
      text: raw.slice(0, cutStart) + ws + raw.slice(end),
      removed: true,
    }
  }
  // Last item: drop the preceding comma (if any) together with the item.
  if (at > found.bracket + 1) {
    const prev = toks[at - 1]
    if (prev.t === "p" && prev.ch === ",") cutStart = prev.start
  }
  return { text: raw.slice(0, cutStart) + raw.slice(item.end), removed: true }
}

// ---------------------------------------------------------------------------
// Whole-document edit
// ---------------------------------------------------------------------------

export type PluginsEdit = { add: string; remove?: undefined } | { add?: undefined; remove: (spec: string) => boolean }

/** Apply an install/uninstall edit to the raw config text, preserving every
 * comment and every byte of formatting outside the `plugins` array. Falls
 * back to a full rewrite only when the document shape defeats the textual
 * edit. */
export function editPluginsText(raw: string, edit: PluginsEdit, parsed: unknown, next: string[]): string {
  if (edit.add !== undefined) {
    const spliced = addPluginSpec(raw, edit.add)
    if (spliced !== null) return spliced
    const keyed = addPluginsKey(raw, edit.add)
    if (keyed !== null) return keyed
  } else {
    const result = removePluginSpec(raw, edit.remove)
    if (result !== null) return result.text
  }
  const base = typeof parsed === "object" && parsed !== null ? parsed : {}
  return `${JSON.stringify({ ...base, plugins: next }, null, 2)}\n`
}
