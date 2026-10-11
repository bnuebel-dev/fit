import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ARTICLES, GLOSSARY, GROUP_ORDER, articleById } from '../content'
import { RichText } from '../components/RichText'
import { useLang } from '../lib/hooks'

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
const strip = (s: string) => s.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')

function Back({ to, title }: { to: string; title: string }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => nav(to)} aria-label={t('common.back')}>←</button>
      <h1 className="min-w-0 flex-1 text-xl font-bold">{title}</h1>
    </div>
  )
}

export function Knowledge() {
  const { t } = useTranslation()
  const lang = useLang()
  const [query, setQuery] = useState('')

  const hits = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (!words.length) return ARTICLES
    return ARTICLES.filter((a) => {
      const hay = fold([a.title[lang], a.summary[lang], ...a.sections.flatMap((s) => [s.h[lang], ...s.body[lang].map(strip)])].join(' '))
      return words.every((w) => hay.includes(w))
    })
  }, [query, lang])

  return (
    <div className="flex flex-col gap-4">
      <Back to="/more" title={t('knowledge.title')} />
      <input className="field" type="search" placeholder={t('knowledge.search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('knowledge.search')} />

      <Link to="/more/knowledge/glossary" className="card flex items-center gap-3 p-4">
        <span className="text-2xl" aria-hidden>📖</span>
        <span className="flex-1"><span className="block font-medium">{t('knowledge.glossary')}</span><span className="text-xs text-muted">{t('knowledge.glossaryHint')} · {GLOSSARY.length} {t('knowledge.terms')}</span></span>
        <span className="text-muted" aria-hidden>›</span>
      </Link>

      {hits.length === 0 && <p className="text-muted">{t('knowledge.empty')}</p>}
      {GROUP_ORDER.map((g) => {
        const list = hits.filter((a) => a.group === g)
        if (!list.length) return null
        return (
          <section key={g} className="flex flex-col gap-2" aria-label={t(`knowledge.groups.${g}`)}>
            <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">{t(`knowledge.groups.${g}`)}</h2>
            <ul className="flex flex-col gap-2">
              {list.map((a) => (
                <li key={a.id}>
                  <Link to={`/more/knowledge/${a.id}`} className="card flex items-start gap-3 p-4">
                    <span className="text-2xl" aria-hidden>{a.icon}</span>
                    <span className="min-w-0 flex-1"><span className="block font-medium">{a.title[lang]}</span><span className="text-sm text-muted">{a.summary[lang]}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function ArticleView() {
  const { t } = useTranslation()
  const lang = useLang()
  const { id = '' } = useParams()
  const a = articleById(id)
  if (!a) return <div className="flex flex-col gap-4"><Back to="/more/knowledge" title={t('knowledge.title')} /><p className="text-muted">{t('knowledge.notFound')}</p></div>
  return (
    <article className="flex flex-col gap-5">
      <Back to="/more/knowledge" title={a.title[lang]} />
      <p className="text-muted">{a.summary[lang]}</p>
      {a.sections.map((s, i) => (
        <section key={i} className="flex flex-col gap-2" aria-label={s.h[lang]}>
          <h2 className="text-lg font-semibold">{s.h[lang]}</h2>
          <RichText lines={s.body[lang]} />
        </section>
      ))}
      {a.tool && <Link to={a.tool.to} className="btn btn-primary">{t('knowledge.tool')}: {a.tool.label[lang]}</Link>}
      <p className="text-xs text-muted">{t('knowledge.source')}</p>
    </article>
  )
}

export function GlossaryView() {
  const { t } = useTranslation()
  const lang = useLang()
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    return [...GLOSSARY]
      .filter((g) => words.every((w) => fold(`${g.term[lang]} ${g.text[lang]}`).includes(w)))
      .sort((a, b) => a.term[lang].localeCompare(b.term[lang], lang))
  }, [query, lang])
  return (
    <div className="flex flex-col gap-4">
      <Back to="/more/knowledge" title={t('knowledge.glossary')} />
      <input className="field" type="search" placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('common.search')} />
      {list.length === 0 && <p className="text-muted">{t('knowledge.empty')}</p>}
      <dl className="flex flex-col gap-2">
        {list.map((g) => (
          <div key={g.id} className="card p-3">
            <dt className="font-semibold">{g.term[lang]}</dt>
            <dd className="mt-1 text-sm text-muted">{g.text[lang]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
