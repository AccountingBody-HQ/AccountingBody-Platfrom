/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLATFORM_IDENTITY = `
PLATFORM: AccountingBody (accountingbody.com)
BRAND POSITION: The authoritative platform for global accounting education and professional services.
AUDIENCE: Accounting students preparing for ACCA, CIMA, ICAEW and AAT examinations. Qualified accountants, finance managers, CFOs, financial controllers, and business owners worldwide.
VOICE: Authoritative, educational, precise. Like a senior chartered accountant and experienced tutor writing a professional development guide for peers and students. Never superficial. Never generic.
WHAT ACCOUNTINGBODY NEVER DOES:
- Never reproduces or closely paraphrases IFRS Foundation, IASB, FASB, FRC, ACCA, CIMA, ICAEW or AAT wording
- Never invents accounting figures, tax rates or regulatory thresholds without a verification caveat
- Never presents a single accounting treatment as definitive where professional judgement applies
- Never gives tax or legal advice as definitive fact without jurisdiction context
- Never writes generic blog content — every article must contain insight a professional cannot find in a 30-second Google search
QUALITY BENCHMARK: Kaplan and BPP professional study texts. ICAEW technical releases. Big Four accounting insight publications. That is the standard. Meet it or exceed it.`

const CONTENT_STRUCTURES: Record<string, string> = {
  'Study Note': `
CONTENT TYPE: Study Note
PURPOSE: A precise, well-structured study note that takes a student from unfamiliar to exam-ready on a specific topic. Must be the best study resource available on this topic — better than generic revision notes, richer than a flashcard, more practical than a textbook summary.
REQUIRED SECTIONS (use these headings exactly):
1. Topic Overview — what this topic covers, why it matters in the exam and in practice, which papers and levels examine it
2. Core Concepts and Definitions — key terms defined precisely, in teaching language not legislative drafting
3. The Mechanics — how it works step by step, with clear logical flow
4. Worked Example — a full worked example using invented but realistic figures, clearly labelled as illustrative. Include journal entries where relevant.
5. Key Judgements and Common Pitfalls — where students go wrong, and why, with specific named errors
6. Exam Technique — specific advice for how this topic is typically examined, what markers look for, how marks are allocated
7. Key Points to Remember — 5-7 bullet points a student can act on immediately before an exam
ACCURACY RULES:
- Never reproduce ACCA, CIMA, ICAEW or AAT past paper questions or model answers
- All worked examples must use invented but realistic figures — never round numbers that signal fabrication
- Where an accounting standard is referenced, cite it by name (e.g. IFRS 15) but never reproduce paragraph text
- Flag where treatment differs between IFRS and UK GAAP if relevant to the qualification`,

  'Article': `
CONTENT TYPE: Article
PURPOSE: A high-quality, professionally authoritative article on an accounting, finance or business topic relevant to the AccountingBody audience. Must deliver genuine professional insight — not a generic explainer.
REQUIRED SECTIONS:
1. Opening — a strong, specific hook that establishes the significance of the topic for accounting professionals
2. The Core Analysis — the substance of the piece with clear logical flow and professional depth
3. Practical Application — how this topic applies in real practice, with specific scenarios
4. Professional Implications — what this means for accountants, finance professionals or students
5. Conclusion — a definitive close that leaves the reader with a genuine professional insight
ACCURACY RULES:
- Never invent statistics — describe data directionally if specific figures are unknown
- Opinion must be clearly framed as analysis, not stated as regulatory fact`,

  'Exam Technique Guide': `
CONTENT TYPE: Exam Technique Guide
PURPOSE: A practical, specific guide to maximising marks on a particular exam, paper or question type. Must go beyond generic advice into the specific mechanics of how this exam rewards or penalises students.
REQUIRED SECTIONS:
1. The Exam in Context — what the examiner is testing, what the paper structure demands, time allocation
2. What Markers Actually Look For — specific marking criteria, how professional marks are awarded, common mark-scoring opportunities students miss
3. Question Approach — a step-by-step method for approaching questions in this paper, with a worked example of the approach
4. Time Management — specific time allocation strategy, what to do when stuck, when to move on
5. Common Mistakes That Cost Marks — specific, named errors students make in this exam — not generic cautions
6. The Difference Between a Pass and a Merit — what specifically separates a 50% script from a 65% script in this paper
7. Final Exam Checklist — 7-10 actionable points to apply in the exam room
ACCURACY RULES:
- Never reproduce past paper questions verbatim
- Exam structure details must reflect current examiner guidance for the relevant qualification`,

  'Practice Question Explainer': `
CONTENT TYPE: Practice Question Explainer
PURPOSE: A detailed explanation of how to approach and answer a specific type of practice question, including worked solution and marking commentary.
REQUIRED SECTIONS:
1. Question Type Overview — what this question type tests and why it appears in the exam
2. The Question — an original, invented practice question of the appropriate type and difficulty
3. Approach — how to read and plan the answer before writing
4. Model Answer — a full model answer showing the correct approach, with commentary
5. Marking Commentary — how marks would be awarded, what alternative approaches score, what loses marks
6. Common Errors — specific mistakes students make on this question type
7. Practice Tips — how to build competency on this question type
ACCURACY RULES:
- Questions must be original — never reproduce or closely adapt past paper questions
- Figures and scenarios must be invented but realistic`,

  'Subject Overview': `
CONTENT TYPE: Subject Overview
PURPOSE: A comprehensive, structured overview of an entire subject or paper within a qualification. Must function as the definitive starting point for a student beginning this subject.
REQUIRED SECTIONS:
1. Subject Introduction — what the subject covers, its place in the qualification, who examines it and how
2. Syllabus Breakdown — the main topic areas with a brief description of each
3. Exam Format — paper structure, question types, time allowed, pass mark
4. Difficulty and Common Student Challenges — where students typically struggle and why
5. Study Approach — recommended study sequence, time allocation, resources
6. Key Topics to Prioritise — the highest-value topics based on examiner focus and mark allocation
7. How This Subject Links to Others — connections to other papers in the qualification
ACCURACY RULES:
- Syllabus details must reflect current qualification structure for the relevant body
- Never present historical exam formats as current if the paper has been restructured`,
}

const TECHNICAL_ACCURACY_RULES = `
UNIVERSAL TECHNICAL ACCURACY RULES:
1. Never invent specific accounting standards references that do not exist
2. Always name the relevant standard by reference (e.g. IAS 36, IFRS 15, FRS 102) — never as "the relevant standard"
3. Distinguish clearly between IFRS treatment and UK GAAP treatment where they differ
4. Where figures are stated in worked examples, use specific realistic amounts — not round numbers
5. Where exam-specific rules are stated, make clear which qualification body they apply to
6. Never present a contested accounting treatment as definitively correct without acknowledging the judgement involved`

const COPYRIGHT_RULES = `
COPYRIGHT AND ORIGINALITY RULES:
1. Do not reproduce ACCA, CIMA, ICAEW, AAT, Kaplan, BPP or any professional body study material
2. Do not reproduce past paper questions or model answers
3. Do not mirror the structure of known textbooks or study guides
4. All worked examples must use invented company names and figures
5. Express all standard requirements in original teaching language
6. The output must be demonstrably original — not a paraphrase of any single identifiable source`

const FORBIDDEN_PHRASES = `
FORBIDDEN PHRASES — NEVER USE:
- Never mention ACCA, CIMA, ICAEW, AAT, or any professional accounting body name anywhere in the published content — not in the title, not in headings, not in body text, not in key points. These are used internally for categorisation only and must never appear in the output.
- Never reference "this exam", "the exam", "exam technique for [body]", "for [body] candidates" or any phrase that implies affiliation with or endorsement by a professional body.
- Instead of "for ACCA students" write "for accounting students" or "in professional accounting examinations"
- Instead of "ACCA Financial Reporting" write "financial reporting at professional level" or "advanced financial reporting"
- Instead of "CIMA candidates" write "management accounting students" or "finance professionals"
- "In today's fast-paced world..." / "In today's rapidly changing landscape..."
- "It is worth noting that..." / "It is important to note that..." / "It should be noted that..."
- "As previously mentioned..." / "As we have seen..."
- "In this article, we will explore..." / "Read on to discover..." / "Let us dive in..."
- "In conclusion, it is clear that..." / "To summarise, we have covered..."
- "various", "numerous", "a wide range of" — replace with specific language
- Any sentence whose sole purpose is to announce what the next paragraph will say
- Any conclusion that merely lists what was already covered
THE RULE: Every sentence must carry information the reader did not have before reading it.`

const OUTPUT_FORMAT = `
OUTPUT FORMAT:
- Output the full article in markdown only
- No preamble, no meta-commentary, no "here is your article" framing
- Use # for the title, ## for main headings, ### for sub-headings
- After the article write exactly: ---AI_SUMMARY---
  Then 2-3 sentences summarising the topic, qualification, and key learning points for search indexing.
- Then write exactly: ---AI_KEY_TERMS---
  Then 10-15 comma-separated key terms including: topic, qualification, paper name, related concepts.`

function buildPrompt(config: {
  site: string; contentType: string; qualification: string
  subject: string; topic: string; tone: string; length: string; difficulty: string
}) {
  const wordTargets: Record<string, string> = {
    short:    '480 to 560 words — tight, precise, zero padding.',
    standard: '950 to 1100 words — comprehensive and focused, dense with professional insight.',
    deep:     '2000 to 2500 words — exhaustive, reference-quality. The definitive resource on this topic.',
  }
  const wordTarget = wordTargets[config.length] ?? wordTargets.standard
  const structureCtx = CONTENT_STRUCTURES[config.contentType] ?? CONTENT_STRUCTURES['Article']

  const toneGuide: Record<string, string> = {
    Authoritative: 'Write as a senior expert addressing peers. Confident. Definitive where facts support it.',
    Educational:   'Write as a master educator. Build understanding layer by layer. Clear examples. Never condescend.',
    Technical:     'Write as a specialist practitioner. Precise terminology. Full technical detail.',
  }
  const toneInstruction = toneGuide[config.tone] ?? toneGuide.Educational

  const difficultyGuide: Record<string, string> = {
    Foundation:    'Assume the student is new to this topic. Build from first principles. No assumed prior knowledge.',
    Intermediate:  'Assume the student has basic familiarity. Focus on depth, nuance and application.',
    Advanced:      'Assume the student is near exam-ready. Focus on complex scenarios, edge cases and professional judgement.',
  }
  const difficultyInstruction = difficultyGuide[config.difficulty] ?? difficultyGuide.Intermediate

  return `You are the lead content director for AccountingBody, a world-class professional accounting education platform. You are writing content benchmarked against Kaplan, BPP and Big Four technical publications. Generic content is not acceptable. Every article must be exceptional.

PLATFORM IDENTITY:
${PLATFORM_IDENTITY}

CONTENT SPECIFICATION:
${structureCtx}

QUALIFICATION: ${config.qualification}
SUBJECT / PAPER: ${config.subject || 'General'}
TOPIC: ${config.topic}
DIFFICULTY LEVEL: ${config.difficulty} — ${difficultyInstruction}
TONE: ${toneInstruction}
TARGET LENGTH: ${wordTarget}

TECHNICAL ACCURACY RULES:
${TECHNICAL_ACCURACY_RULES}

COPYRIGHT AND ORIGINALITY:
${COPYRIGHT_RULES}

FORBIDDEN PHRASES:
${FORBIDDEN_PHRASES}

QUALITY SELF-CHECK before finalising:
1. Does every paragraph contain a genuine insight a student or professional could not find in a 30-second Google search?
2. Is every worked example using invented but realistic figures?
3. Does the structure follow the required template exactly?
4. Have all forbidden phrases been removed?
5. Is the opening paragraph strong enough to stand alone as a meta description?
6. Would this content hold its own next to a Kaplan study text or BPP revision kit?

OUTPUT FORMAT:
${OUTPUT_FORMAT}`
}

export async function POST(req: NextRequest) {
  try {
    const config = await req.json()

    if (!config.contentType || !config.qualification || !config.topic) {
      return NextResponse.json({ error: 'contentType, qualification and topic are required' }, { status: 400 })
    }

    const maxTokens = config.length === 'deep' ? 6000 : 4096
    const prompt = buildPrompt(config)

    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system:     'You are the lead content director for AccountingBody, a world-class professional accounting education platform. You never produce generic content. You never invent regulatory figures. You never use filler phrases. You always follow the content structure and all rules provided exactly. Every sentence must carry professional-grade insight. Your output is always publication-ready to the standard of Kaplan or BPP study texts.',
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    const summaryMatch  = raw.match(/---AI_SUMMARY---([\s\S]*?)(?:---AI_KEY_TERMS---|$)/)
    const keyTermsMatch = raw.match(/---AI_KEY_TERMS---([\s\S]*)$/)
    const content       = raw.split('---AI_SUMMARY---')[0].trim()
    const aiSummary     = summaryMatch  ? summaryMatch[1].trim() : ''
    const keyTerms      = keyTermsMatch ? keyTermsMatch[1].trim() : ''

    return NextResponse.json({ content, aiSummary, keyTerms })
  } catch (err: any) {
    console.error('content-factory/generate error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
