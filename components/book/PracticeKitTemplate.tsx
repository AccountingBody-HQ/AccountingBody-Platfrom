// components/book/PracticeKitTemplate.tsx
// Accounting Body Press - Practice & Revision Kit PDF Template
// Renders the "practice" book type: title page, how-to-use guide,
// topic-organised table of contents, chapter openers (own page) with a
// topic summary table, questions (own page(s), numbered per chapter,
// restarting at Q1 every chapter), and an answers section that mirrors the
// question structure chapter-by-chapter and topic-by-topic.
//
// probeOnly mode: renders structural spacers only and fires onSectionPage()
// callbacks with the real page number of every section. The probe Page
// structure mirrors the full render exactly so markers land on the correct
// pages and TOC entries are accurate.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"

Font.registerHyphenationCallback((word: string) => [word])

const FONT_BASE = "https://accountingbody.com/fonts"
Font.register({
  family: "BookSans",
  fonts: [
    { src: FONT_BASE + "/LiberationSans-Regular.ttf" },
    { src: FONT_BASE + "/LiberationSans-Italic.ttf", fontStyle: "italic" },
  ],
})
Font.register({
  family: "BookSans-Bold",
  src: FONT_BASE + "/LiberationSans-Bold.ttf",
})

const W = 6 * 72
const H = 9 * 72
const MT = 0.75 * 72
const MB = 0.75 * 72
const MI = 0.75 * 72
const MO = 0.5  * 72

function sanitise(text: string): string {
  if (!text) return ""
  return text
    .replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u2212/g, "-")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, "\"")
    .replace(/\u2192/g, "->").replace(/\u2190/g, "<-").replace(/\u21D2/g, "=>")
    .replace(/\u00D7/g, "x").replace(/\u00F7/g, "/")
    .replace(/\u2260/g, "!=").replace(/\u2265/g, ">=").replace(/\u2264/g, "<=")
    .replace(/\u00B1/g, "+/-").replace(/\u2022/g, "-").replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ").replace(/\u200b/g, "").replace(/\u200c/g, "")
    .replace(/\u200d/g, "").replace(/\ufeff/g, "")
    .replace(/[\r\n]+/g, " ").replace(/  +/g, " ").trim()
}

function hasText(raw: string): boolean {
  return raw.replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, "").length > 0
}

function cleanChapterTitle(raw: string): string {
  return (raw || "").replace(/^Unit\s+\d+\s*[-:]\s*/i, "").trim()
}

function cleanLessonTitle(raw: string): string {
  return (raw || "").replace(/^Ch\.?\s*\d+[:.]\s*/i, "").trim()
}

const LETTERS = ["A", "B", "C", "D", "E"]

const HTU_PARA_1 =
  "This Practice and Revision Kit is designed to help you consolidate your understanding and develop examination technique. Every question has been written to reflect the style, depth, and difficulty of professional qualification assessments."
const HTU_PARA_2 =
  "Questions are organised by chapter and topic. Work through each topic systematically. Attempt the questions under timed conditions before consulting the answers - this is the single most effective way to identify gaps in your understanding."
const HTU_ATTEMPT_BULLETS = [
  "Allow approximately 2 minutes per question.",
  "Read the question stem carefully before looking at the options.",
  "Eliminate clearly wrong options first.",
  "If unsure, make your best selection and mark the question for review.",
  "After completing a topic, check all answers before moving on.",
]
const HTU_MARKING = "Each question carries 2 marks. There is no negative marking."
const HTU_EXPLANATION =
  "Each answer includes: the correct answer letter; a concept explanation; a case-specific walkthrough; and a key takeaway with common pitfall identification."

const EXPLANATION_KEYS = [
  "OVERVIEW:",
  "DATA (INPUTS & ASSUMPTIONS):",
  "METHOD:",
  "SOLUTION (STEP-BY-STEP):",
  "APPLY TO THIS CASE:",
  "KEY TAKEAWAY:",
  "COMMON PITFALL:",
]

interface ParsedExplanation {
  concept: string
  caseWalkthrough: string
  keyTakeaway: string
  pitfall: string
}

function parseExplanation(raw: string): ParsedExplanation {
  const text = (raw || "").trim()
  const result: ParsedExplanation = { concept: "", caseWalkthrough: "", keyTakeaway: "", pitfall: "" }
  if (!text) return result
  const markers: { pos: number; label: string }[] = []
  for (const key of EXPLANATION_KEYS) {
    const pos = text.indexOf(key)
    if (pos >= 0) markers.push({ pos, label: key })
  }
  markers.sort((a, b) => a.pos - b.pos)
  if (markers.length === 0) { result.concept = text; return result }
  if (markers[0].pos > 0) {
    const lead = text.slice(0, markers[0].pos).trim()
    if (lead) result.concept = lead
  }
  const caseParts: string[] = []
  for (let i = 0; i < markers.length; i++) {
    const { pos, label } = markers[i]
    const end = i + 1 < markers.length ? markers[i + 1].pos : text.length
    const chunk = text.slice(pos + label.length, end).trim()
    if (!chunk) continue
    if (label === "OVERVIEW:") result.concept = chunk
    else if (label === "KEY TAKEAWAY:") result.keyTakeaway = chunk
    else if (label === "COMMON PITFALL:") result.pitfall = chunk
    else caseParts.push(chunk)
  }
  result.caseWalkthrough = caseParts.join(" ")
  return result
}

function truncate(text: string, max: number): string {
  const t = sanitise(text)
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "..." : t
}

interface LessonQuestions {
  li: number
  lesson: any
  questions: { q: any; num: number; chapterLocalNum: number }[]
}
interface ChapterQuestions {
  ci: number
  chapter: any
  lessons: LessonQuestions[]
  totalQuestions: number
}

function buildQuestionIndex(course: any): { chapters: ChapterQuestions[]; totalQuestions: number } {
  const chapters: ChapterQuestions[] = []
  let globalN = 0
  const allChapters = course.chapters || []
  for (let ci = 0; ci < allChapters.length; ci++) {
    const ch = allChapters[ci]
    const lessons: LessonQuestions[] = []
    let chapterTotal = 0
    let chapterLocalN = 0
    const allLessons = ch.lessons || []
    for (let li = 0; li < allLessons.length; li++) {
      const ls = allLessons[li]
      const raw: any[] = []
      for (const art of (ls.linkedArticles || [])) {
        for (const q of (art.quizQuestions || [])) {
          if (hasText(q.questionText || "")) raw.push(q)
        }
      }
      if (raw.length === 0) continue
      const questions = raw.map((q) => ({ q, num: ++globalN, chapterLocalNum: ++chapterLocalN }))
      chapterTotal += questions.length
      lessons.push({ li, lesson: ls, questions })
    }
    chapters.push({ ci, chapter: ch, lessons, totalQuestions: chapterTotal })
  }
  return { chapters, totalQuestions: globalN }
}

const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MT + 20, paddingBottom: MB,
    paddingLeft: MI, paddingRight: MO,
    fontFamily: "BookSans", backgroundColor: "#ffffff",
  },
  runningHead: {
    position: "absolute", top: 12, right: MO,
    fontSize: 7, color: "#aaaaaa",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  runningLine: {
    position: "absolute", top: 24, left: MI, right: MO,
    borderBottomWidth: 0.5, borderBottomColor: "#dddddd",
  },
  pageNum: {
    position: "absolute", bottom: 18, right: MO,
    fontSize: 8, color: "#999999",
  },
  titlePage: { flex: 1, justifyContent: "center", alignItems: "center" },
  abPressLabel: {
    fontSize: 8, color: "#888888", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 2, textAlign: "center",
  },
  bookTitle: {
    fontSize: 22, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    textAlign: "center", marginBottom: 10, lineHeight: 1.3,
  },
  kitLabel: {
    fontSize: 11, color: "#555555", textAlign: "center",
    letterSpacing: 2, marginBottom: 20,
  },
  editionText: { fontSize: 9, color: "#888888", textAlign: "center" },
  titleDivider: {
    borderBottomWidth: 1, borderBottomColor: "#D4A017",
    marginVertical: 18, width: "50%", alignSelf: "center",
  },
  htuHeading: { fontSize: 18, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 8 },
  htuRule: { borderBottomWidth: 2, borderBottomColor: "#D4A017", marginBottom: 18 },
  htuBody: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, marginBottom: 10 },
  htuSubheading: {
    fontSize: 10, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 8,
  },
  bulletRow: { flexDirection: "row", marginBottom: 5, paddingLeft: 4 },
  bulletDot: { fontSize: 10, color: "#D4A017", width: 14 },
  bulletText: { fontSize: 10, color: "#1a1a1a", flex: 1, lineHeight: 1.6 },
  tocTitle: { fontSize: 18, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 20 },
  tocChapterRow: { marginBottom: 8 },
  tocChapterText: { fontSize: 10, fontFamily: "BookSans-Bold", color: "#0C1A3D" },
  tocChapterSubtitle: { fontSize: 9, color: "#666666", marginTop: 1, paddingLeft: 8 },
  tocLessonRow: { paddingLeft: 14, marginBottom: 3 },
  tocLessonText: { fontSize: 9, color: "#555555" },
  dotLeader: {
    flex: 1, borderBottomWidth: 0.7, borderBottomColor: "#bbbbbb",
    borderBottomStyle: "dotted", marginHorizontal: 4, marginBottom: 2,
  },
  chapterWrap: { marginBottom: 24 },
  chapterLabel: {
    fontSize: 8, color: "#D4A017", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 2, marginBottom: 6,
  },
  chapterTitle: {
    fontSize: 22, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    marginBottom: 8, lineHeight: 1.2,
  },
  chapterRule: { borderBottomWidth: 2, borderBottomColor: "#D4A017", marginBottom: 20 },
  chapterIntro: { fontSize: 10, color: "#555555" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#0C1A3D",
    paddingVertical: 5, paddingHorizontal: 8,
  },
  tableHeaderCell: { fontSize: 9, color: "#ffffff", fontFamily: "BookSans-Bold" },
  tableRow: {
    flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: "#eeeeee",
  },
  tableRowAlt: { backgroundColor: "#F7F6F2" },
  tableCell: { fontSize: 9, color: "#1a1a1a" },
  tableCellRight: { textAlign: "right" },
  tableFooterRow: {
    flexDirection: "row", backgroundColor: "#e8ecf5",
    paddingVertical: 5, paddingHorizontal: 8,
    borderTopWidth: 0.8, borderTopColor: "#0C1A3D",
  },
  tableFooterCell: { fontSize: 9, color: "#0C1A3D", fontFamily: "BookSans-Bold" },
  topicLabel: {
    fontSize: 7, color: "#D4A017", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 2, marginBottom: 3,
  },
  topicTitle: { fontSize: 13, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 4 },
  topicMeta: { fontSize: 9, color: "#777777", marginBottom: 6 },
  topicRule: { borderBottomWidth: 0.5, borderBottomColor: "#D4A017", marginBottom: 14 },
  questionOuter: {
    marginBottom: 6, paddingLeft: 10, paddingTop: 5, paddingBottom: 5,
    borderLeftWidth: 2.5, borderLeftColor: "#D4A017", backgroundColor: "#ffffff",
  },
  questionOuterScenario: { borderLeftColor: "#C9982A" },
  scenarioLabel: {
    fontSize: 6, color: "#C9982A", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 4,
  },
  questionHeaderRow: { flexDirection: "row", justifyContent: "space-between" },
  questionNum: { fontSize: 9, color: "#0C1A3D", fontFamily: "BookSans-Bold", letterSpacing: 0.5 },
  questionMeta: { fontSize: 7, color: "#999999" },
  questionText: { fontSize: 10, color: "#111111", lineHeight: 1.6, marginTop: 4, marginBottom: 6 },
  optionRow: { flexDirection: "row", marginBottom: 3 },
  optionLetter: { fontSize: 9, color: "#0C1A3D", fontFamily: "BookSans-Bold", width: 16 },
  optionText: { fontSize: 9, color: "#333333", flex: 1, lineHeight: 1.6 },
  endChapterWrap: { marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#dddddd" },
  endChapterText: { fontSize: 9, color: "#aaaaaa", textAlign: "center" },
  ansIntro: { fontSize: 10, color: "#555555", lineHeight: 1.7, marginBottom: 16 },
  ansChapterHeader: { fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginTop: 20, marginBottom: 8 },
  ansChapterRule: { borderBottomWidth: 0.5, borderBottomColor: "#D4A017", marginBottom: 12 },
  ansTopicHeader: {
    fontSize: 9, fontFamily: "BookSans-Bold", color: "#555555", marginTop: 14, marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  ansBlockWrap: { marginBottom: 14 },
  ansHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  ansQNum: { fontSize: 9, color: "#D4A017", fontFamily: "BookSans-Bold", width: 32 },
  ansCircle: {
    backgroundColor: "#0C1A3D", borderRadius: 6, width: 16, height: 13,
    alignItems: "center", justifyContent: "center",
  },
  ansCircleText: { fontSize: 8, color: "#ffffff", fontFamily: "BookSans-Bold" },
  conceptText: { fontSize: 9, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 4 },
  explanationLabel: {
    fontSize: 7, color: "#0C1A3D", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2,
  },
  explanationText: {
    fontSize: 8.5, color: "#333333", lineHeight: 1.55, marginBottom: 4,
    paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: "#dddddd",
  },
  keyTakeawayLabel: {
    fontSize: 7, color: "#D4A017", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2,
  },
  keyTakeawayText: { fontSize: 8.5, color: "#444444", lineHeight: 1.55, marginBottom: 4 },
  pitfallWrap: {
    backgroundColor: "rgba(212,160,23,0.08)", borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4,
  },
  pitfallLabel: {
    fontSize: 7, color: "#C9982A", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  pitfallText: { fontSize: 8, color: "#555555" },
  ansSeparator: { borderBottomWidth: 0.5, borderBottomColor: "#eeeeee", marginTop: 6, marginBottom: 8 },
  notesHeading: { fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 16 },
  noteLine: { borderBottomWidth: 0.5, borderBottomColor: "#dddddd", height: 22 },
  aboutWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  aboutBody: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, textAlign: "center", maxWidth: 300 },
  aboutSite: { fontSize: 10, fontFamily: "BookSans-Bold", color: "#0C1A3D", textAlign: "center", marginTop: 14 },
  aboutDisclaimer: { fontSize: 8, color: "#666666", lineHeight: 1.6, textAlign: "center", maxWidth: 320 },
})

// ── Probe height calibration ───────────────────────────────────────
// Usable content width for questions:
//   page 432pt - MI 54pt - MO 36pt - questionOuter paddingLeft 10pt = 332pt
// At 9pt Liberation Sans: ~6.9pt per char = ~48 chars per line.
// Option text same width minus 16pt letter prefix = ~46 chars per line.
// Answer explanation: 332pt - explanationText paddingLeft 8pt = 324pt
// At 8.5pt: ~6.5pt per char = ~50 chars per line.
const Q_CHARS_PER_LINE   = 48
const OPT_CHARS_PER_LINE = 46
const Q_LINE_PT          = 17.5
const OPT_LINE_PT        = 14.4
const ANS_CHARS_PER_LINE = 50
const ANS_LINE_PT        = 13.2
const ANSWER_HEADER_OVERHEAD_PT  = 44
const LESSON_HEADER_HEIGHT_PT    = 55
const CHAPTER_OPENER_BASE_PT     = 220
const CHAPTER_OPENER_ROW_PT      = 15
const ANSWERS_CHAPTER_HEADER_PT  = 50
const ANSWERS_TOPIC_HEADER_PT    = 30

function estimateQuestionHeightPt(q: any): number {
  const qText = (q.questionText || "").replace(/^SCENARIO:\s*/i, "")
  const qLines = Math.max(1, Math.ceil(qText.length / Q_CHARS_PER_LINE))
  let height = 20 + qLines * Q_LINE_PT
  const options = [q.options?.[0], q.options?.[1], q.options?.[2], q.options?.[3]].filter(Boolean)
  for (const opt of options) {
    const oLines = Math.max(1, Math.ceil(String(opt).length / OPT_CHARS_PER_LINE))
    height += oLines * OPT_LINE_PT + 5
  }
  return height + 16
}

function estimateAnswerHeightPt(q: any): number {
  const exp = q.explanation || ""
  const expLines = Math.max(1, Math.ceil(exp.length / ANS_CHARS_PER_LINE))
  return ANSWER_HEADER_OVERHEAD_PT + expLines * ANS_LINE_PT
}

function estimateChapterOpenerHeightPt(ch: any): number {
  const lessonCount = (ch.lessons || []).length
  return CHAPTER_OPENER_BASE_PT + lessonCount * CHAPTER_OPENER_ROW_PT
}

// ── ProbeDocument ────────────────────────────────────────────
// Page structure mirrors the full render EXACTLY:
//   3 frontmatter pages
//   Per chapter: Page A (opener) + Page B+ (questions, flowing naturally)
//   1 answers page (flowing)
//   3 closing pages (Notes x2, About)
// Each lesson block is a sequence of individual height spacers so react-pdf
// flows them across as many pages as needed. marker() fires at the START of
// each lesson block so it records the correct page number.
interface ProbeDocumentProps {
  course: any
  onSectionPage?: (key: string, page: number) => void
}

function ProbeDocument({ course, onSectionPage }: ProbeDocumentProps) {
  const chapters = course.chapters || []

  function marker(key: string) {
    return (
      <Text
        style={{ fontSize: 0.1 }}
        render={({ pageNumber }) => {
          if (onSectionPage) onSectionPage(key, pageNumber)
          return ""
        }}
      />
    )
  }

  return (
    <Document>
      <Page size={[W, H]} style={s.page} />
      <Page size={[W, H]} style={s.page} />
      <Page size={[W, H]} style={s.page} />

      {chapters.map((ch: any, ci: number) => (
        <React.Fragment key={ci}>
          <Page size={[W, H]} style={s.page}>
            {marker(`ch-${ci}`)}
            <View style={{ height: estimateChapterOpenerHeightPt(ch) }} />
          </Page>

          <Page size={[W, H]} style={s.page}>
            {(ch.lessons || []).map((ls: any, li: number) => {
              const qs = (ls.linkedArticles || [])
                .flatMap((a: any) => a.quizQuestions || [])
                .filter((q: any) => hasText(q.questionText || ""))
              if (qs.length === 0) return null
              return (
                <View key={li}>
                  {marker(`lesson-${ci}-${li}`)}
                  <View style={{ height: LESSON_HEADER_HEIGHT_PT }} />
                  {qs.map((q: any, qi: number) => (
                    <View key={qi} style={{ height: estimateQuestionHeightPt(q) }} />
                  ))}
                </View>
              )
            })}
          </Page>
        </React.Fragment>
      ))}

      <Page size={[W, H]} style={s.page}>
        {marker("answers")}
        {chapters.map((ch: any, ci: number) => {
          const blocks: React.ReactElement[] = [
            <View key={`ch-hdr-${ci}`} style={{ height: ANSWERS_CHAPTER_HEADER_PT }} />,
          ]
          for (const ls of (ch.lessons || [])) {
            const qs = (ls.linkedArticles || [])
              .flatMap((a: any) => a.quizQuestions || [])
              .filter((q: any) => hasText(q.questionText || ""))
            if (qs.length === 0) continue
            blocks.push(
              <View key={`t-${ci}-${blocks.length}`} style={{ height: ANSWERS_TOPIC_HEADER_PT }} />
            )
            for (let qi = 0; qi < qs.length; qi++) {
              blocks.push(
                <View key={`a-${ci}-${blocks.length}-${qi}`} style={{ height: estimateAnswerHeightPt(qs[qi]) }} />
              )
            }
          }
          return <React.Fragment key={ci}>{blocks}</React.Fragment>
        })}
      </Page>

      <Page size={[W, H]} style={s.page} />
      <Page size={[W, H]} style={s.page} />
      <Page size={[W, H]} style={s.page} />
    </Document>
  )
}

interface PracticeKitTemplateProps {
  course: any
  edition: string
  subtitle: string
  pageMap?: Record<string, number>
  probeOnly?: boolean
  onSectionPage?: (key: string, page: number) => void
}

export function PracticeKitTemplate({ course, edition, subtitle, pageMap, probeOnly, onSectionPage }: PracticeKitTemplateProps) {
  if (probeOnly) {
    return <ProbeDocument course={course} onSectionPage={onSectionPage} />
  }

  const { chapters: qIndex } = buildQuestionIndex(course)

  function pageFor(key: string): string {
    return pageMap && pageMap[key] ? String(pageMap[key]) : ""
  }

  return (
    <Document
      title={subtitle}
      author="Accounting Body Editorial Team"
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      <Page size={[W, H]} style={s.page}>
        <View style={s.titlePage}>
          <Text style={s.abPressLabel}>Accounting Body Press</Text>
          <View style={s.titleDivider} />
          <Text style={s.bookTitle}>{sanitise(subtitle)}</Text>
          <Text style={s.kitLabel}>PRACTICE & REVISION KIT</Text>
          <View style={s.titleDivider} />
          <Text style={s.editionText}>{edition}</Text>
        </View>
      </Page>

      <Page size={[W, H]} style={s.page}>
        <Text style={s.htuHeading}>How to Use This Book</Text>
        <View style={s.htuRule} />
        <Text style={s.htuBody}>{HTU_PARA_1}</Text>
        <Text style={s.htuBody}>{HTU_PARA_2}</Text>
        <Text style={s.htuSubheading}>How to Attempt Questions</Text>
        {HTU_ATTEMPT_BULLETS.map((b, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>-</Text>
            <Text style={s.bulletText}>{b}</Text>
          </View>
        ))}
        <Text style={s.htuSubheading}>Marking</Text>
        <Text style={s.htuBody}>{HTU_MARKING}</Text>
        <Text style={s.htuSubheading}>Explanation Structure</Text>
        <Text style={s.htuBody}>{HTU_EXPLANATION}</Text>
      </Page>

      <Page size={[W, H]} style={s.page}>
        <Text style={s.tocTitle}>Contents</Text>
        {qIndex.map(({ ci, chapter, lessons }) => (
          <View key={chapter._key || ci}>
            <View style={s.tocChapterRow}>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text style={s.tocChapterText}>Chapter {ci + 1}</Text>
                <View style={s.dotLeader} />
                <Text style={s.tocChapterText}>{pageFor("ch-" + ci)}</Text>
              </View>
              <Text style={s.tocChapterSubtitle}>{cleanChapterTitle(sanitise(chapter.chapterTitle))}</Text>
            </View>
            {lessons.map(({ li, lesson }) => (
              <View key={lesson._id || li} style={s.tocLessonRow}>
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <Text style={s.tocLessonText}>{cleanLessonTitle(sanitise(lesson.title))}</Text>
                  <View style={s.dotLeader} />
                  <Text style={s.tocLessonText}>{pageFor("lesson-" + ci + "-" + li)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        <View style={s.tocChapterRow}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={s.tocChapterText}>Answers and Explanations</Text>
            <View style={s.dotLeader} />
            <Text style={s.tocChapterText}>{pageFor("answers")}</Text>
          </View>
        </View>
      </Page>

      {qIndex.map(({ ci, chapter, lessons, totalQuestions: chapterTotalQ }) => (
        <React.Fragment key={chapter._key || ci}>
          <Page size={[W, H]} style={s.page}>
            <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
            <View style={s.runningLine} fixed />
            <View style={s.chapterWrap}>
              <Text style={s.chapterLabel}>Chapter {ci + 1}</Text>
              <Text style={s.chapterTitle}>{cleanChapterTitle(sanitise(chapter.chapterTitle))}</Text>
              <View style={s.chapterRule} />
            </View>
            <View style={{ height: 20 }} />
            <Text style={s.chapterIntro}>
              This chapter contains {chapterTotalQ} questions across {lessons.length} topics. Estimated time: {chapterTotalQ * 2} minutes.
            </Text>
            <View style={{ height: 12 }} />
            <View wrap={false}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.tableHeaderCell, { flex: 2 }]}>Topic</Text>
                <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Questions</Text>
                <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Marks</Text>
                <Text style={[s.tableHeaderCell, { flex: 1, textAlign: "right" }]}>Est. Time</Text>
              </View>
              {lessons.map(({ li, lesson, questions }, idx) => (
                <View key={lesson._id || li} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                  <Text style={[s.tableCell, { flex: 2 }]}>{truncate(cleanLessonTitle(lesson.title), 45)}</Text>
                  <Text style={[s.tableCell, s.tableCellRight, { flex: 1 }]}>{questions.length}</Text>
                  <Text style={[s.tableCell, s.tableCellRight, { flex: 1 }]}>{questions.length * 2}</Text>
                  <Text style={[s.tableCell, s.tableCellRight, { flex: 1 }]}>{questions.length * 2} mins</Text>
                </View>
              ))}
              <View style={s.tableFooterRow}>
                <Text style={[s.tableFooterCell, { flex: 2 }]}>Chapter Total</Text>
                <Text style={[s.tableFooterCell, s.tableCellRight, { flex: 1 }]}>{chapterTotalQ}</Text>
                <Text style={[s.tableFooterCell, s.tableCellRight, { flex: 1 }]}>{chapterTotalQ * 2}</Text>
                <Text style={[s.tableFooterCell, s.tableCellRight, { flex: 1 }]}>{chapterTotalQ * 2} mins</Text>
              </View>
            </View>
            <Text style={s.pageNum} render={({ pageNumber }) => String(pageNumber)} fixed />
          </Page>

          <Page size={[W, H]} style={s.page}>
            <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
            <View style={s.runningLine} fixed />
            {lessons.map(({ li, lesson, questions }) => (
              <View key={lesson._id || li}>
                <View style={{ marginTop: 20 }} minPresenceAhead={80}>
                  <Text style={s.topicLabel}>Topic {ci + 1}.{li + 1}</Text>
                  <Text style={s.topicTitle}>{cleanLessonTitle(sanitise(lesson.title))}</Text>
                  <Text style={s.topicMeta}>{questions.length} questions  |  {questions.length * 2} marks  |  ~{questions.length * 2} minutes</Text>
                  <View style={s.topicRule} />
                </View>
                {questions.map(({ q, num, chapterLocalNum }) => {
                  const rawText = sanitise(q.questionText || "")
                  const isScenario = rawText.startsWith("SCENARIO:")
                  const displayText = isScenario ? rawText.slice("SCENARIO:".length).trim() : rawText
                  return (
                    <View
                      key={num}
                      wrap={false}
                      style={[s.questionOuter, isScenario ? s.questionOuterScenario : {}]}
                    >
                      {isScenario ? <Text style={s.scenarioLabel}>Scenario Question</Text> : null}
                      <View style={s.questionHeaderRow}>
                        <Text style={s.questionNum}>Q{chapterLocalNum}</Text>
                        <Text style={s.questionMeta}>2 marks  |  ~2 mins</Text>
                      </View>
                      <Text style={s.questionText}>{displayText}</Text>
                      {(q.options || []).map((opt: any, oi: number) => (
                        <View key={oi} style={s.optionRow}>
                          <Text style={s.optionLetter}>{LETTERS[oi]}.</Text>
                          <Text style={s.optionText}>{sanitise(opt)}</Text>
                        </View>
                      ))}
                    </View>
                  )
                })}
              </View>
            ))}
            <View style={s.endChapterWrap}>
              <Text style={s.endChapterText}>End of Chapter {ci + 1} - {chapterTotalQ} questions</Text>
            </View>
            <Text style={s.pageNum} render={({ pageNumber }) => String(pageNumber)} fixed />
          </Page>
        </React.Fragment>
      ))}

      <Page size={[W, H]} style={s.page}>
        <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
        <View style={s.runningLine} fixed />
        <View style={s.chapterWrap}>
          <Text style={s.chapterLabel}>Answers</Text>
          <Text style={s.chapterTitle}>Answers and Explanations</Text>
          <View style={s.chapterRule} />
        </View>
        <Text style={s.ansIntro}>
          Work through the answers only after you have attempted the questions. For each incorrect answer, identify whether the error was conceptual (re-read the relevant study material) or a misreading of the question (review your exam technique).
        </Text>
        {qIndex.map(({ ci, chapter, lessons }) => (
          <View key={chapter._key || ci}>
            <Text style={s.ansChapterHeader}>Chapter {ci + 1}: {cleanChapterTitle(sanitise(chapter.chapterTitle))}</Text>
            <View style={s.ansChapterRule} />
            {lessons.map(({ li, lesson, questions }) => (
              <View key={lesson._id || li}>
                <Text style={s.ansTopicHeader}>Topic {ci + 1}.{li + 1}: {cleanLessonTitle(sanitise(lesson.title))}</Text>
                {questions.map(({ q, num, chapterLocalNum }, qi) => {
                  const parsed = parseExplanation(sanitise(q.explanation || ""))
                  const letter = LETTERS[q.correctIndex ?? 0]
                  const isLast = qi === questions.length - 1
                  return (
                    <View key={num} style={s.ansBlockWrap}>
                      <View style={s.ansHeaderRow}>
                        <Text style={s.ansQNum}>Q{chapterLocalNum}:</Text>
                        <View style={s.ansCircle}>
                          <Text style={s.ansCircleText}>{letter}</Text>
                        </View>
                      </View>
                      {parsed.concept ? <Text style={s.conceptText}>{parsed.concept}</Text> : null}
                      {parsed.caseWalkthrough ? [
                        <Text key="wl" style={s.explanationLabel}>Explanation:</Text>,
                        <Text key="wt" style={s.explanationText}>{parsed.caseWalkthrough}</Text>,
                      ] : null}
                      {parsed.keyTakeaway ? [
                        <Text key="kl" style={s.keyTakeawayLabel}>Key Takeaway</Text>,
                        <Text key="kt" style={s.keyTakeawayText}>{parsed.keyTakeaway}</Text>,
                      ] : null}
                      {parsed.pitfall ? (
                        <View style={s.pitfallWrap}>
                          <Text>
                            <Text style={s.pitfallLabel}>Pitfall: </Text>
                            <Text style={s.pitfallText}>{parsed.pitfall}</Text>
                          </Text>
                        </View>
                      ) : null}
                      {!isLast ? <View style={s.ansSeparator} /> : null}
                    </View>
                  )
                })}
              </View>
            ))}
          </View>
        ))}
        <Text style={s.pageNum} render={({ pageNumber }) => String(pageNumber)} fixed />
      </Page>

      {[1, 2].map((n) => (
        <Page key={"notes-" + n} size={[W, H]} style={s.page}>
          <Text style={s.notesHeading}>Notes</Text>
          {Array.from({ length: 22 }).map((_, li) => (
            <View key={li} style={s.noteLine} />
          ))}
        </Page>
      ))}

      <Page size={[W, H]} style={s.page}>
        <View style={s.aboutWrap}>
          <Text style={s.abPressLabel}>About Accounting Body Press</Text>
          <View style={s.titleDivider} />
          <Text style={s.aboutBody}>
            Accounting Body Press publishes structured study texts and practice kits for learners preparing for professional accounting qualifications. Every title is developed by the Accounting Body Editorial Team and is designed to pair clear explanation with rigorous practice.
          </Text>
          <Text style={s.aboutSite}>accountingbody.com</Text>
          <View style={s.titleDivider} />
          <Text style={s.aboutDisclaimer}>
            Accounting Body is an independent study platform and is not affiliated with, endorsed by, or connected to ACCA, CIMA, ICAEW, or AAT. These names are used solely to identify the qualifications our study materials are designed to support.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
