import { describe, expect, it } from 'vitest'
import {
  OUTSIDE_OUR_DATABASE,
  PD_SOURCES,
  containsEmail,
  exactLikePattern,
  normaliseEmail,
  redactRow,
  sameEmail,
} from './personal-data'
import { FORM_TABLES } from './recycle-bin'

describe('normaliseEmail', () => {
  it('trims and lower-cases one sane address', () => {
    expect(normaliseEmail('  Person@Example.COM ')).toBe('person@example.com')
    expect(normaliseEmail("o'neil+jobs@mail.example.co.uk")).toBe("o'neil+jobs@mail.example.co.uk")
    expect(normaliseEmail('a_b%c@example.com')).toBe('a_b%c@example.com')
  })

  it.each([
    undefined, null, 42, '', '   ', 'person', 'person@', '@example.com', 'person@example', 'two words@example.com',
    'a@b@example.com', 'person*@example.com', 'per\\son@example.com', 'person@exa_mple.com', 'person@-example.com',
    'a,b@example.com', `${'a'.repeat(250)}@example.com`,
  ])('refuses %j', (input) => {
    expect(normaliseEmail(input)).toBeNull()
  })
})

describe('exactLikePattern', () => {
  it('escapes \\ % and _ so they match only themselves', () => {
    expect(exactLikePattern('a_b%c\\d@example.com')).toBe('a\\_b\\%c\\\\d@example.com')
    expect(exactLikePattern('plain.name@example.com')).toBe('plain.name@example.com')
  })
})

describe('matching', () => {
  it('sameEmail is exact and case-insensitive', () => {
    expect(sameEmail('Person@Example.com', 'person@example.com')).toBe(true)
    expect(sameEmail('person@example.com.au', 'person@example.com')).toBe(false)
    expect(sameEmail('xperson@example.com', 'person@example.com')).toBe(false)
    expect(sameEmail(' person@example.com', 'person@example.com')).toBe(false)
    expect(sameEmail(null, 'person@example.com')).toBe(false)
  })

  it('containsEmail walks objects and arrays for an equal string', () => {
    const email = 'person@example.com'
    expect(containsEmail({ help_requests: [{ id: 1, email: 'PERSON@example.com' }] }, email)).toBe(true)
    expect(containsEmail({ a: { b: [{ c: ['x', 'person@example.com'] }] } }, email)).toBe(true)
    expect(containsEmail({ help_requests: [{ id: 1, email: 'other@example.com', message: 'write to person@example.com' }] }, email)).toBe(false)
    expect(containsEmail(null, email)).toBe(false)
  })

  it('redactRow replaces working keys only', () => {
    expect(redactRow({ id: 'x', email: 'person@example.com', update_token: 'abc', confirmation_token: null, status: 'new' })).toEqual({
      id: 'x', email: 'person@example.com', update_token: '[removed]', confirmation_token: null, status: 'new',
    })
  })
})

describe('PD_SOURCES', () => {
  it('lists every table that holds an e-mail, with only jobs kept', () => {
    expect(PD_SOURCES.map((s) => [s.table, s.emailColumns.join(','), s.action])).toEqual([
      ['help_requests', 'email', 'erase'],
      ['contact_submissions', 'email', 'erase'],
      ['email_subscribers', 'email', 'erase'],
      ['firms_applications', 'contact_email', 'erase'],
      ['job_seeker_registrations', 'email', 'erase'],
      ['employer_briefs', 'contact_email', 'erase'],
      ['job_applications', 'applicant_email', 'erase'],
      ['jobs', 'employer_email,application_email', 'keep'],
    ])
    expect(PD_SOURCES.find((s) => s.table === 'jobs')?.only).toEqual({ source: 'employer' })
    for (const table of FORM_TABLES) expect(PD_SOURCES.some((s) => s.table === table)).toBe(true)
  })

  it('names the six places outside the database (PRIV-3 S5 adds Sentry and Vercel logs)', () => {
    expect(OUTSIDE_OUR_DATABASE).toHaveLength(6)
    for (const words of ['info@accountingbody.com', 'Resend', 'Lemon Squeezy', 'WhatsApp']) {
      expect(OUTSIDE_OUR_DATABASE.some((line) => line.includes(words))).toBe(true)
    }
    expect(OUTSIDE_OUR_DATABASE.slice(4)).toStrictEqual([
      "Sentry (error reports): reports have personal details removed, but check for this person's address in any report and delete it.",
      "Vercel logs: server logs are kept for a short time by Vercel; they hold codes, not addresses. Nothing to delete unless a log shows this person's details.",
    ])
  })
})
