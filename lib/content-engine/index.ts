// The content engine's public API. Re-exports only: E2 (the Content Studio)
// calls compilePrompt, then runGate on the answer, then renderBlocks.
export { ENGINE_NAME, ENGINE_VERSION } from './version'
export {
  BLOCK_TYPES,
  BLUEPRINT_IDS,
  CHECK_ORDER,
  CONTENT_TYPES,
  DIFFICULTIES,
  JURISDICTIONS,
  LEVEL_IDS,
  SUBJECT_KEYS,
} from './types'
export type {
  Block,
  BlockType,
  Blueprint,
  BlueprintId,
  BlueprintSection,
  Brief,
  CheckId,
  CompileFailure,
  CompiledPrompt,
  ContentType,
  Difficulty,
  EngineOutput,
  Finding,
  Jurisdiction,
  LevelId,
  Question,
  Scorecard,
  SourceNote,
  SubjectKey,
} from './types'
export { PACKS, PACKS_FINGERPRINT } from './packs/index'
export { subjectContext, toSubjectKey } from './packs/subjects'
export { ETICPA_LEVELS, ETICPA_MODULES } from './packs/jurisdictions'
export { BODY_NAMES, BODY_NAME_RULE } from './packs/body-names'
export { blocksToText, countWords, validateBlocks } from './blocks'
export { renderBlocks } from './render'
export { sourceFromHtml } from './source'
export { BLUEPRINTS, blueprintFor } from './blueprints/index'
export { validateBrief } from './brief'
export { compilePrompt, compileReviewerPrompt, isCompiled } from './compiler'
export { extractJson } from './parse'
export { runGate } from './gate'
export { STEP_SIZE, earlierQuestionsOf, mergeStepAnswers, planSteps, stepPromptText } from './steps'
export type { EarlierQuestion, StepPlan } from './steps'
export { parseReviewerNotes } from './reviewer-notes'
export type { ReviewerNote } from './reviewer-notes'
