// Lightweight markdown renderer for AI assistant messages.
// Handles headings, bold, italic, bullet lists, horizontal rules, blockquotes.
import React from 'react'

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <p key={i} className="font-semibold text-[13px] text-ink mt-2.5 mb-0.5 first:mt-0">
          {renderInline(line.slice(4))}
        </p>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <p key={i} className="font-semibold text-[13px] text-ink mt-2.5 mb-0.5 first:mt-0">
          {renderInline(line.slice(3))}
        </p>
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <p key={i} className="font-semibold text-[13px] text-ink mt-2.5 mb-0.5 first:mt-0">
          {renderInline(line.slice(2))}
        </p>
      )

    // Horizontal rule
    } else if (line === '---' || line === '***' || line === '___') {
      elements.push(<hr key={i} className="border-t border-line my-2" />)

    // Blockquote
    } else if (line.startsWith('> ')) {
      elements.push(
        <p key={i} className="pl-3 border-l-2 border-line text-ink2 text-[13px] italic">
          {renderInline(line.slice(2))}
        </p>
      )

    // Bullet list — collect consecutive items
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="pl-4 space-y-0.5 list-none">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-[13px] leading-relaxed">
              <span className="text-muted shrink-0 mt-[3px]">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue

    // Empty line — small gap
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)

    // Normal paragraph
    } else {
      elements.push(
        <p key={i} className="text-[13px] leading-relaxed">
          {renderInline(line)}
        </p>
      )
    }

    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}
