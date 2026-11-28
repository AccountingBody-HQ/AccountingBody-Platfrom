// Assessment packs: how questions, options and explanations are written.
// Ported from the question generator and the Studio question standard.

export const DISTRACTOR_LIBRARY = `DISTRACTOR ENGINEERING — MANDATORY FOR ALL MCQ:
Every incorrect option must represent a REAL, SPECIFIC ERROR students commonly make.
Never use obviously wrong distractors. Never use "None of the above" or "All of the above".
Common error types: SIGN ERROR, PERIOD ERROR, OMISSION ERROR, INCLUSION ERROR, RATE/BASE ERROR, METHOD CONFUSION, DIRECTION ERROR, ARITHMETIC ERROR, CONCEPT CONFUSION, STANDARD CONFUSION.
For numeric questions: all four options must represent plausible calculation outcomes. Distractors should correspond to specific identifiable errors.
State in the explanation exactly WHY each distractor is wrong (which error it represents).`

export const EXPLANATION_STANDARDS = `EXPLANATION QUALITY STANDARDS — NON-NEGOTIABLE:
Every explanation must be a genuine TEACHING RESOURCE.

FOR CALCULATION QUESTIONS:
OVERVIEW: [What concept this tests and why it matters]
DATA: [Every figure used and what it represents]
METHOD: [The calculation approach and why correct]
SOLUTION (STEP-BY-STEP): Step 1: [label] = [calc] = [result] ... (never skip steps)
WHY OTHERS WRONG: [for each wrong option, named by its content: the specific error]. (skip correct option)
KEY TAKEAWAY: [One memorable sentence to prevent this mistake in future]

FOR THEORY/CONCEPT QUESTIONS:
OVERVIEW: [What professional knowledge this tests]
WHY CORRECT: [Detailed explanation with reference to relevant standard or principle]
WHY OTHERS WRONG: [for each wrong option, named by its content: the misconception].
PROFESSIONAL CONTEXT: [Where practitioner encounters this in real work]
KEY TAKEAWAY: [One specific memorable sentence]

CRITICAL: Journal entries: plain Dr/Cr text. British English throughout.`

/** Kept for later blueprints; the v1 question set is multiple-choice only. */
export const SCENARIO_ENGINEERING = `SCENARIO CASE CONSTRUCTION STANDARDS:
Exhibit structure: Company background, financial context, specific situation, supporting data (specific non-round figures), intentional complexity (one irrelevant item that tests judgement).
Exhibit length: Beginner 100-150 words. Intermediate 200-300 words. Advanced 350-500 words.
Linked questions: each tests a distinct aspect. Mix calculation and judgement. Final question typically requires evaluation or recommendation.`

export const STUDIO_QUESTION_STANDARD = `SECTION 1 — QUESTION QUALITY STANDARDS (NON-NEGOTIABLE)

Every question must meet ALL of the following standards without exception.
A question that fails any one of these standards must be rewritten before output.

1.1 ORIGINALITY
— Do not lift, paraphrase, or closely mirror any sentence from the article.
— Every question stem must be written from first principles.
— Scenarios must use original numbers, company names, and contexts.
— The article is source knowledge only — not raw material to copy from.

1.2 APPLICATION OVER RECALL
— Do not test whether a student can remember a definition.
— Every question must require the student to APPLY, ANALYSE, or EVALUATE
  a concept in a realistic professional context.
— If the correct answer could be found by scanning the article for a
  matching phrase, rewrite the question.
— Ask yourself: would a student who understood the concept but had never
  read this article be able to answer this question? They should be able to.

1.3 STEM QUALITY
— The stem must be self-contained and unambiguous.
— State all assumptions the student needs. Never leave implicit what
  should be explicit.
— For calculation questions: provide all figures, rates, and dates needed
  to reach a unique correct answer.
— For scenario questions: set a realistic business context (named entity,
  currency, transaction type, date) before asking the question.
— Stem length: sufficient to be precise, no longer. No padding.
— Never write negative stems ("Which of the following is NOT...") unless
  the concept genuinely requires elimination-based reasoning.

1.4 DISTRACTOR QUALITY (CRITICAL)
— Each wrong option must represent a specific, named misconception or
  error that a real exam candidate plausibly makes.
— Acceptable distractor types:
    (a) A common conceptual error
    (b) A correct calculation using the wrong rate or the wrong method
    (c) A correct statement about a different standard or a different scenario
    (d) A reversal of the correct relationship
— NEVER write distractors that are:
    (a) Obviously nonsensical or clearly unrelated
    (b) Slightly reworded versions of each other
    (c) Detectable as wrong by reading the stem alone, without accounting knowledge
— All four options must be the same type and approximately the same length.
— Options containing "All of the above", "None of the above", or
  "Both A and B" are PROHIBITED.

1.5 SINGLE CORRECT ANSWER
— There must be exactly one defensibly correct answer.
— Run a mental adversarial check: could a well-prepared candidate
  construct a reasonable argument for any wrong option being correct?
  If yes, revise the question or the distractor.

1.6 TECHNICAL ACCURACY
— Every calculation must be verified before output.
— Every standard reference (IAS 21, IFRS 9, etc.) must be cited correctly.
— Every accounting treatment must reflect current IFRS/UK GAAP as applicable
  to the level and jurisdiction specified.

SECTION 2 — QUESTION SET ARCHITECTURE

2.1 DIFFICULTY DISTRIBUTION
Generate, in the proportion 4 : 16 : 5:
— BEGINNER questions — foundational understanding, one-step reasoning,
  no multi-part calculations
— INTERMEDIATE questions — application in realistic single-entity
  scenarios, may include two-step calculations, standard rule application
— ADVANCED questions — professional judgement across multiple concepts,
  multi-step calculations, edge cases within the standard, situations where
  two plausible treatments exist and the candidate must select the correct one

2.2 QUESTION TYPE DISTRIBUTION
Across the set, include, in proportion to a set of 25:
— Minimum 8 CALCULATION questions: original numbers, compute a specific
  figure, show full working in the explanation
— Minimum 8 SCENARIO questions: named entity in a realistic business
  situation, identify correct treatment, classification, or measurement
— Minimum 5 CONCEPTUAL questions: understanding of principles or
  relationships between concepts — never pure definition recall
— Remaining: judgement questions requiring distinction between two or
  more plausible treatments

2.3 TOPIC COVERAGE
— Distribute questions proportionally across all major sections of the article.
— No single section may account for more than 35% of the questions.
— At least one question must address each major section of the article.

2.4 PROGRESSION
— Order questions from beginner to advanced.

SECTION 3 — EXPLANATION STANDARDS

Every explanation must contain ALL FIVE components. An explanation
missing any component must be completed before output.

COMPONENT 1 — CORRECT ANSWER REASONING (mandatory)
Precisely why the correct answer is correct. For calculations, show
full step-by-step working with intermediate figures labelled. For
conceptual questions, cite the specific rule or principle.

COMPONENT 2 — WRONG OPTION ANALYSIS (mandatory — all three)
For each wrong option in sequence: name the specific misconception it
represents, explain in one to three sentences why it is wrong, and if
numerically wrong, show where the calculation breaks down.

COMPONENT 3 — UNDERLYING CONCEPT (mandatory)
One to two sentences stating the broader accounting or finance principle
being tested, written as a teaching statement.

COMPONENT 4 — STANDARD REFERENCE (mandatory where applicable)
Cite the specific standard, paragraph, or rule (e.g. IAS 21.23). If no
specific standard applies, cite the conceptual framework principle.

COMPONENT 5 — LEARNING TAKEAWAY (mandatory)
One sentence beginning with "Remember:" giving the student a durable,
exam-applicable rule they can carry into any question on this topic.

Minimum explanation length: 120 words. Maximum: 300 words.
Prose paragraphs only — no bullet points inside explanations.

SECTION 4 — SELF-AUDIT BEFORE OUTPUT

Before producing the JSON, run these checks silently.
Do not output the audit — only output the corrected JSON.

□ Exactly the requested number of questions present, q1 through the last
□ Beginner, intermediate and advanced in the proportion 4 : 16 : 5
□ At least 8 calculation questions with verified arithmetic (in proportion to a set of 25)
□ At least 8 scenario questions with named entities and contexts (in proportion to a set of 25)
□ No question stem lifted or closely paraphrased from the article
□ Every distractor represents a named, plausible misconception
□ No "All of the above", "None of the above", "Both A and B" options
□ Every explanation contains all 5 required components
□ Every explanation is minimum 120 words
□ All four options within each question are the same type and length
□ correctIndex verified against the options array (0-based)
□ All calculations independently verified
□ No single article section exceeds 35% of questions
□ JSON is valid and matches the required output structure exactly`

export const ANSWER_BALANCE = `ANSWER BALANCE: Across the set, put the correct answer in each position (the first, second, third and fourth place in the options list) for 20-30% of the questions each. Never put the correct answer in the same position four or more times in a row.`

export const OPTION_REFERENCES = 'Refer to every option by its content, never by its letter or position (the site shuffles options).'

/**
 * Explanations that point at an option by letter or place (P1-P5). The same
 * rule counts the repairs on the live site, so keep these exactly as they are.
 */
export const LETTER_REFERENCE_PATTERNS: readonly RegExp[] = [
  /\b(option|answer|choice)\s*\(?[a-d]\)?(\b|[.,:;)])/i,
  /\(([a-d])\)\s/i,
  /\b([a-d])\)\s/i,
  /\b(first|second|third|fourth|last|final)\s+(option|answer|choice)/i,
  /\boptions?\s+[a-d]\s+(and|or)\s+[a-d]\b/i,
]

/** Options that are never allowed (compared lower-case, trimmed, trailing punctuation ignored). */
export const BANNED_OPTIONS: readonly string[] = [
  'all of the above',
  'none of the above',
  'both of the above',
  'neither of the above',
  'all of these',
  'none of these',
  'both a and b',
  'a and b',
  'a, b and c',
]
