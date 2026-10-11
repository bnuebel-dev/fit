import { BODY_ARTICLES } from './articles-body'
import { PLANNING_ARTICLES } from './articles-planning'
import type { Article, ArticleGroup } from './types'

export { GLOSSARY, glossaryById } from './glossary'
export type { Article, ArticleGroup, Bi, GlossaryEntry, Section } from './types'

export const ARTICLES: Article[] = [...PLANNING_ARTICLES, ...BODY_ARTICLES]
export const GROUP_ORDER: ArticleGroup[] = ['planning', 'training', 'body', 'nutrition']
export const articleById = (id: string): Article | undefined => ARTICLES.find((a) => a.id === id)
