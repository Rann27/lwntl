import type { Page } from '@playwright/test'

export const defaultConfig = {
  "provider": "zhipuai",
  "model": "glm-5.3",
  "workers": [
    {
      "id": "default",
      "label": "worker 1",
      "provider": "zhipuai",
      "model": "glm-5.3",
      "maxConcurrent": 1
    }
  ],
  "customModels": {},
  "zhipuaiApiKey": "",
  "zhipuaiThinking": true,
  "zhipuaiReasoningEffort": "default",
  "qwenApiKey": "",
  "qwenThinking": true,
  "openaiApiKey": "",
  "openaiReasoningEffort": "default",
  "geminiApiKey": "",
  "geminiSafetyFilter": true,
  "geminiReasoningEffort": "default",
  "anthropicApiKey": "",
  "anthropicEffort": "default",
  "xaiApiKey": "",
  "xaiReasoningEffort": "high",
  "moonshotApiKey": "",
  "moonshotRegion": "international",
  "moonshotReasoningEffort": "default",
  "moonshotThinking": true,
  "openrouterApiKey": "",
  "openrouterReasoning": "default",
  "openrouterSort": "",
  "openrouterDenyDataCollection": false,
  "deepseekApiKey": "",
  "deepseekApiKeys": [],
  "deepseekThinking": false,
  "deepseekReasoningEffort": "high",
  "mimoApiKey": "",
  "mimoThinking": true,
  "mimoReasoningEffort": "medium",
  "chatgptAccount": "",
  "chatgptReasoningEffort": "default",
  "experientialApiKey": "",
  "uncensoredllmApiKey": "",
  "openaicompatApiKey": "",
  "openaicompatBaseUrl": "",
  "openaicompatUserAgent": "lwntl/1.0 (+openai-compatible)",
  "openaicompatClientName": "lwntl",
  "openaicompatExtraHeaders": {},
  "temperature": 0.3,
  "maxTokensPerIteration": 16000,
  "maxContextTokens": 128000,
  "glossaryPreFilter": true,
  "theme": "light",
  "uiLanguage": "id",
  "sourceLanguages": [
    "Japanese",
    "Chinese",
    "Korean",
    "English",
    "Indonesian"
  ],
  "targetLanguages": [
    "Indonesian",
    "English"
  ]
}

export async function installMockApi(page: Page, theme = 'light', empty = false) {
  await page.addInitScript(({ defaults, theme, empty }) => {
    const config = { ...defaults, theme, uiLanguage: 'id', provider: 'openai', model: 'gpt-4.1', openaiApiKey: 'fixture-key', workers: [{ id: 'default', label: 'Worker 1', provider: 'openai', model: 'gpt-4.1', maxConcurrent: 1 }] }
    const series = empty ? [] : ['The Apothecary Diaries', 'Lord of the Mysteries', 'Omniscient Reader’s Viewpoint'].map((title, i) => ({ id: 'series-' + (i + 1), title, sourceLanguage: ['Japanese', 'Chinese', 'Korean'][i], targetLanguage: 'Indonesian', groupId: null, workerId: 'default', iterationLock: true, autoFixCjk: false, imageFolder: '', revisionPass: false, lookupEnabled: false, lookupChapters: 1, systemPrompt: '', instructions: '', glossary: [], memory: [], createdAt: '2026-11-01', updatedAt: '2026-11-12' }))
    const chapters = Array.from({ length: 6 }, (_, i) => ({ id: 'chapter-' + (i + 1), seriesId: 'series-1', chapterNumber: String(i + 1), title: ['A quiet morning', 'An unexpected visitor', 'The garden pavilion', 'A letter from home', 'Between the lines', 'The next journey'][i], rawContent: '朝の光が窓から差し込んでいた。\n\n彼女は机の上に置かれた手紙をゆっくりと開いた。\n\n静かな一日が始まろうとしていた。', translatedContent: i < 4 ? 'Cahaya pagi menyusup melalui jendela.\n\nIa perlahan membuka surat yang tergeletak di atas meja.\n\nHari yang tenang baru saja dimulai.' : '', summary: 'A quiet morning and a letter.', status: i < 4 ? 'done' : 'pending', glossaryUpdates: null, translationLog: null, translationHistory: [], createdAt: '2026-11-01T00:00:00', updatedAt: '2026-11-12T00:00:00' }))
    const glossary = [{ id: 'term-1', sourceTerm: '薬屋', translatedTerm: 'Apoteker', notes: 'Profesi', aliases: [], updatedAt: '2026-11-12' }]
    const groups = empty ? [] : [{ id: 'group-1', name: 'Bacaan Jepang', parentId: null, color: 'var(--fg-cyan)', createdAt: '2026-11-01', updatedAt: '2026-11-12' }]
    const presets = [{ id: 'builtin:JP-ID', name: 'Japanese → Indonesian', builtin: true, sourceLanguage: 'Japanese', targetLanguage: 'Indonesian', text: 'Translate {title} from {source_language} to {target_language}.', tokenEstimate: 20 }]
    const calls: Array<{ method: string; args: unknown[] }> = []
    const context = { totalTokens: 2400, availableTokens: 112000, maxTokens: 128000, fits: true, utilization: 2, breakdown: { system: 1000, rolling: 400, memory: 0, current: 1000, reserved: 16000 }, summariesAvailable: 3, memoriesAvailable: 0 }
    const api = new Proxy({}, { get: (_, key: string) => async (...args: unknown[]) => {
      calls.push({ method: key, args })
      switch (key) {
        case 'get_config': return structuredClone(config)
        case 'save_config': Object.assign(config, args[0]); return true
        case 'get_profiles': return { active: 'Default', profiles: ['Default', 'Personal'] }
        case 'get_all_series': return structuredClone(series)
        case 'get_series': return structuredClone(series.find(s => s.id === args[0]))
        case 'get_groups': return structuredClone(groups)
        case 'get_chapters': return structuredClone(chapters)
        case 'get_chapter': return structuredClone(chapters.find(c => c.id === args[1]) || chapters[0])
        case 'update_chapter': { const chapter = chapters.find(c => c.id === args[1]); if (chapter) Object.assign(chapter, { rawContent: String(args[4]) }); return structuredClone(chapter) }
        case 'get_glossary': return structuredClone(glossary)
        case 'get_context_info': return context
        case 'get_worker_statuses': return config.workers.map(w => ({ ...w, modelDisplay: w.model, active: false, maxConcurrent: 1, assignedSeriesIds: ['series-1'] }))
        case 'get_worker_logs': case 'get_series_logs': return { lines: [] }
        case 'get_profile_templates': return { systemPromptTemplate: '', systemPromptPreset: '', instructionsTemplate: '', revisionPromptTemplate: '', autofixPromptTemplate: '', prepassPromptTemplate: '' }
        case 'get_default_task_prompts': return { revision: { en: 'Revise the draft.', id: 'Revisi draf.' }, autofix: { en: 'Fix CJK characters.', id: 'Perbaiki karakter CJK.' }, prepass: { en: 'Extract terms.', id: 'Ekstrak istilah.' } }
        case 'list_prompt_presets': return structuredClone(presets)
        case 'list_provider_models': return { models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }], source: 'static', fetchedAt: null, error: '' }
        case 'chatgpt_status': return { connected: false, login: { status: 'idle' } }
        case 'describe_request_params': return { extra: {}, temperature: true, notes: [] }
        case 'get_chapter_assets': return {}
        case 'list_agent_backups': return []
        case 'get_series_delete_info': case 'get_chapter_delete_info': return { chapters: 6, done: 4, versions: 0 }
        case 'create_series': { const added = { ...series[0], id: 'new-series', title: args[0], sourceLanguage: args[1], targetLanguage: args[2], groupId: args[3] || null }; series.push(added); return structuredClone(added) }
        case 'create_group': { const added = { ...groups[0], id: 'new-group', name: args[0], parentId: args[1], color: args[2] }; groups.push(added); return structuredClone(added) }
        case 'qa_scan_series': return { chapters: [], findings: [], chapterCount: 4, stats: { high: 0, medium: 0, low: 0 }, totals: { high: 0, medium: 0, low: 0, byType: {} }, volume: { nameVariants: [], quoteStyle: { majority: 'curly', deviating: [] }, openers: { average: 0, outliers: [] }, length: { median: 30, outliers: [] }, diction: [], frequency: { words: [], bigrams: [], trigrams: [] }, glossary: [] } }
        case 'glossary_audit': return { groups: [], conflicts: [], stats: {} }
        case 'unify_term_variants': return { canonical: args[2], replaced: 3, chapters: 1 }
        case 'accept_term_variants': { const s = series.find(x => x.id === args[0]) as any; s.termVariantsAccepted = { ...(s.termVariantsAccepted || {}), [String(args[1]).toLowerCase()]: (args[2] as string[]).map(r => r.toLowerCase()) }; return { accepted: s.termVariantsAccepted } }
        case 'mark_chapters_raw_done': { const ids = args[1] as string[]; for (const c of chapters) if (ids.includes(c.id)) Object.assign(c, { status: 'done', translatedContent: c.rawContent }); return { error: false, done: ids, failed: [] } }
        case 'list_doc_templates': return { templates: [{"id":"builtin:classic","name":"Classic","description":"Template bawaan LWNTL sejak awal: A4, Noto Sans, judul bab Constantia di tengah.","builtin":true,"fileName":"classic.docx","info":{"page":{"name":"A4","widthCm":21.0,"heightCm":29.7,"landscape":false},"margins":{"top":2.54,"bottom":2.54,"left":2.54,"right":2.54},"body":{"font":"Noto Sans","sizePt":13.0,"bold":false,"italic":false,"color":"#000000","align":"justify","lineSpacing":{"kind":"multiple","value":1.16},"spaceBeforePt":6.0,"spaceAfterPt":18.0,"firstLineIndentCm":0.0},"heading":{"font":"Constantia","sizePt":20.0,"bold":true,"italic":false,"color":"#000000","align":"center","lineSpacing":{"kind":"multiple","value":1.16},"spaceBeforePt":12.0,"spaceAfterPt":24.0,"firstLineIndentCm":0.0},"subheading":{"font":"Calibri Light","sizePt":16.0,"bold":false,"italic":false,"color":"#2F5496","align":"justify","lineSpacing":{"kind":"multiple","value":1.16},"spaceBeforePt":8.0,"spaceAfterPt":4.0,"firstLineIndentCm":0.0},"missingStyles":[],"hasHeader":false,"hasFooter":false,"sections":1,"bodyBlocks":0},"error":""},{"id":"builtin:novel-a5","name":"Novel A5","description":"Halaman buku A5: Georgia, indentasi baris pertama tanpa jarak antarparagraf, nomor halaman.","builtin":true,"fileName":"novel-a5.docx","info":{"page":{"name":"A5","widthCm":14.8,"heightCm":21.0,"landscape":false},"margins":{"top":2.0,"bottom":2.0,"left":1.9,"right":1.9},"body":{"font":"Georgia","sizePt":11.0,"bold":false,"italic":false,"color":"","align":"justify","lineSpacing":{"kind":"multiple","value":1.3},"spaceBeforePt":0.0,"spaceAfterPt":0.0,"firstLineIndentCm":0.6},"heading":{"font":"Georgia","sizePt":17.0,"bold":true,"italic":false,"color":"#1A1A1A","align":"center","lineSpacing":{"kind":"multiple","value":1.3},"spaceBeforePt":48.0,"spaceAfterPt":24.0,"firstLineIndentCm":0.0},"subheading":{"font":"Georgia","sizePt":13.0,"bold":true,"italic":false,"color":"#1A1A1A","align":"justify","lineSpacing":{"kind":"multiple","value":1.3},"spaceBeforePt":12.0,"spaceAfterPt":6.0,"firstLineIndentCm":0.0},"missingStyles":[],"hasHeader":false,"hasFooter":true,"sections":1,"bodyBlocks":0},"error":""}], defaultId: 'builtin:classic' }
        case 'set_series_doc_template': { const s = series.find(x => x.id === args[0]); if (s) Object.assign(s, { docTemplate: args[1] }); return structuredClone(s) }
        case 'preview_doc_template': return { error: false, path: 'C:/tmp/sample.docx', chapters: 2 }
        default: return true
      }
    } })
    Object.assign(window, { pywebview: { api }, __uiFixture: { config, series, chapters, calls } })
  }, { defaults: defaultConfig, theme, empty })
}
