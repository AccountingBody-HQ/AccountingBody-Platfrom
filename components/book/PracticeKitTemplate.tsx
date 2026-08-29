// components/book/PracticeKitTemplate.tsx
// Accounting Body Press - Practice & Revision Kit PDF Template
// Dedicated single-render template for "practice" book type: title page,
// how-to-use guide, topic-organised table of contents, chapter openers with
// a topic summary table, questions grouped by topic with continuous global
// numbering, and an answers section that mirrors the question structure
// chapter-by-chapter and topic-by-topic. Font registrations, sanitise(),
// hasText(), and the KDP 6x9 page dimensions are duplicated from
// BookTemplate.tsx (self-contained pure functions, safe to duplicate per
// the pattern already used by ChapterTemplate.tsx).
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

// ── Dimensions (identical to BookTemplate.tsx) ────────────────────────────────
const W = 6 * 72
const H = 9 * 72
const MT = 0.75 * 72
const MB = 0.75 * 72
const MI = 0.75 * 72
const MO = 0.5 * 72

// ── Unicode sanitiser (duplicated from BookTemplate.tsx) ──────────────────────────────────────
function sanitise(text: string): string {
  if (!text) return ""
  return text
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u21D2/g, "=>")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    .replace(/\u2260/g, "!=")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/\u00B1/g, "+/-")
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\u200c/g, "")
    .replace(/\u200d/g, "")
    .replace(/\ufeff/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/  +/g, " ")
    .trim()
}

// ── Visibility check (duplicated from BookTemplate.tsx) ───────────────────────
function hasText(raw: string): boolean {
  return raw.replace(/[\s ​‌‍﻿]/g, "").length > 0
}

// ── Constants ─────────────────────────────────────────────────────────────────
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

// ── parseExplanation() ─────────────────────────────────────────────────────────
// The explanation field is structured text with known section labels.
// OVERVIEW -> concept; DATA/METHOD/SOLUTION/APPLY TO THIS CASE -> caseWalkthrough
// (concatenated in order, labels stripped); KEY TAKEAWAY -> keyTakeaway;
// COMMON PITFALL -> pitfall. Any leading unlabelled text becomes concept.
// Text with no recognised labels goes entirely into concept.
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

  if (markers.length === 0) {
    result.concept = text
    return result
  }

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
    if (label === "OVERVIEW:") {
      result.concept = chunk
    } else if (label === "KEY TAKEAWAY:") {
      result.keyTakeaway = chunk
    } else if (label === "COMMON PITFALL:") {
      result.pitfall = chunk
    } else {
      // DATA (INPUTS & ASSUMPTIONS): / METHOD: / SOLUTION (STEP-BY-STEP): / APPLY TO THIS CASE:
      caseParts.push(chunk)
    }
  }
  result.caseWalkthrough = caseParts.join(" ")
  return result
}

function truncate(text: string, max: number): string {
  const t = sanitise(text)
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "..." : t
}

// ── Global question numbering (Part B) ──────────────────────────────────────
// Computed from course data alone, so probe and final render passes produce
// identical numbering regardless of pageMap.
interface LessonQuestions {
  li: number
  lesson: any
  questions: { q: any; num: number }[]
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
      const questions = raw.map((q) => ({ q, num: ++globalN }))
      chapterTotal += questions.length
      lessons.push({ li, lesson: ls, questions })
    }
    chapters.push({ ci, chapter: ch, lessons, totalQuestions: chapterTotal })
  }
  return { chapters, totalQuestions: globalN }
}

// ── Styles ───────────────────────────────────────────────────────────────────
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
  // Title page
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
  // How to use this book
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
  // Table of contents
  tocTitle: { fontSize: 18, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 20 },
  tocChapterRow: { marginBottom: 8 },
  tocChapterText: { fontSize: 10, fontFamily: "BookSans-Bold", color: "#0C1A3D" },
  tocLessonRow: { paddingLeft: 14, marginBottom: 3 },
  tocLessonText: { fontSize: 9, color: "#555555" },
  dotLeader: {
    flex: 1, borderBottomWidth: 0.7, borderBottomColor: "#bbbbbb",
    borderBottomStyle: "dotted", marginHorizontal: 4, marginBottom: 2,
  },
  // Chapter opener
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
  // Topic summary table
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
  // Topic (lesson) header
  topicLabel: {
    fontSize: 7, color: "#D4A017", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 2, marginBottom: 3,
  },
  topicTitle: { fontSize: 13, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 4 },
  topicMeta: { fontSize: 9, color: "#777777", marginBottom: 6 },
  topicRule: { borderBottomWidth: 0.5, borderBottomColor: "#D4A017", marginBottom: 14 },
  // Question block
  questionOuter: {
    marginBottom: 16, paddingLeft: 12, paddingTop: 10, paddingBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#D4A017", backgroundColor: "#fafafa",
  },
  questionOuterScenario: { borderLeftColor: "#C9982A" },
  scenarioLabel: {
    fontSize: 6, color: "#C9982A", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 4,
  },
  questionHeaderRow: { flexDirection: "row", justifyContent: "space-between" },
  questionNum: { fontSize: 9, color: "#0C1A3D", fontFamily: "BookSans-Bold", letterSpacing: 0.5 },
  questionMeta: { fontSize: 7, color: "#999999" },
  questionText: { fontSize: 10, color: "#111111", lineHeight: 1.75, marginTop: 6, marginBottom: 10 },
  optionRow: { flexDirection: "row", marginBottom: 5 },
  optionLetter: { fontSize: 9, color: "#0C1A3D", fontFamily: "BookSans-Bold", width: 18 },
  optionText: { fontSize: 9, color: "#333333", flex: 1, lineHeight: 1.6 },
  // End of chapter
  endChapterWrap: { marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#dddddd" },
  endChapterText: { fontSize: 9, color: "#aaaaaa", textAlign: "center" },
  // Answers section
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
    backgroundColor: "#0C1A3D", borderRadius: 8, width: 18, height: 14,
    alignItems: "center", justifyContent: "center",
  },
  ansCircleText: { fontSize: 8, color: "#ffffff", fontFamily: "BookSans-Bold" },
  conceptText: { fontSize: 9, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 4 },
  workedLabel: {
    fontSize: 7, color: "#0C1A3D", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2,
  },
  workedText: {
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
  pitfallLabel: { fontSize: 7, color: "#C9982A", fontFamily: "BookSans-Bold" },
  pitfallText: { fontSize: 8, color: "#555555" },
  ansSeparator: { borderBottomWidth: 0.5, borderBottomColor: "#eeeeee", marginTop: 6, marginBottom: 8 },
  // Closing pages
  notesHeading: { fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 16 },
  noteLine: { borderBottomWidth: 0.5, borderBottomColor: "#dddddd", height: 22 },
  aboutWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  aboutBody: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, textAlign: "center", maxWidth: 300 },
  aboutSite: { fontSize: 10, fontFamily: "BookSans-Bold", color: "#0C1A3D", textAlign: "center", marginTop: 14 },
  aboutDisclaimer: { fontSize: 8, color: "#666666", lineHeight: 1.6, textAlign: "center", maxWidth: 320 },
})

// ── Props ─────────────────────────────────────────────────────────────────────
interface PracticeKitTemplateProps {
  course: any
  edition: string
  subtitle: string
  pageMap?: Record<string, number>
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PracticeKitTemplate({ course, edition, subtitle, pageMap }: PracticeKitTemplateProps) {
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
      {/* ── 1. Title Page ────────────────────────────────────────────────── */}
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

      {/* ── 2. How to Use This Book ─────────────────────────────────────────── */}
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

      {/* ── 3. Table of Contents ─────────────────────────────────────────────── */}
      <Page size={[W, H]} style={s.page}>
        <Text style={s.tocTitle}>Contents</Text>
        {qIndex.map(({ ci, chapter, lessons }) => (
          <View key={chapter._key || ci}>
            <View style={s.tocChapterRow}>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text style={s.tocChapterText}>Chapter {ci + 1}: {sanitise(chapter.chapterTitle)}</Text>
                <View style={s.dotLeader} />
                <Text style={s.tocChapterText}>{pageFor("ch-" + ci)}</Text>
              </View>
            </View>
            {lessons.map(({ li, lesson }) => (
              <View key={lesson._id || li} style={s.tocLessonRow}>
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <Text style={s.tocLessonText}>{sanitise(lesson.title)}</Text>
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

      {/* ── 4. Chapters ──────────────────────────────────────────────────────── */}
      {qIndex.map(({ ci, chapter, lessons, totalQuestions: chapterTotalQ }) => (
        <Page key={chapter._key || ci} size={[W, H]} style={s.page}>
          <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
          <View style={s.runningLine} fixed />

          {/* 4a. Chapter opener */}
          <View style={s.chapterWrap}>
            <Text style={s.chapterLabel}>Chapter {ci + 1}</Text>
            <Text style={s.chapterTitle}>{sanitise(chapter.chapterTitle)}</Text>
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
                <Text style={[s.tableCell, { flex: 2 }]}>{truncate(lesson.title, 45)}</Text>
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

          {/* 4b. Topics and questions */}
          {lessons.map(({ li, lesson, questions }) => (
            <View key={lesson._id || li}>
              <View style={{ marginTop: 20 }} minPresenceAhead={120} wrap={false}>
                <Text style={s.topicLabel}>Topic {ci + 1}.{li + 1}</Text>
                <Text style={s.topicTitle}>{sanitise(lesson.title)}</Text>
                <Text style={s.topicMeta}>{questions.length} questions  |  {questions.length * 2} marks  |  ~{questions.length * 2} minutes</Text>
                <View style={s.topicRule} />
              </View>

              {questions.map(({ q, num }) => {
                const rawText = sanitise(q.questionText || "")
                const isScenario = rawText.startsWith("SCENARIO:")
                const displayText = isScenario ? rawText.slice("SCENARIO:".length).trim() : rawText
                return (
                  <View
                    key={num}
                    style={[s.questionOuter, isScenario ? s.questionOuterScenario : {}]}
                    wrap={false}
                  >
                    {isScenario ? <Text style={s.scenarioLabel}>Scenario Question</Text> : null}
                    <View style={s.questionHeaderRow}>
                      <Text style={s.questionNum}>Q{num}</Text>
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

          {/* End of chapter */}
          <View style={s.endChapterWrap}>
            <Text style={s.endChapterText}>End of Chapter {ci + 1} - {chapterTotalQ} questions</Text>
          </View>

          <Text style={s.pageNum} render={({ pageNumber }) => String(pageNumber)} fixed />
        </Page>
      ))}

      {/* ── 5. Answers and Explanations ──────────────────────────────────────── */}
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
            <Text style={s.ansChapterHeader}>Chapter {ci + 1}: {sanitise(chapter.chapterTitle)}</Text>
            <View style={s.ansChapterRule} />

            {lessons.map(({ li, lesson, questions }) => (
              <View key={lesson._id || li}>
                <Text style={s.ansTopicHeader}>Topic {ci + 1}.{li + 1}: {sanitise(lesson.title)}</Text>

                {questions.map(({ q, num }, qi) => {
                  const parsed = parseExplanation(sanitise(q.explanation || ""))
                  const letter = LETTERS[q.correctIndex ?? 0]
                  const isLast = qi === questions.length - 1
                  return (
                    <View key={num} style={s.ansBlockWrap}>
                      <View style={s.ansHeaderRow}>
                        <Text style={s.ansQNum}>Q{num}:</Text>
                        <View style={s.ansCircle}>
                          <Text style={s.ansCircleText}>{letter}</Text>
                        </View>
                      </View>

                      {parsed.concept ? <Text style={s.conceptText}>{parsed.concept}</Text> : null}

                      {parsed.caseWalkthrough ? [
                        <Text key="wl" style={s.workedLabel}>Worked:</Text>,
                        <Text key="wt" style={s.workedText}>{parsed.caseWalkthrough}</Text>,
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

      {/* ── 6. Closing Pages ─────────────────────────────────────────────────── */}
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
