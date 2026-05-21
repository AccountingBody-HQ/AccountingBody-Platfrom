// components/book/BookTemplate.tsx
// Accounting Body Press - PDF Interior Template
// KDP 6x9 inch, black and white, Helvetica
// Uses @portabletext/react with custom React PDF components
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"
import { PortableText } from "@portabletext/react"

// Disable hyphenation globally
Font.registerHyphenationCallback((word: string) => [word])

// ── Dimensions ───────────────────────────────────────────────────────────────
const W  = 6 * 72
const H  = 9 * 72
const MT = 0.75 * 72
const MB = 0.75 * 72
const MI = 0.75 * 72
const MO = 0.5  * 72

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MT + 20, paddingBottom: MB,
    paddingLeft: MI, paddingRight: MO,
    fontFamily: "Helvetica", backgroundColor: "#ffffff",
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
  publisherLabel: {
    fontSize: 9, color: "#888888", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 1.5,
  },
  bookTitle: {
    fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    textAlign: "center", marginBottom: 10, lineHeight: 1.3,
  },
  bookTypeLabel: { fontSize: 12, color: "#555555", textAlign: "center", marginBottom: 20 },
  editionText: { fontSize: 9, color: "#888888", textAlign: "center" },
  titleDivider: {
    borderBottomWidth: 1, borderBottomColor: "#D4A017",
    marginVertical: 18, width: "50%", alignSelf: "center",
  },
  copyrightPage: { flex: 1, justifyContent: "flex-end" },
  copyrightText: { fontSize: 8, color: "#666666", lineHeight: 1.6, marginBottom: 3 },
  tocTitle: {
    fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginBottom: 20,
  },
  tocChapterRow: { marginBottom: 8 },
  tocChapterText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0C1A3D" },
  tocLessonRow: { paddingLeft: 14, marginBottom: 3 },
  tocLessonText: { fontSize: 9, color: "#555555" },
  chapterWrap: { marginBottom: 24 },
  chapterLabel: {
    fontSize: 8, color: "#D4A017", fontFamily: "Helvetica-Bold",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6,
  },
  chapterTitle: {
    fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginBottom: 8, lineHeight: 1.2,
  },
  chapterRule: { borderBottomWidth: 2, borderBottomColor: "#D4A017", marginBottom: 20 },
  lessonTitle: {
    fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 20, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#D4A017", paddingLeft: 8,
  },
  articleTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 14, marginBottom: 6,
  },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginTop: 14, marginBottom: 5 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#444444", marginTop: 10, marginBottom: 4 },
  body: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, marginBottom: 8 },
  blockquote: {
    fontSize: 10, color: "#555555", lineHeight: 1.8, marginBottom: 8,
    paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#cccccc",
  },
  noContent: { fontSize: 9, color: "#aaaaaa", marginBottom: 6 },
  listRow: { flexDirection: "row", marginBottom: 6, paddingLeft: 6 },
  listDot: { fontSize: 10, color: "#D4A017", width: 16, marginTop: 1 },
  listText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, flex: 1 },
  sectionRule: { borderTopWidth: 1, borderTopColor: "#dddddd", marginTop: 20, marginBottom: 12 },
  sectionHeader: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginBottom: 10 },
  questionWrap: {
    marginBottom: 14, paddingLeft: 10, paddingTop: 8, paddingBottom: 8,
    borderLeftWidth: 2.5, borderLeftColor: "#D4A017",
  },
  questionLabel: { fontSize: 8, color: "#D4A017", fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 4 },
  questionText: { fontSize: 10, color: "#111111", lineHeight: 1.7, marginBottom: 8 },
  optionRow: { flexDirection: "row", marginBottom: 4 },
  optionLetter: { fontSize: 9, color: "#0C1A3D", fontFamily: "Helvetica-Bold", width: 18 },
  optionText: { fontSize: 9, color: "#333333", flex: 1, lineHeight: 1.6 },
  answerWrap: { marginBottom: 10 },
  answerLabel: { fontSize: 9, color: "#D4A017", fontFamily: "Helvetica-Bold", marginBottom: 2 },
  answerText: { fontSize: 9, color: "#333333", lineHeight: 1.6 },
})

// ── Unicode sanitiser ─────────────────────────────────────────────────────────
function sanitise(text: string): string {
  if (!text) return ""
  return text
    .replace(/\u2013/g, "-").replace(/\u2014/g, "-").replace(/\u2212/g, "-")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...").replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[\r\n]+/g, " ").replace(/  +/g, " ").trim()
}

// ── Portable text components for React PDF ────────────────────────────────────
// These mirror PortableTextRenderer.tsx but use React PDF primitives
function makePdfComponents(listCounterRef: { num: number }) {
  return {
    block: {
      normal: ({ children }: any) => (
        <Text style={s.body}>{children}</Text>
      ),
      h1: ({ children }: any) => (
        <Text style={s.articleTitle}>{children}</Text>
      ),
      h2: ({ children }: any) => (
        <Text style={s.h2}>{children}</Text>
      ),
      h3: ({ children }: any) => (
        <Text style={s.h3}>{children}</Text>
      ),
      h4: ({ children }: any) => (
        <Text style={s.h3}>{children}</Text>
      ),
      h5: ({ children }: any) => (
        <Text style={s.h3}>{children}</Text>
      ),
      blockquote: ({ children }: any) => (
        <Text style={s.blockquote}>{children}</Text>
      ),
    },
    list: {
      bullet: ({ children }: any) => (
        <View>{children}</View>
      ),
      number: ({ children }: any) => (
        <View>{children}</View>
      ),
    },
    listItem: {
      bullet: ({ children }: any) => (
        <View style={s.listRow}>
          <Text style={s.listDot}>{"•"}</Text>
          <Text style={s.listText}>{children}</Text>
        </View>
      ),
      number: ({ children }: any) => {
        listCounterRef.num++
        const n = listCounterRef.num
        return (
          <View style={s.listRow}>
            <Text style={s.listDot}>{n}.</Text>
            <Text style={s.listText}>{children}</Text>
          </View>
        )
      },
    },
    marks: {
      strong: ({ children }: any) => (
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{children}</Text>
      ),
      em: ({ children }: any) => (
        <Text style={{ fontStyle: "italic" }}>{children}</Text>
      ),
      code: ({ children }: any) => (
        <Text style={{ fontFamily: "Courier" }}>{children}</Text>
      ),
      link: ({ children }: any) => (
        <Text style={{ color: "#D4A017" }}>{children}</Text>
      ),
    },
    types: {
      image: () => null,
      code: () => null,
      tableBlock: () => null,
      callout: ({ value }: any) => (
        <Text style={s.body}>{sanitise(value?.body || "")}</Text>
      ),
      quizbankBlock: () => null,
    },
  }
}

// ── Render article body using PortableText ────────────────────────────────────
function renderArticleBody(body: any[]) {
  if (!body || body.length === 0) return null
  const listCounterRef = { num: 0 }
  const components = makePdfComponents(listCounterRef)
  try {
    return (
      <PortableText
        value={body}
        components={components as any}
      />
    )
  } catch {
    return <Text style={s.noContent}>Content unavailable.</Text>
  }
}

const LETTERS = ["A", "B", "C", "D", "E"]

interface BookTemplateProps {
  course:   any
  bookType: "combined" | "study" | "practice"
  edition:  string
  subtitle: string
}

export function BookTemplate({ course, bookType, edition, subtitle }: BookTemplateProps) {
  const year          = new Date().getFullYear()
  const showNotes     = bookType === "combined" || bookType === "study"
  const showQuestions = bookType === "combined" || bookType === "practice"
  const bookTypeLabel =
    bookType === "combined" ? "Study Text & Practice Kit"
    : bookType === "study"  ? "Study Text"
    : "Practice & Revision Kit"

  return (
    <Document
      title={subtitle}
      author="Accounting Body Editorial Team"
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      {/* Title Page */}
      <Page size={[W, H]} style={s.page}>
        <View style={s.titlePage}>
          <Text style={s.publisherLabel}>Accounting Body Press</Text>
          <View style={s.titleDivider} />
          <Text style={s.bookTitle}>{sanitise(subtitle)}</Text>
          <Text style={s.bookTypeLabel}>{bookTypeLabel}</Text>
          <View style={s.titleDivider} />
          <Text style={s.editionText}>{edition}</Text>
        </View>
      </Page>

      {/* Copyright Page */}
      <Page size={[W, H]} style={s.page}>
        <View style={s.copyrightPage}>
          <Text style={s.copyrightText}>Published by Accounting Body Press</Text>
          <Text style={s.copyrightText}>Copyright {year} Accounting Body Press. All rights reserved.</Text>
          <Text style={s.copyrightText}>Written by the Accounting Body Editorial Team.</Text>
          <Text style={[s.copyrightText, { marginTop: 10 }]}>
            Accounting Body is an independent study platform and is not affiliated with, endorsed
            by, or connected to ACCA, CIMA, ICAEW, or AAT. These names are used solely to identify
            the qualifications our study materials are designed to support.
          </Text>
          <Text style={[s.copyrightText, { marginTop: 6 }]}>
            No part of this publication may be reproduced without prior written permission.
          </Text>
        </View>
      </Page>

      {/* Table of Contents */}
      <Page size={[W, H]} style={s.page}>
        <Text style={s.tocTitle}>Contents</Text>
        {(course.chapters || []).map((ch: any, ci: number) => (
          <View key={ch._key || ci} style={s.tocChapterRow}>
            <Text style={s.tocChapterText}>
              Chapter {ci + 1}: {sanitise(ch.chapterTitle)}
            </Text>
            {(ch.lessons || []).map((ls: any, li: number) => (
              <View key={ls._id || li} style={s.tocLessonRow}>
                <Text style={s.tocLessonText}>{sanitise(ls.title)}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>

      {/* Chapters */}
      {(course.chapters || []).map((ch: any, ci: number) => (
        <Page key={ch._key || ci} size={[W, H]} style={s.page}>
          <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
          <View style={s.runningLine} fixed />

          <View style={s.chapterWrap}>
            <Text style={s.chapterLabel}>Chapter {ci + 1}</Text>
            <Text style={s.chapterTitle}>{sanitise(ch.chapterTitle)}</Text>
            <View style={s.chapterRule} />
          </View>

          {(ch.lessons || []).map((ls: any, li: number) => (
            <View key={ls._id || li}>
              <Text style={s.lessonTitle}>{sanitise(ls.title)}</Text>

              {showNotes && (ls.linkedArticles || []).map((art: any, ai: number) => (
                <View key={art._id || ai}>
                  <Text style={s.articleTitle}>{sanitise(art.title)}</Text>
                  {art.body && art.body.length > 0
                    ? renderArticleBody(art.body)
                    : <Text style={s.noContent}>Study notes not yet available.</Text>
                  }
                </View>
              ))}

              {showQuestions && (ls.linkedArticles || []).map((art: any, ai: number) => {
                const qs = art.quizQuestions || []
                if (qs.length === 0) return null
                return (
                  <View key={"q-" + (art._id || ai)}>
                    <View style={s.sectionRule} />
                    <Text style={s.sectionHeader}>Practice Questions</Text>
                    {qs.map((q: any, qi: number) => (
                      <View key={qi} style={s.questionWrap}>
                        <Text style={s.questionLabel}>Question {qi + 1}</Text>
                        <Text style={s.questionText}>{sanitise(q.questionText)}</Text>
                        {(q.options || []).map((opt: any, oi: number) => (
                          <View key={oi} style={s.optionRow}>
                            <Text style={s.optionLetter}>{LETTERS[oi]}.</Text>
                            <Text style={s.optionText}>{sanitise(opt)}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    <View style={s.sectionRule} />
                    <Text style={s.sectionHeader}>Answer Key</Text>
                    {qs.map((q: any, qi: number) => (
                      <View key={"a-" + qi} style={s.answerWrap}>
                        <Text style={s.answerLabel}>Q{qi + 1}: {LETTERS[q.correctIndex ?? 0]}</Text>
                        {q.explanation
                          ? <Text style={s.answerText}>{sanitise(q.explanation)}</Text>
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
