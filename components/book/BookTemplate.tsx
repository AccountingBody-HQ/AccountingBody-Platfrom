// components/book/BookTemplate.tsx
// Accounting Body Press - PDF Interior Template
// KDP 6x9 inch, black and white, Helvetica
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"

// Disable hyphenation globally - prevents mid-word breaks in titles and headings
Font.registerHyphenationCallback((word: string) => [word])

// ── Dimensions ──────────────────────────────────────────────────────────────
const W = 6 * 72   // 432pt
const H = 9 * 72   // 648pt
const MT = 0.75 * 72  // margin top
const MB = 0.75 * 72  // margin bottom
const MI = 0.75 * 72  // margin inside
const MO = 0.5  * 72  // margin outside

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MT + 20, paddingBottom: MB,
    paddingLeft: MI, paddingRight: MO,
    fontFamily: "Helvetica", backgroundColor: "#ffffff",
  },
  // Running header
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
  // Copyright page
  copyrightPage: { flex: 1, justifyContent: "flex-end" },
  copyrightText: { fontSize: 8, color: "#666666", lineHeight: 1.6, marginBottom: 3 },
  // Table of contents
  tocTitle: {
    fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginBottom: 20,
  },
  tocChapterRow: { marginBottom: 8 },
  tocChapterText: {
    fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
  },
  tocLessonRow: { paddingLeft: 14, marginBottom: 3 },
  tocLessonText: { fontSize: 9, color: "#555555" },
  // Chapter header
  chapterWrap: { marginBottom: 24 },
  chapterLabel: {
    fontSize: 8, color: "#D4A017", fontFamily: "Helvetica-Bold",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6,
  },
  chapterTitle: {
    fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginBottom: 8, lineHeight: 1.2,
  },
  chapterRule: {
    borderBottomWidth: 2, borderBottomColor: "#D4A017", marginBottom: 20,
  },
  // Lesson
  lessonTitle: {
    fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 20, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#D4A017", paddingLeft: 8,
  },
  // Article
  articleTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 14, marginBottom: 6,
  },
  // Body text blocks
  h2: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D",
    marginTop: 14, marginBottom: 5,
  },
  h3: {
    fontSize: 10, fontFamily: "Helvetica-Bold", color: "#444444",
    marginTop: 10, marginBottom: 4,
  },
  body: {
    fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, marginBottom: 8,
  },
  noContent: { fontSize: 9, color: "#aaaaaa", marginBottom: 6 },
  // Lists
  listRow: { flexDirection: "row", marginBottom: 6, paddingLeft: 6 },
  listDot: { fontSize: 10, color: "#D4A017", width: 16, marginTop: 1 },
  listText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, flex: 1 },
  // Practice questions
  sectionRule: {
    borderTopWidth: 1, borderTopColor: "#dddddd",
    marginTop: 20, marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0C1A3D", marginBottom: 10,
  },
  questionWrap: {
    marginBottom: 14, paddingLeft: 10, paddingTop: 8, paddingBottom: 8,
    borderLeftWidth: 2.5, borderLeftColor: "#D4A017",
  },
  questionLabel: {
    fontSize: 8, color: "#D4A017", fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5, marginBottom: 4,
  },
  questionText: { fontSize: 10, color: "#111111", lineHeight: 1.7, marginBottom: 8 },
  optionRow: { flexDirection: "row", marginBottom: 4 },
  optionLetter: {
    fontSize: 9, color: "#0C1A3D", fontFamily: "Helvetica-Bold", width: 18,
  },
  optionText: { fontSize: 9, color: "#333333", flex: 1, lineHeight: 1.6 },
  // Answer key
  answerWrap: { marginBottom: 10 },
  answerLabel: {
    fontSize: 9, color: "#D4A017", fontFamily: "Helvetica-Bold", marginBottom: 2,
  },
  answerText: { fontSize: 9, color: "#333333", lineHeight: 1.6 },
})

// ── Unicode sanitiser ────────────────────────────────────────────────────────
// Helvetica only supports the standard Latin-1 character set.
// Replace common Unicode characters with safe ASCII equivalents.
function sanitise(text: string): string {
  if (!text) return ""
  return text
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
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

// ── Visibility check ─────────────────────────────────────────────────────────
function hasText(raw: string): boolean {
  return raw.replace(/[\s ​‌‍﻿]/g, "").length > 0
}

// ── Span renderer ─────────────────────────────────────────────────────────────
// Renders children spans from a Sanity block with bold/italic support.
// Each span is wrapped in its own <Text> to avoid React PDF inline flow issues.
// Spaces are injected between spans where the CMS removed them.
const NO_SPACE_BEFORE = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}", "%"])
const NO_SPACE_AFTER  = new Set(["(", "[", "{", "'", '"'])

function renderSpans(children: any[]): React.ReactNode {
  if (!children || children.length === 0) return null
  const nodes: React.ReactNode[] = []
  let lastRenderedText = "" // track last actually-rendered text
  children.forEach((c: any, i: number) => {
    const raw = sanitise(c.text || "")
    if (!raw) return
    const marks: string[] = c.marks || []
    const isBold   = marks.includes("strong")
    const isItalic = marks.includes("em")
    // Inject space between spans if the CMS dropped it
    if (lastRenderedText.length > 0 && raw.length > 0) {
      const lastChar  = lastRenderedText[lastRenderedText.length - 1]
      const firstChar = raw[0]
      // Always inject space between two word characters with no gap
      const needsSpace =
        lastChar !== " " &&
        firstChar !== " " &&
        !NO_SPACE_BEFORE.has(firstChar) &&
        !NO_SPACE_AFTER.has(lastChar)
      if (needsSpace) {
        nodes.push(<Text key={"sp" + i}>{" "}</Text>)
      }
    }
    const style: any = {}
    if (isBold)   style.fontFamily  = "Helvetica-Bold"
    if (isItalic) style.fontStyle   = "italic"
    nodes.push(<Text key={i} style={style}>{raw}</Text>)
    lastRenderedText = raw
  })
  return nodes.length > 0 ? nodes : null
}

// ── Block renderer ────────────────────────────────────────────────────────────
// Converts a Sanity portable text block array into React PDF elements.
// Handles: headings (h1-h4), normal paragraphs, bullet lists, numbered lists.
// Empty blocks and invisible-only blocks are silently skipped.
function renderBlocks(blocks: any[]): React.ReactNode {
  if (!blocks || !Array.isArray(blocks)) return null
  const out: React.ReactElement[] = []
  let listBuf: any[] = []
  let listKey = 0

  function flushList() {
    if (listBuf.length === 0) return
    let num = 0
    listBuf.forEach((item, idx) => {
      const rawText = (item.children || []).map((c: any) => c.text || "").join("")
      if (!hasText(sanitise(rawText))) return // skip empty list items
      const content = renderSpans(item.children || [])
      if (!content) return // skip if all spans were empty after sanitise
      let dot: string
      if (item.listItem === "number") {
        num++
        dot = `${num}.`
      } else {
        dot = "•"
      }
      out.push(
        <View key={`list-${listKey}-${idx}`} style={s.listRow} wrap={false}>
          <Text style={s.listDot}>{dot}</Text>
          <Text style={s.listText}>{content}</Text>
        </View>
      )
    })
    listBuf = []
    listKey++
  }

  const skippedIndex = new Set<number>()
  blocks.forEach((b: any, i: number) => {
    if (b._type !== "block") return
    if (skippedIndex.has(i)) return
    const children = b.children || []
    const rawText  = children.map((c: any) => c.text || "").join("")
    if (!hasText(rawText)) { flushList(); return }

    // List items go into buffer
    if (b.listItem) {
      listBuf.push(b)
      return
    }

    flushList()

    const style = b.style || "normal"
    const content = renderSpans(children)

    const isHeading = style === "h1" || style === "h2" || style === "h3" || style === "h4" || style === "h5"
    if (isHeading) {
      let nextContent: React.ReactNode = null
      for (let j = i + 1; j < blocks.length; j++) {
        const nb = blocks[j]
        if (nb._type !== "block" || nb.listItem) continue
        const nbStyle = nb.style || "normal"
        if (nbStyle === "h1" || nbStyle === "h2" || nbStyle === "h3" || nbStyle === "h4" || nbStyle === "h5") break
        const nRaw = (nb.children || []).map((c: any) => c.text || "").join("")
        if (!hasText(nRaw)) continue
        nextContent = renderSpans(nb.children || [])
        skippedIndex.add(j)
        break
      }
      const headingEl = style === "h1"
        ? <Text style={s.articleTitle}>{content}</Text>
        : style === "h2"
        ? <Text style={s.h2}>{content}</Text>
        : <Text style={s.h3}>{content}</Text>
      out.push(
        <View key={i} wrap={false} minPresenceAhead={42}>
          {headingEl}
          {nextContent ? <Text style={s.body}>{nextContent}</Text> : null}
        </View>
      )
    } else if (style === "blockquote") {
      out.push(<Text key={i} style={[s.body, { color: "#555555", paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#cccccc" }]}>{content}</Text>)
    } else {
      out.push(<Text key={i} style={s.body}>{content}</Text>)
    }
  })

  flushList()
  return out.length > 0 ? out : null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LETTERS = ["A", "B", "C", "D", "E"]

const EXPLANATION_KEYS = [
  "OVERVIEW:",
  "DATA (INPUTS & ASSUMPTIONS):",
  "METHOD:",
  "SOLUTION (STEP-BY-STEP):",
  "APPLY TO THIS CASE:",
  "KEY TAKEAWAY:",
  "COMMON PITFALL:",
]

function formatExplanation(text: string): React.ReactElement[] {
  const out: React.ReactElement[] = []
  let remaining = text.trim()
  let keyIndex = 0

  while (remaining.length > 0) {
    let nextKeyPos = -1
    let nextKey = ""
    for (const key of EXPLANATION_KEYS) {
      const pos = remaining.indexOf(key, 1)
      if (pos > 0 && (nextKeyPos === -1 || pos < nextKeyPos)) {
        nextKeyPos = pos
        nextKey = key  // eslint-disable-line @typescript-eslint/no-unused-vars
      }
    }

    let chunk: string
    if (nextKeyPos === -1) {
      chunk = remaining
      remaining = ""
    } else {
      chunk = remaining.slice(0, nextKeyPos)
      remaining = remaining.slice(nextKeyPos)
    }

    chunk = chunk.trim()
    if (!chunk) continue

    const colonPos = chunk.indexOf(":")
    if (colonPos > 0 && colonPos < 40) {
      const label = chunk.slice(0, colonPos).trim()
      const body = chunk.slice(colonPos + 1).trim()
      out.push(
        <View key={keyIndex++} style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 8, color: "#D4A017", fontFamily: "Helvetica-Bold", marginBottom: 1 }}>{label}</Text>
          {body ? <Text style={{ fontSize: 8.5, color: "#333333", lineHeight: 1.5 }}>{body}</Text> : null}
        </View>
      )
    } else {
      out.push(
        <Text key={keyIndex++} style={{ fontSize: 8.5, color: "#333333", lineHeight: 1.5, marginBottom: 4 }}>{chunk}</Text>
      )
    }
  }
  return out
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BookTemplateProps {
  course:   any
  bookType: "combined" | "study" | "practice"
  edition:  string
  subtitle: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BookTemplate({ course, bookType, edition, subtitle }: BookTemplateProps) {
  const year         = new Date().getFullYear()
  const showNotes    = bookType === "combined" || bookType === "study"
  const showQuestions = bookType === "combined" || bookType === "practice"

  function renderFirstBlock(body: any[]): React.ReactNode {
    for (const b of (body || [])) {
      if (b._type !== 'block' || b.listItem) continue
      const spans = renderSpans(b.children || [])
      if (!spans) continue
      const st = b.style || 'normal'
      if (st === 'h1' || st === 'h2') return <Text style={s.h2}>{spans}</Text>
      if (st === 'h3' || st === 'h4' || st === 'h5') return <Text style={s.h3}>{spans}</Text>
      return <Text style={s.body}>{spans}</Text>
    }
    return null
  }
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

      {/* ── Title Page ───────────────────────────────────────────────────── */}
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

      {/* ── Copyright Page ───────────────────────────────────────────────── */}
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

      {/* ── Table of Contents ────────────────────────────────────────────── */}
      <Page size={[W, H]} style={s.page}>
        <Text style={s.tocTitle}>Contents</Text>
        {(course.chapters || []).map((ch: any, ci: number) => (
          <View key={ch._key || ci} style={s.tocChapterRow}>
            <Text style={s.tocChapterText}>
              Chapter {ci + 1}: {sanitise(ch.chapterTitle)}
            </Text>
          </View>
        ))}
      </Page>

      {/* ── Chapters ─────────────────────────────────────────────────────── */}
      {(course.chapters || []).map((ch: any, ci: number) => (
        <Page key={ch._key || ci} size={[W, H]} style={s.page}>

          <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
          <View style={s.runningLine} fixed />

          {/* Chapter header */}
          <View style={s.chapterWrap}>
            <Text style={s.chapterLabel}>Chapter {ci + 1}</Text>
            <Text style={s.chapterTitle}>{sanitise(ch.chapterTitle)}</Text>
            <View style={s.chapterRule} />
          </View>

          {/* Lessons */}
          {(ch.lessons || []).map((ls: any, li: number) => (
            <View key={ls._id || li}>
              {(!showNotes || !ls.linkedArticles || ls.linkedArticles.length === 0) && (
                <Text style={s.lessonTitle}>{sanitise(ls.title)}</Text>
              )}
              {/* Study Notes */}
              {showNotes && (ls.linkedArticles || []).map((art: any, ai: number) => {
                const firstIdx = ai === 0
                  ? (art.body || []).findIndex((b: any) => b._type === "block" && !b.listItem && hasText((b.children || []).map((c: any) => c.text || "").join("")))
                  : -1
                const bodyToRender = firstIdx >= 0
                  ? [...(art.body || []).slice(0, firstIdx), ...(art.body || []).slice(firstIdx + 1)]
                  : (art.body || [])
                return (
                  <View key={art._id || ai}>
                    {ai === 0 ? (
                      <View wrap={false} minPresenceAhead={150}>
                        <Text style={s.lessonTitle}>{sanitise(ls.title)}</Text>
                        <Text style={s.articleTitle}>{sanitise(art.title)}</Text>
                        {renderFirstBlock(art.body || [])}
                      </View>
                    ) : (
                      <Text style={s.articleTitle}>{sanitise(art.title)}</Text>
                    )}
                    {bodyToRender && bodyToRender.length > 0
                      ? renderBlocks(bodyToRender)
                      : (firstIdx === -1 ? <Text style={s.noContent}>Study notes not yet available.</Text> : null)
                    }
                  </View>
                )
              })}
              {/* Practice Questions */}
              {showQuestions && (ls.linkedArticles || []).map((art: any, ai: number) => {
                const qs = art.quizQuestions || []
                if (qs.length === 0) return null
                return (
                  <View key={"q-" + (art._id || ai)}>
                    <View style={s.sectionRule} />
                    <Text style={s.sectionHeader}>Practice Questions</Text>
                    {qs.map((q: any, qi: number) => (
                      <View key={qi} style={s.questionWrap} wrap={false}>
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
                        <Text style={s.answerLabel}>
                          Q{qi + 1}: {LETTERS[q.correctIndex ?? 0]}
                        </Text>
                        {q.explanation
                          ? <View>{formatExplanation(sanitise(q.explanation))}</View>
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
