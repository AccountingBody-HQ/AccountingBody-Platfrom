// The seven blueprints and the map from each of the 13 content types to its
// blueprint (and, for the guides, its preset).
import type { Blueprint, BlueprintId, BlueprintPreset, BlueprintSection, ContentType } from '../types'
import { ARTICLE } from './article'
import { EXAM_TECHNIQUE_GUIDE } from './exam-technique-guide'
import { PRACTICE_QUESTION_SET } from './practice-question-set'
import { QUESTION_EXPLAINER } from './question-explainer'
import { STUDY_NOTE } from './study-note'
import { SUBJECT_OVERVIEW } from './subject-overview'
import { TOPIC_GUIDE } from './topic-guide'

export const BLUEPRINTS: Readonly<Record<BlueprintId, Blueprint>> = {
  article: ARTICLE,
  'study-note': STUDY_NOTE,
  'exam-technique-guide': EXAM_TECHNIQUE_GUIDE,
  'practice-question-set': PRACTICE_QUESTION_SET,
  'question-explainer': QUESTION_EXPLAINER,
  'subject-overview': SUBJECT_OVERVIEW,
  'topic-guide': TOPIC_GUIDE,
}

export interface BlueprintChoice {
  blueprint: Blueprint
  /** Set for the seven guide content types. */
  preset?: BlueprintPreset & { contentType: ContentType }
}

/** The blueprint (and preset) for a content type. Every one of the 13 maps. */
export function blueprintFor(contentType: ContentType): BlueprintChoice {
  for (const id of Object.keys(BLUEPRINTS) as BlueprintId[]) {
    const blueprint = BLUEPRINTS[id]
    if (blueprint.contentTypes.indexOf(contentType) < 0) continue
    const preset = blueprint.presets?.[contentType]
    return preset ? { blueprint, preset: { ...preset, contentType } } : { blueprint }
  }
  // Unreachable for a valid ContentType; a test proves every type maps.
  return { blueprint: ARTICLE }
}

/** The sections for a blueprint and preset: a preset's extra sections go before "common-errors". */
export function sectionsFor(choice: BlueprintChoice): BlueprintSection[] {
  const base = choice.blueprint.sections
  const extra = choice.preset?.extraSections ?? []
  if (extra.length === 0) return base.slice()
  const at = base.findIndex(s => s.id === 'common-errors')
  const index = at < 0 ? base.length : at
  return [...base.slice(0, index), ...extra, ...base.slice(index)]
}
