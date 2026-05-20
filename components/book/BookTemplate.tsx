// components/book/BookTemplate.tsx
// Accounting Body Press - PDF Interior Template
// KDP spec: 6x9 inch, black and white, embedded fonts
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer"

const W = 6 * 72
const H = 9 * 72
const MARGIN_TOP    = 0.75 * 72
const MARGIN_BOTTOM = 0.75 * 72
const MARGIN_INSIDE = 0.75 * 72
const MARGIN_OUTSIDE = 0.5 * 72

const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MARGIN_TOP + 16,
    paddingBottom: MARGIN_BOTTOM,
    paddingLeft: MARGIN_INSIDE,
    paddingRight: MARGIN_OUTSIDE,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  titlePage: { flex: 1, justifyContent: "center", alignItems: "center" },
  publisherLabel: {
    fontSize: 9, color: "#666666", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 1,
  },
  bookTitle: {
    fontSize: 26, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    textAlign: "center", marginBottom: 8,
  },
  bookSubtitle: { fontSize: 13, color: "#333333", textAlign: "center", marginBottom: 24 },
  editionText: { fontSize: 10, color: "#666666", textAlign: "center" },
  divider: {
    borderBottomWidth: 1, borderBottomColor: "#D4A017",
    marginVertical: 16, width: "60%", alignSelf: "center",
  },
  copyrightPage: { flex: 1, justifyContent: "flex-end" },
  copyrightText: { fontSize: 8, color: "#666666", marginBottom: 4 },
  tocTitle: {
    fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginBottom: 16,
  },
  tocChapter: { marginBottom: 6 },
  tocChapterText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0C1A3D" },
  tocLesson: { marginBottom: 3, paddingLeft: 12 },
  tocLessonText: { fontSize: 9, color: "#555555" },
  chapterHeader: { marginBottom: 20 },
  chapterNumber: {
    fontSize: 9, color: "#D4A017", fontFamily: "Helvetica-Bold",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 20, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginBottom: 6,
  },
  chapterDivider: { borderBottomWidth: 1.5, borderBottomColor: "#D4A017", marginBottom: 18 },
  lessonTitle: {
    fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 18, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#D4A017", paddingLeft: 8,
  },
  articleTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 14, marginBottom: 6,
  },
  h2Style: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 12, marginBottom: 5,
  },
  h3Style: {
    fontSize: 10, fontFamily: "Helvetica-Bold", color: "#333333",
    marginTop: 10, marginBottom: 4,
  },
  bodyText: {
    fontSize: 10, color: "#222222", lineHeight: 1.8, marginBottom: 8,
  },
  boldSpan: { fontFamily: "Helvetica-Bold" },
  italicSpan: { fontStyle: "italic" },
  bulletRow: { flexDirection: "row", marginBottom: 5, paddingLeft: 8 },
  bulletDot: { fontSize: 10, color: "#D4A017", width: 14 },
  bulletText: { fontSize: 10, color: "#222222", lineHeight: 1.8, flex: 1 },
  noContent: { fontSize: 10, color: "#999999", lineHeight: 1.8, marginBottom: 8 },
  practiceHeader: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 20, marginBottom: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#cccccc",
  },
  questionBox: {
    marginBottom: 12, paddingTop: 8, paddingBottom: 8,
    paddingLeft: 10, paddingRight: 8,
    borderLeftWidth: 2.5, borderLeftColor: "#D4A017",
    backgroundColor: "#fafafa",
  },
  questionNumber: {
    fontSize: 8, color: "#D4A017", fontFamily: "Helvetica-Bold",
    marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
  },
  questionText: { fontSize: 10, color: "#111111", marginBottom: 8, lineHeight: 1.7 },
  optionRow: { flexDirection: "row", marginBottom: 4 },
  optionLabel: {
    fontSize: 9, color: "#0C1A3D", width: 18, fontFamily: "Helvetica-Bold",
  },
  optionText: { fontSize: 9, color: "#333333", flex: 1, lineHeight: 1.6 },
  answerHeader: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 16, marginBottom: 8, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "#cccccc",
  },
  answerRow: { marginBottom: 10 },
  answerLabel: {
    fontSize: 9, color: "#D4A017", fontFamily: "Helvetica-Bold", marginBottom: 3,
  },
  answerText: { fontSize: 9, color: "#333333", lineHeight: 1.6 },
  pageNum: {
    position: "absolute", bottom: 20, right: MARGIN_OUTSIDE,
    fontSize: 8, color: "#999999",
  },
  runningHead: {
    position: "absolute", top: 14, right: MARGIN_OUTSIDE,
    fontSize: 7, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: 0.5,
  },
  runningLine: {
    position: "absolute", top: 26, left: MARGIN_INSIDE, right: MARGIN_OUTSIDE,
    borderBottomWidth: 0.5, borderBottomColor: "#dddddd",
  },
})

// ---- Inline span renderer --------------------------------------------------
function renderSpans(children: any[]): React.ReactNode {
  if (!children || children.length === 0) return null
  // Always wrap every span in its own Text so React PDF preserves spacing
  return children.map((c: any, i: number) => {
    const text = c.text || ""
    const marks: string[] = c.marks || []
    const isBold = marks.includes("strong")
    const isItalic = marks.includes("em")
    const spanStyle: any = {}
    if (isBold) spanStyle.fontFamily = "Helvetica-Bold"
    if (isItalic) spanStyle.fontStyle = "italic"
    return <Text key={i} style={spanStyle}>{text}</Text>
  })
}

// ---- Portable text block renderer ------------------------------------------
function renderBlocks(blocks: any[]): React.ReactNode {
  if (!blocks || !Array.isArray(blocks)) return null
  const elements: React.ReactElement[] = []
  let listBuffer: any[] = []

  function flushList() {
    if (listBuffer.length === 0) return
    let numCounter = 0
    listBuffer.forEach((item, idx) => {
      const text = renderSpans(item.children || [])
      let dot: string
      if (item.listItem === "number") {
        numCounter++
        dot = `${numCounter}.`
      } else {
        numCounter = 0
        dot = "•"
      }
      elements.push(
        <View key={"list-" + elements.length + "-" + idx} style={s.bulletRow}>
          <Text style={s.bulletDot}>{dot}</Text>
          <Text style={s.bulletText}>{text}</Text>
        </View>
      )
    })
    listBuffer = []
  }

  blocks.forEach((b: any, i: number) => {
    if (b._type !== "block") return
    const style = b.style || "normal"
    const children = b.children || []
    const rawText = children.map((c: any) => c.text || "").join("").trim()
    if (!rawText) { flushList(); return }

    if (b.listItem) {
      if (rawText) listBuffer.push(b)
      return
    }

    flushList()

    if (style === "h1") {
      elements.push(
        <Text key={i} style={s.articleTitle}>{renderSpans(children)}</Text>
      )
    } else if (style === "h2") {
      elements.push(
        <Text key={i} style={s.h2Style}>{renderSpans(children)}</Text>
      )
    } else if (style === "h3" || style === "h4") {
      elements.push(
        <Text key={i} style={s.h3Style}>{renderSpans(children)}</Text>
      )
    } else {
      elements.push(
        <Text key={i} style={s.bodyText}>{renderSpans(children)}</Text>
      )
    }
  })

  flushList()
  return elements.length > 0 ? elements : null
}

const LETTERS = ["A", "B", "C", "D", "E"]

interface BookTemplateProps {
  course: any
  bookType: "combined" | "study" | "practice"
  edition: string
  subtitle: string
}

export function BookTemplate({ course, bookType, edition, subtitle }: BookTemplateProps) {
  const year = new Date().getFullYear()
  const showNotes = bookType === "combined" || bookType === "study"
  const showQuestions = bookType === "combined" || bookType === "practice"
  const bookTypeLabel =
    bookType === "combined" ? "Study Text & Practice Kit"
    : bookType === "study" ? "Study Text"
    : "Practice & Revision Kit"

  return (
    <Document
      title={subtitle}
      author="Accounting Body Editorial Team"
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      {/* ── Title Page ── */}
      <Page size={[W, H]} style={s.page}>
        <View style={s.titlePage}>
          <Text style={s.publisherLabel}>Accounting Body Press</Text>
          <View style={s.divider} />
          <Text style={s.bookTitle}>{subtitle}</Text>
          <Text style={s.bookSubtitle}>{bookTypeLabel}</Text>
          <View style={s.divider} />
          <Text style={s.editionText}>{edition}</Text>
        </View>
      </Page>

      {/* ── Copyright Page ── */}
      <Page size={[W, H]} style={s.page}>
        <View style={s.copyrightPage}>
          <Text style={s.copyrightText}>Published by Accounting Body Press</Text>
          <Text style={s.copyrightText}>Copyright {year} Accounting Body Press. All rights reserved.</Text>
          <Text style={s.copyrightText}>Written by the Accounting Body Editorial Team.</Text>
          <Text style={[s.copyrightText, { marginTop: 8 }]}>
            Accounting Body is an independent study platform and is not affiliated with, endorsed by,
            or connected to ACCA, CIMA, ICAEW, or AAT. These names are used solely to identify the
            qualifications our study materials are designed to support.
          </Text>
          <Text style={[s.copyrightText, { marginTop: 8 }]}>
            No part of this publication may be reproduced without prior written permission.
          </Text>
        </View>
      </Page>

      {/* ── Table of Contents ── */}
      <Page size={[W, H]} style={s.page}>
        <Text style={s.tocTitle}>Contents</Text>
        {(course.chapters || []).map((ch: any, ci: number) => (
          <View key={ch._key || ci}>
            <View style={s.tocChapter}>
              <Text style={s.tocChapterText}>Chapter {ci + 1}: {ch.chapterTitle}</Text>
            </View>
            {(ch.lessons || []).map((ls: any, li: number) => (
              <View key={ls._id || li} style={s.tocLesson}>
                <Text style={s.tocLessonText}>{ls.title}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>

      {/* ── Chapters — each chapter is its own Page ── */}
      {(course.chapters || []).map((ch: any, ci: number) => (
        <Page key={ch._key || ci} size={[W, H]} style={s.page}>

          {/* Running header */}
          <Text style={s.runningHead} fixed>{subtitle}</Text>
          <View style={s.runningLine} fixed />

          {/* Chapter header */}
          <View style={s.chapterHeader}>
            <Text style={s.chapterNumber}>Chapter {ci + 1}</Text>
            <Text style={s.chapterTitle}>{ch.chapterTitle}</Text>
            <View style={s.chapterDivider} />
          </View>

          {/* Lessons */}
          {(ch.lessons || []).map((ls: any, li: number) => (
            <View key={ls._id || li}>
              <Text style={s.lessonTitle}>{ls.title}</Text>

              {/* Study Notes */}
              {showNotes && (ls.linkedArticles || []).map((art: any, ai: number) => (
                <View key={art._id || ai}>
                  <Text style={s.articleTitle}>{art.title}</Text>
                  {art.body && art.body.length > 0
                    ? renderBlocks(art.body)
                    : <Text style={s.noContent}>Study notes not yet available.</Text>
                  }
                </View>
              ))}

              {/* Practice Questions */}
              {showQuestions && (ls.linkedArticles || []).map((art: any, ai: number) => {
                const qs = art.quizQuestions || []
                if (qs.length === 0) return null
                return (
                  <View key={"q-" + (art._id || ai)}>
                    <Text style={s.practiceHeader}>Practice Questions</Text>
                    {qs.map((q: any, qi: number) => (
                      <View key={qi} style={s.questionBox}>
                        <Text style={s.questionNumber}>Question {qi + 1}</Text>
                        <Text style={s.questionText}>{q.questionText}</Text>
                        {(q.options || []).map((opt: any, oi: number) => (
                          <View key={oi} style={s.optionRow}>
                            <Text style={s.optionLabel}>{LETTERS[oi]}.</Text>
                            <Text style={s.optionText}>{opt}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    <Text style={s.answerHeader}>Answer Key</Text>
                    {qs.map((q: any, qi: number) => (
                      <View key={"a-" + qi} style={s.answerRow}>
                        <Text style={s.answerLabel}>
                          Q{qi + 1}: {LETTERS[q.correctIndex ?? 0]}
                        </Text>
                        {q.explanation
                          ? <Text style={s.answerText}>{q.explanation}</Text>
                          : null}
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          ))}

          <Text style={s.pageNum} render={({ pageNumber }) => String(pageNumber)} fixed />
        </Page>
      ))}
    </Document>
  )
}
