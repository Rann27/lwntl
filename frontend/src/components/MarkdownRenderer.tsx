/**
 * LWNTL Markdown Renderer
 * Renders translated content using react-markdown + remark-gfm
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p style={{ color: '#999', fontSize: '14px', textAlign: 'center' }}>
          Belum ada terjemahan
        </p>
      </div>
    )
  }

  return (
    <div className="markdown-body" style={{ padding: '16px', fontSize: '14px', lineHeight: '1.7' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Render *** / --- / ___ as literal "***" text instead of <hr>
          hr: () => (
            <span style={{ display: 'block', textAlign: 'center', margin: '8px 0', letterSpacing: '4px', color: '#999' }}>
              ***
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}