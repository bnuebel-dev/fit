export interface Bi<T> {
  de: T
  en: T
}

/**
 * Textkonventionen in `body`:
 *  - "- Text"   → Listenpunkt (aufeinanderfolgende werden zu einer Liste)
 *  - "! Text"   → Hinweiskasten
 *  - sonst      → Absatz
 *  - `[[id|Text]]` → Begriff mit Erklärung aus dem Glossar
 */
export interface Section {
  h: Bi<string>
  body: Bi<string[]>
}

export type ArticleGroup = 'planning' | 'training' | 'body' | 'nutrition'

export interface Article {
  id: string
  group: ArticleGroup
  icon: string
  title: Bi<string>
  summary: Bi<string>
  sections: Section[]
  /** passendes Werkzeug in der App */
  tool?: { to: string; label: Bi<string> }
}

export interface GlossaryEntry {
  id: string
  term: Bi<string>
  text: Bi<string>
}
