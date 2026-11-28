// Every pack text in one object, and a fingerprint over all of them and the
// blueprints. Any change to a pack or blueprint text changes the fingerprint,
// and the fingerprint is part of every prompt version, so a changed rule can
// never pass unnoticed.
import { BLUEPRINTS } from '../blueprints/index'
import { canonicalJson, sha16 } from '../canonical'
import {
  ANSWER_BALANCE,
  BANNED_OPTIONS,
  DISTRACTOR_LIBRARY,
  EXPLANATION_STANDARDS,
  LETTER_REFERENCE_PATTERNS,
  OPTION_REFERENCES,
  SCENARIO_ENGINEERING,
  STUDIO_QUESTION_STANDARD,
} from './assessment'
import { BODY_NAMES, BODY_NAME_RULE } from './body-names'
import {
  DIFFICULTY_GUIDE,
  FORBIDDEN_PHRASES,
  FORBIDDEN_PHRASE_LIST,
  INSIGHT_DENSITY,
  ORIGINALITY_AND_LEGAL,
  QUALITY_SELF_CHECK,
  TECHNICAL_ACCURACY,
  VOICE,
} from './house-style'
import { ETICPA_LEVELS, ETICPA_MODULES, JURISDICTION_PACKS } from './jurisdictions'
import { LEVEL_PACKS } from './levels'
import { REVIEWER_RULES } from './reviewer'
import { SUBJECT_PACKS } from './subjects'

export const PACKS = {
  houseStyle: {
    VOICE,
    TECHNICAL_ACCURACY,
    ORIGINALITY_AND_LEGAL,
    FORBIDDEN_PHRASES,
    FORBIDDEN_PHRASE_LIST,
    INSIGHT_DENSITY,
    QUALITY_SELF_CHECK,
    DIFFICULTY_GUIDE,
  },
  levels: LEVEL_PACKS,
  subjects: SUBJECT_PACKS,
  jurisdictions: { JURISDICTION_PACKS, ETICPA_MODULES, ETICPA_LEVELS },
  assessment: {
    DISTRACTOR_LIBRARY,
    EXPLANATION_STANDARDS,
    SCENARIO_ENGINEERING,
    STUDIO_QUESTION_STANDARD,
    ANSWER_BALANCE,
    OPTION_REFERENCES,
    LETTER_REFERENCE_PATTERNS: LETTER_REFERENCE_PATTERNS.map(pattern => `/${pattern.source}/${pattern.flags}`),
    BANNED_OPTIONS,
  },
  bodyNames: { BODY_NAMES, BODY_NAME_RULE },
  reviewer: { REVIEWER_RULES },
} as const

/** sha16 over the canonical JSON of every pack text and every blueprint. */
export const PACKS_FINGERPRINT = sha16(canonicalJson({ packs: PACKS, blueprints: BLUEPRINTS }))
