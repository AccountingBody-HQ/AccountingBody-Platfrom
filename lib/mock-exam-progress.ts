// lib/mock-exam-progress.ts — the mock exam's on-device progress
// (components/course/MockExamClient.tsx): resume an unfinished attempt,
// flags, the result kept for "Your last result on this device", and the
// exact visible wording. Pure; storage goes through lib/practice-store.ts.

import { secondsLeftAt } from './mock-exam-timer'
import {
  formatLastResultDate, mockAttemptKey, mockExamId, readAttempt, topicScores,
  type HistoryItem, type MockAttempt, type StorageLike, type StoredQuestion,
} from './practice-store'

export const CONTINUE_TEXT = 'Continue my attempt'
export const START_NEW_TEXT = 'Start a new attempt'
export const FLAG_TEXT = 'Flag for review'
export const FLAGGED_TEXT = 'Flagged'
export const TOPIC_HEADING = 'Your score by topic'
export const NOT_SAVING_TEXT = 'This device is not saving your progress. You can still finish this exam.'

/** "You have an unfinished attempt on this device with {m} min {s} s left." */
export function unfinishedAttemptLine(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft))
  return `You have an unfinished attempt on this device with ${Math.floor(s / 60)} min ${s % 60} s left.`
}

/** "Your last result on this device: {score} of {total} ({pct}%) on {d MMMM yyyy}." */
export function lastResultLine(item: Pick<HistoryItem, 'score' | 'total' | 'pct' | 'at'>, timeZone?: string): string {
  return `Your last result on this device: ${item.score} of ${item.total} (${item.pct}%) on ${formatLastResultDate(item.at, timeZone)}.`
}

/** "You flagged {n} question{s} for review." */
export function flaggedLine(n: number): string {
  return `You flagged ${n} question${n === 1 ? '' : 's'} for review.`
}

/** The flags with question `i` switched on or off, sorted, each once. */
export function toggleFlag(flags: readonly number[], i: number): number[] {
  const set = new Set(flags)
  if (set.has(i)) set.delete(i)
  else set.add(i)
  return Array.from(set).sort((a, b) => a - b)
}

export interface ResumeState {
  questions: StoredQuestion[]
  answers: Record<number, number>
  flags: number[]
  current: number
  endAt: number
  secondsLeft: number
}

/**
 * The saved attempt of this exam, ready to continue at `now` with its saved
 * end time (time away counts), or null. A broken or expired one is removed.
 */
export function resumeAttempt(storage: StorageLike, level: string, module: string, now: number): ResumeState | null {
  const a = readAttempt(storage, mockAttemptKey(level, module), now)
  if (!a) return null
  return { questions: a.questions, answers: a.answers, flags: a.flags, current: a.current, endAt: a.endAt, secondsLeft: secondsLeftAt(a.endAt, now) }
}

/** The attempt as it is saved after each answer, flag and move. */
export function attemptRecord(endAt: number, questions: StoredQuestion[], answers: Record<number, number>, flags: number[], current: number): MockAttempt {
  return { v: 1, endAt, questions, answers, flags, current }
}

/** The history item for a finished exam: score, %, time and score by topic. */
export function resultHistoryItem(level: string, module: string, questions: { topic: string; correctIndex: number }[], answers: Record<number, number>, now: number): HistoryItem {
  const total = questions.length
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0)
  return {
    exam: mockExamId(level, module),
    score,
    total,
    pct: total ? Math.round((score / total) * 100) : 0,
    at: now,
    topics: topicScores(questions, answers),
  }
}
