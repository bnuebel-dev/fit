import { Fragment, useState, type ReactNode } from 'react'
import { glossaryById } from '../content'
import { useLang } from '../lib/hooks'
import { Sheet } from './Sheet'

const TERM = /\[\[([^|\]]+)\|([^\]]+)\]\]/g

/** Ein Begriff aus dem Glossar, antippbar mit kurzer Erklärung. */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const entry = glossaryById(id)
  if (!entry) return <>{children}</>
  return (
    <>
      <button type="button" className="rounded-sm border-b border-dotted border-accent text-accent" onClick={() => setOpen(true)} aria-haspopup="dialog">{children}</button>
      {open && (
        <Sheet title={entry.term[lang]} onClose={() => setOpen(false)}>
          <p className="pb-4 leading-relaxed">{entry.text[lang]}</p>
        </Sheet>
      )}
    </>
  )
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TERM)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    out.push(<Term key={`${m.index}-${m[1]}`} id={m[1]}>{m[2]}</Term>)
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.map((n, i) => <Fragment key={i}>{n}</Fragment>)
}

/** Rendert Absätze, Listen ("- ") und Hinweise ("! ") nach den Konventionen in content/types.ts. */
export function RichText({ lines }: { lines: string[] }) {
  const blocks: ReactNode[] = []
  let items: string[] = []
  const flush = (key: number) => {
    if (!items.length) return
    blocks.push(<ul key={`ul-${key}`} className="flex list-disc flex-col gap-1.5 pl-5">{items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>)
    items = []
  }
  lines.forEach((line, i) => {
    if (line.startsWith('- ')) { items.push(line.slice(2)); return }
    flush(i)
    if (line.startsWith('! ')) blocks.push(<p key={i} className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">{inline(line.slice(2))}</p>)
    else blocks.push(<p key={i} className="leading-relaxed">{inline(line)}</p>)
  })
  flush(lines.length)
  return <div className="flex flex-col gap-3 text-[0.95rem]">{blocks}</div>
}
