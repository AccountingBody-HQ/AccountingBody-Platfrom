import { describe, expect, it } from 'vitest'
import { parseReviewerNotes } from '@/lib/content-engine'
import { REGISTRY_INVALID } from '@/lib/question-registry'
import { LEVEL_OPTIONS, NO_MODULE_LABEL, WORDING } from './wording'

// The owner's approved texts (D379, D370), copied here character for character.
const APPROVED: Record<string, string> = {
  menuLabel: 'Content Studio',
  menuSub: 'Plan, make and check content',
  pageTitle: 'Content Studio',
  pageIntro: 'Make practice questions from a study note. Every answer is checked before it can be published.',
  tabPlan: 'Plan',
  tabMake: 'Make practice questions',
  planTitle: 'What to make next',
  emptySubjectsTitle: 'Empty mock-exam subjects',
  emptySubjectsHelp: 'These subjects have no practice questions yet. Each needs 50 questions before its mock exam opens.',
  makeQuestions: 'Make questions',
  showMore: 'Show 10 more',
  planFailed: 'Could not read the plan. Please try again.',
  noteBoxTitle: 'Study note',
  noteHelp: "Type the study note's ID (AB-ART-…). The questions are written from this note and linked to it.",
  findNote: 'Find note',
  notFound: 'No published study note has that ID.',
  count10: '10 questions',
  count20: '20 questions (two steps)',
  levelLabel: 'Level',
  levelHelp: 'Sets the depth. It is never named in the questions.',
  validAsAtLabel: 'Valid as at',
  validAsAtHelp: 'Tax rules change. The questions are written as at this date.',
  copyPrompt: 'Copy prompt',
  copyHelp: 'Free. Paste it into any AI (Claude, ChatGPT, Gemini…), then paste the answer below.',
  generateHere: 'Generate here',
  aiFailed: 'The AI did not answer in time. Nothing was saved. Please try again.',
  pasteLabel: "Paste the AI's answer here",
  checkAnswer: 'Check answer',
  ready: 'Ready to publish',
  notReady: 'Not ready: fix the problems below, then check again.',
  notCheckedTitle: 'Not checked',
  secondOpinion: 'Ask for a second opinion',
  checkerNothing: 'The checker found nothing to change.',
  previewTitle: 'Preview',
  correctAnswer: 'Correct answer',
  publish: 'Publish',
}

const NEW: Record<string, string> = {
  validAsAtNeeded: "Please enter the 'Valid as at' date.",
  pasteFirst: "Paste the AI's answer first.",
  notPublishable: 'The answer passed the checks but could not be made ready to publish.',
  reviewNoJson: 'The second opinion has no JSON.',
  reviewBadShape: 'The second opinion is not in the expected shape.',
  noteWhere: 'Where:',
  noteProblem: 'Problem:',
  noteSuggestion: 'Suggestion:',
  copied: 'Copied',
  copyFailed: 'Could not copy. Select the text and copy it.',
  finding: 'Finding…',
  checking: 'Checking…',
  publishing: 'Publishing…',
  somethingWrong: 'Something went wrong. Nothing was saved. Please try again.',
  stepGenerateReview: 'Asking for a second opinion…',
}

const APPROVED_FUNCTIONS = [
  'subjectLine', 'otherTitle', 'eticpaMissing', 'found', 'generateHelp', 'stepProgress', 'score', 'problems',
  'warnings', 'checkerNotes', 'publishTitle', 'published',
]
const NEW_FUNCTIONS = ['questionLabel']

describe('the Content Studio wording', () => {
  it('holds every approved text exactly', () => {
    for (const [key, text] of Object.entries(APPROVED)) expect([key, WORDING[key as keyof typeof WORDING]]).toEqual([key, text])
  })

  it('builds the approved texts with their values', () => {
    expect(WORDING.subjectLine('Tax', 0, 22)).toBe('Tax: 0 of 50 questions · 22 study notes without a set')
    expect(WORDING.otherTitle(1835)).toBe('Other study notes without a practice set (1835)')
    expect(WORDING.eticpaMissing(['Business Skills', 'CPA'])).toBe('ETICPA modules with no study notes yet: Business Skills, CPA. They are made later, with the study notes.')
    expect(WORDING.found('T', 'S', 'Accounting Body')).toBe('Found: T · S · Accounting Body')
    expect(WORDING.generateHelp('$0.42')).toBe('The site asks the AI for you. Estimated cost: up to $0.42.')
    expect(WORDING.stepProgress(1, 2)).toBe('Step 1 of 2: writing questions…')
    expect(WORDING.score(93)).toBe('Quality score: 93/100')
    expect(WORDING.problems(2)).toBe('Problems (2)')
    expect(WORDING.warnings(1)).toBe('Warnings (1)')
    expect(WORDING.checkerNotes(3)).toBe('Checker notes (3)')
    expect(WORDING.publishTitle('T')).toBe('Title: T — Practice Questions')
    expect(WORDING.published('AB-QZ-00183', 20)).toBe('Published: AB-QZ-00183 · 20 questions. It is on both sites.')
    expect(NO_MODULE_LABEL).toBe('Accounting Body')
  })

  it('has the six level options in order', () => {
    expect(LEVEL_OPTIONS.map(o => [o.id, o.label])).toEqual([
      ['acca', 'ACCA level'], ['cima', 'CIMA level'], ['icaew', 'ICAEW level'], ['aat', 'AAT level'],
      ['eticpa-cpa', 'ETICPA CPA'], ['eticpa-atq', 'ETICPA ATQ'],
    ])
    expect(WORDING.levelOptions).toBe(LEVEL_OPTIONS)
  })

  it('holds exactly the new texts, and nothing else', () => {
    for (const [key, text] of Object.entries(NEW)) expect([key, WORDING[key as keyof typeof WORDING]]).toEqual([key, text])
    expect(WORDING.questionLabel(4)).toBe('Question 4')
    const all = [...Object.keys(APPROVED), ...APPROVED_FUNCTIONS, 'levelOptions', ...Object.keys(NEW), ...NEW_FUNCTIONS].sort()
    expect(Object.keys(WORDING).sort()).toEqual(all)
  })

  it('uses the same texts as the engine and the quality record', () => {
    expect(parseReviewerNotes('nothing')).toEqual({ ok: false, message: WORDING.reviewNoJson })
    expect(parseReviewerNotes('{"x": 1}')).toEqual({ ok: false, message: WORDING.reviewBadShape })
    expect(REGISTRY_INVALID).toBe('Nothing was published. The quality record of this set is not valid.')
  })
})
