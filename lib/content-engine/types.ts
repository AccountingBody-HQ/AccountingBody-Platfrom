// Shared types for the content engine. Lists of allowed values are kept as
// constant arrays so the types and the run-time checks come from one place.

export const CONTENT_TYPES = [
  'article',
  'study-note',
  'exam-technique-guide',
  'practice-question-set',
  'question-explainer',
  'subject-overview',
  'accounting-guide',
  'management-accounting-guide',
  'tax-guide',
  'audit-assurance-guide',
  'financial-management-guide',
  'ethics-professional-standards-guide',
  'business-law-regulation-guide',
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const BLUEPRINT_IDS = [
  'article',
  'study-note',
  'exam-technique-guide',
  'practice-question-set',
  'question-explainer',
  'subject-overview',
  'topic-guide',
] as const
export type BlueprintId = (typeof BLUEPRINT_IDS)[number]

export const LEVEL_IDS = ['acca', 'cima', 'icaew', 'aat', 'eticpa-cpa', 'eticpa-atq'] as const
export type LevelId = (typeof LEVEL_IDS)[number]

export const SUBJECT_KEYS = [
  'financial-accounting',
  'financial-management',
  'management-accounting',
  'financial-market',
  'business-management',
  'audit-assurance',
  'taxation',
  'economics',
  'ethics-professional-standards',
  'business-law-regulation',
  'general',
] as const
export type SubjectKey = (typeof SUBJECT_KEYS)[number]

export const JURISDICTIONS = ['uk-ifrs', 'ethiopia'] as const
export type Jurisdiction = (typeof JURISDICTIONS)[number]

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

// ── Blocks ───────────────────────────────────────────────────────────────────

export const BLOCK_TYPES = [
  'heading',
  'paragraph',
  'definition',
  'worked_example',
  'calculation',
  'journal_entry',
  'table',
  'key_point',
  'common_mistake',
  'exam_tip',
  'check_understanding',
  'takeaway',
  'list',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export interface HeadingBlock { type: 'heading'; level: 2 | 3; text: string }
export interface ParagraphBlock { type: 'paragraph'; text: string }
export interface DefinitionBlock { type: 'definition'; term: string; text: string }
export interface WorkedExampleBlock { type: 'worked_example'; title: string; scenario: string; steps: string[]; answer: string }
export interface CalculationStep { label: string; working: string; result: string }
export interface CalculationBlock { type: 'calculation'; title: string; steps: CalculationStep[] }
export interface JournalLine { account: string; debit: number | null; credit: number | null }
export interface JournalEntryBlock { type: 'journal_entry'; title: string; narrative?: string; lines: JournalLine[] }
export interface TableBlock { type: 'table'; caption: string; columns: string[]; rows: string[][] }
export interface KeyPointBlock { type: 'key_point'; text: string }
export interface CommonMistakeBlock { type: 'common_mistake'; mistake: string; correction: string }
export interface ExamTipBlock { type: 'exam_tip'; text: string }
export interface CheckUnderstandingBlock { type: 'check_understanding'; question: string; answer: string }
export interface TakeawayBlock { type: 'takeaway'; points: string[] }
export interface ListBlock { type: 'list'; style: 'bullet' | 'number'; items: string[] }

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | DefinitionBlock
  | WorkedExampleBlock
  | CalculationBlock
  | JournalEntryBlock
  | TableBlock
  | KeyPointBlock
  | CommonMistakeBlock
  | ExamTipBlock
  | CheckUnderstandingBlock
  | TakeawayBlock
  | ListBlock

// ── Findings ─────────────────────────────────────────────────────────────────

/** Every check, in the order the scorecard lists them. */
export const CHECK_ORDER = [
  'brief.fields',
  'parse.json',
  'parse.cleaned',
  'envelope.engine',
  'envelope.prompt',
  'envelope.blueprint',
  'envelope.fields',
  'structure.sections',
  'blocks.shape',
  'blocks.markup',
  'blocks.journal',
  'blocks.required',
  'words.section',
  'words.total',
  'links.internal',
  'body.names',
  'tax.validAsAt',
  'dup.title',
  'coverage.source',
  'style.forbidden',
  'q.count',
  'q.shape',
  'q.options',
  'q.banned',
  'q.answer',
  'q.balance',
  'q.letterRefs',
  'q.explanation',
  'q.dupStem',
  'q.source',
] as const
export type CheckId = (typeof CHECK_ORDER)[number]

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  check: CheckId
  severity: Severity
  message: string
  path?: string
}

// ── Brief ────────────────────────────────────────────────────────────────────

export interface BriefSource { contentId: string; title: string; slug: string; html: string }
export interface RelatedNote { title: string; slug: string; path: string }
export interface BriefQuestion { questionText: string; options: string[]; correctIndex: number; explanation: string }

export interface Brief {
  contentType: ContentType
  topic: string
  level: LevelId
  subject: SubjectKey
  jurisdiction: Jurisdiction
  difficulty?: Difficulty
  eticpa?: { level: string; module: string }
  source?: BriefSource
  relatedNotes?: RelatedNote[]
  avoidTitles?: string[]
  /** YYYY-MM-DD; required when the subject is taxation or the content type is tax-guide. */
  validAsAt?: string
  /** practice-question-set only: 10-25, default 20. */
  questionCount?: number
  /** question-explainer only. */
  question?: BriefQuestion
}

// ── Source note ──────────────────────────────────────────────────────────────

export interface SourceSection { id: string; heading: string; text: string; words: number }
export interface SourceNote { title: string; sections: SourceSection[]; words: number }

// ── Blueprints ───────────────────────────────────────────────────────────────

export type BlueprintOutput = 'document' | 'questionSet' | 'explainer'

export interface BlueprintSection {
  id: string
  title: string
  purpose: string
  minWords: number
  maxWords: number
  requiredBlockTypes: BlockType[]
  optional: boolean
}

export interface BlueprintPreset {
  subject: SubjectKey
  emphasis: string
  extraSections?: BlueprintSection[]
}

export interface Blueprint {
  id: BlueprintId
  version: '1.0.0'
  contentTypes: ContentType[]
  purpose: string
  output: BlueprintOutput
  sections: BlueprintSection[]
  totalWords: { min: number; max: number }
  presets?: Partial<Record<ContentType, BlueprintPreset>>
  rules: string[]
}

// ── Compiled prompt ──────────────────────────────────────────────────────────

export interface CompiledPrompt {
  promptId: string
  promptVersion: string
  blueprintId: BlueprintId
  preset?: ContentType
  brief: Brief
  source: SourceNote | null
  text: string
  expected: { sectionIds: string[]; questionCount?: number }
}

export interface CompileFailure { findings: Finding[] }

// ── Engine output (the one JSON contract) ────────────────────────────────────

export interface Question {
  id: string
  type: 'multiple-choice'
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
  writingModelAnswer: null
  writingExplanation: null
  caseId: null
  primaryTopic: string
  difficulty: Difficulty
  timeTargetMinutes: number
  points: number
  sourceSection: string
}

export interface DocumentSection { id: string; blocks: Block[] }

export interface EngineOutputBase {
  engine: 'ab-content-engine'
  promptId: string
  promptVersion: string
  blueprint: BlueprintId
  contentType: ContentType
  title: string
  summary: string
  keyTerms: string[]
  validAsAt: string | null
  sourceSectionsCovered: string[]
}

export interface DocumentOutput extends EngineOutputBase { document: { sections: DocumentSection[] } }
export interface QuestionSetOutput extends EngineOutputBase { questionSet: { questions: Question[] } }
export interface ExplainerOutput extends EngineOutputBase { explainer: { blocks: Block[] } }

export type EngineOutput = DocumentOutput | QuestionSetOutput | ExplainerOutput

// ── Scorecard ────────────────────────────────────────────────────────────────

export interface Scorecard {
  ok: boolean
  score: number
  findings: Finding[]
  output: EngineOutput | null
  stats: { words: number; sections: number; questions: number; blocks: number }
  notChecked: string[]
}
