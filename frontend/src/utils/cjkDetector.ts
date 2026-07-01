/**
 * CJK Detector — post-processing QC utility
 * Finds CJK characters (Hiragana, Katakana, Kanji, Hangul) in translated text
 */

export interface CJKIncident {
  chars: string
  context: string
  label?: string // chapter label for series-level aggregation
}

// Japanese dialogue brackets — the only CJK Symbols chars flagged as noise.
// All other brackets (【】《》『』〈〉 etc.) are intentionally kept by translators
// as formatting markers and are excluded from detection.
const DIALOGUE_BRACKETS = new Set([
  0x300C, // 「 LEFT CORNER BRACKET
  0x300D, // 」 RIGHT CORNER BRACKET
])

// Ranges outside CJK Symbols & Punctuation that indicate unintended CJK leakage
const LEAK_RANGES: [number, number][] = [
  [0x3040, 0x309F], // Hiragana
  [0x30A0, 0x30FF], // Katakana
  [0x3400, 0x4DBF], // CJK Extension A
  [0x4E00, 0x9FFF], // CJK Unified Ideographs
  [0xAC00, 0xD7AF], // Hangul Syllables
  [0xF900, 0xFAFF], // CJK Compatibility Ideographs
]

function isCJK(cp: number): boolean {
  // CJK Symbols & Punctuation (U+3000–U+303F): only dialogue brackets are noise
  if (cp >= 0x3000 && cp <= 0x303F) return DIALOGUE_BRACKETS.has(cp)
  return LEAK_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)
}

const CONTEXT_RADIUS = 35
const MERGE_GAP = 15

export function detectCJK(text: string, label?: string): CJKIncident[] {
  if (!text) return []

  const raw: Array<{ start: number; end: number }> = []
  let i = 0

  while (i < text.length) {
    const cp = text.codePointAt(i) ?? 0
    const stride = cp > 0xffff ? 2 : 1
    if (isCJK(cp)) {
      const start = i
      // Collect contiguous CJK run
      while (i < text.length) {
        const c = text.codePointAt(i) ?? 0
        if (!isCJK(c)) break
        i += c > 0xffff ? 2 : 1
      }
      raw.push({ start, end: i })
    } else {
      i += stride
    }
  }

  if (raw.length === 0) return []

  // Merge nearby runs
  const merged: Array<{ start: number; end: number }> = [raw[0]]
  for (let j = 1; j < raw.length; j++) {
    const prev = merged[merged.length - 1]
    if (raw[j].start - prev.end <= MERGE_GAP) {
      prev.end = raw[j].end
    } else {
      merged.push({ ...raw[j] })
    }
  }

  return merged.map(({ start, end }) => {
    const ctxStart = Math.max(0, start - CONTEXT_RADIUS)
    const ctxEnd = Math.min(text.length, end + CONTEXT_RADIUS)
    return {
      chars: text.slice(start, end),
      context: text.slice(ctxStart, ctxEnd),
      label,
    }
  })
}
