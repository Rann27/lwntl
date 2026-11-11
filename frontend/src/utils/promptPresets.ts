/**
 * Prompt preset helpers shared by the series panel and the profile templates modal.
 * resolvePrompt mirrors core/prompt_builder.resolve_system_prompt so the UI shows
 * the prompt that will actually be sent, before anything is saved.
 */

import type { PromptPreset } from '../types'

const LANG_CODES: [string, string][] = [
  ['japan', 'JP'], ['chin', 'CN'], ['mandarin', 'CN'], ['korea', 'KR'], ['engl', 'EN'], ['indones', 'ID'],
]

export function langCode(language: string): string {
  const lang = (language || '').trim().toLowerCase()
  return LANG_CODES.find(([prefix]) => lang.startsWith(prefix))?.[1] ?? ''
}

export function matchBuiltin(presets: PromptPreset[], source: string, target: string): PromptPreset | undefined {
  const s = langCode(source), t = langCode(target)
  if (!s || !t) return undefined
  return presets.find(p => p.builtin && langCode(p.sourceLanguage) === s && langCode(p.targetLanguage) === t)
}

// Same rule as is_blank_prompt: no letters or digits means "nothing".
const hasMeaning = (t: string) => /[0-9A-Za-z぀-ヿ一-鿿가-힯]/.test(t || '')

export type PromptSource = 'series' | 'series_preset' | 'profile' | 'profile_preset' | 'auto' | 'none'

export interface ResolvedPrompt {
  text: string
  source: PromptSource
  preset?: PromptPreset
}

export function resolvePrompt(o: {
  seriesText: string
  seriesPreset: string
  profileText: string
  profilePreset: string
  seriesInstructions: string
  profileInstructions: string
  sourceLanguage: string
  targetLanguage: string
  presets: PromptPreset[]
}): ResolvedPrompt {
  const byId = (id: string) => (id ? o.presets.find(p => p.id === id && (p.text ?? '').length > 0) : undefined)
  if (o.seriesText.trim()) return { text: o.seriesText, source: 'series' }
  const sp = byId(o.seriesPreset)
  if (sp) return { text: sp.text ?? '', source: 'series_preset', preset: sp }
  if (o.profileText.trim()) return { text: o.profileText, source: 'profile' }
  const pp = byId(o.profilePreset)
  if (pp) return { text: pp.text ?? '', source: 'profile_preset', preset: pp }
  if (!hasMeaning(o.seriesInstructions) && !hasMeaning(o.profileInstructions)) {
    const auto = matchBuiltin(o.presets, o.sourceLanguage, o.targetLanguage)
    if (auto) return { text: auto.text ?? '', source: 'auto', preset: auto }
  }
  return { text: '', source: 'none' }
}

export function presetLabel(p: PromptPreset): string {
  return `${p.builtin ? '🔒' : '✎'} ${p.name}`
}

/** Rough token estimate for a prompt (≈4 chars/token for Latin text, denser for CJK). */
export function approxTokens(text: string): number {
  const cjk = (text.match(/[぀-ヿ一-鿿가-힯]/g) || []).length
  return Math.round(cjk + (text.length - cjk) / 4)
}
