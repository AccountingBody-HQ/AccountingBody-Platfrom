// components/book/ChapterTemplate.tsx
// Accounting Body Press - Single Chapter PDF (chapter-by-chapter generation)
// Renders exactly one chapter's content — no title page, TOC, or answers
// section. Used by generate-chapter/route.ts so large courses render as
// N short serverless calls instead of one long one, merged client-side
// with pdf-lib. Font registrations, styles, and the sanitise/hasText/
// sameTitle/renderSpans/renderBlocks helpers are duplicated from
// BookTemplate.tsx (self-contained pure functions — each serverless
// function is its own isolated module instance, so re-registering fonts
// here does not collide with BookTemplate's own registration).
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

// ── Styles (subset of BookTemplate.tsx actually used by a single chapter) ────
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
  // Page numbers would be wrong once chapters are merged (each chapter PDF
  // starts pagination at 1) — a static footer line replaces them instead.
  footerLine: {
    position: "absolute", bottom: 18, left: MI, right: MO,
    fontSize: 7, color: "#999999", textAlign: "center",
  },
  chapterWrap: { marginBottom: 24 },
  chapterLabel: {
    fontSize: 8, color: "#D4A017", fontFamily: "BookSans-Bold",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6,
  },
  chapterTitle: {
    fontSize: 22, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    marginBottom: 8, lineHeight: 1.2,
  },
  chapterRule: {
    borderBottomWidth: 2, borderBottomColor: "#D4A017", marginBottom: 20,
  },
  lessonTitle: {
    fontSize: 13, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    marginTop: 20, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#D4A017", paddingLeft: 8,
  },
  articleTitle: {
    fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    marginTop: 14, marginBottom: 6,
  },
  h2: {
    fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D",
    marginTop: 14, marginBottom: 5,
  },
  h3: {
    fontSize: 10, fontFamily: "BookSans-Bold", color: "#444444",
    marginTop: 10, marginBottom: 4,
  },
  body: {
    fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, marginBottom: 8,
  },
  noContent: { fontSize: 9, color: "#aaaaaa", marginBottom: 6 },
  listRow: { flexDirection: "row", marginBottom: 6, paddingLeft: 6 },
  listDot: { fontSize: 10, color: "#D4A017", width: 16, marginTop: 1 },
  listText: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.8, flex: 1 },
  finTable: {
    marginVertical: 8, marginLeft: 6,
    borderTopWidth: 1, borderTopColor: "#0C1A3D",
    borderBottomWidth: 1, borderBottomColor: "#0C1A3D",
  },
  finRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 3.5, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: "#e3e3e3",
  },
  finRowTotal: { borderTopWidth: 0.8, borderTopColor: "#999999", backgroundColor: "#F7F6F2" },
  finLabel: { fontSize: 10, color: "#1a1a1a", flex: 1, paddingRight: 10 },
  finAmount: { fontSize: 10, color: "#1a1a1a", textAlign: "right", minWidth: 60 },
  finTextBold: { fontFamily: "BookSans-Bold" },
  finHeaderRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: "#0C1A3D",
  },
  finHeaderCell: { fontSize: 9, color: "#ffffff", fontFamily: "BookSans-Bold", flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  finCell: { fontSize: 9.5, color: "#1a1a1a", lineHeight: 1.5, flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  sectionRule: {
    borderTopWidth: 1, borderTopColor: "#dddddd",
    marginTop: 20, marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 11, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 10,
  },
  questionWrap: {
    marginBottom: 14, paddingLeft: 10, paddingTop: 8, paddingBottom: 8,
    borderLeftWidth: 2.5, borderLeftColor: "#D4A017",
  },
  questionLabel: {
    fontSize: 8, color: "#0C1A3D", fontFamily: "BookSans-Bold",
    letterSpacing: 0.5, marginBottom: 4,
  },
  questionText: { fontSize: 10, color: "#111111", lineHeight: 1.7, marginBottom: 8 },
  optionRow: { flexDirection: "row", marginBottom: 4 },
  optionLetter: {
    fontSize: 9, color: "#0C1A3D", fontFamily: "BookSans-Bold", width: 18,
  },
  optionText: { fontSize: 9, color: "#333333", flex: 1, lineHeight: 1.6 },
})

// ── Unicode sanitiser (duplicated from BookTemplate.tsx) ──────────────────────
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

function cleanChapterTitle(raw: string): string {
  return (raw || "").replace(/^Unit\s+\d+\s*[-:]\s*/i, "").trim()
}

// ── Visibility check (duplicated from BookTemplate.tsx) ───────────────────────
function hasText(raw: string): boolean {
  return raw.replace(/[\s ​‌‍﻿]/g, "").length > 0
}

// ── Title de-duplication (duplicated from BookTemplate.tsx) ───────────────────
function sameTitle(a?: string, b?: string): boolean {
  const norm = (t?: string) => sanitise(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const na = norm(a)
  return na !== "" && na === norm(b)
}

// ── Span renderer (duplicated from BookTemplate.tsx) ──────────────────────────
const NO_SPACE_BEFORE = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}", "%"])
const NO_SPACE_AFTER  = new Set(["(", "[", "{", "'", '"'])

function renderSpans(children: any[]): React.ReactNode {
  if (!children || children.length === 0) return null
  const nodes: React.ReactNode[] = []
  let lastRenderedText = ""
  children.forEach((c: any, i: number) => {
    const raw = sanitise(c.text || "")
    if (!raw) return
    const marks: string[] = c.marks || []
    const isBold   = marks.includes("strong")
    const isItalic = marks.includes("em")
    if (lastRenderedText.length > 0 && raw.length > 0) {
      const lastChar  = lastRenderedText[lastRenderedText.length - 1]
      const firstChar = raw[0]
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
    if (isBold) {
      style.fontFamily = "BookSans-Bold"
    } else if (isItalic) {
      style.fontStyle = "italic"
    }
    nodes.push(<Text key={i} style={style}>{raw}</Text>)
    lastRenderedText = raw
  })
  return nodes.length > 0 ? nodes : null
}

// ── Block renderer (duplicated from BookTemplate.tsx) ─────────────────────────
function renderBlocks(blocks: any[]): React.ReactNode {
  if (!blocks || !Array.isArray(blocks)) return null
  const out: React.ReactElement[] = []
  let listBuf: any[] = []
  let listKey = 0

  // Entire item text must be "Label: amount" to qualify as a financial row
  const FIN_ROW = /^(.{2,60}?):\s*([-(]?[\u00a3$\u20ac]?\s?\d[\d,]*(?:\.\d+)?\s?\)?%?)$/

  function flushList() {
    if (listBuf.length === 0) return
    const items = listBuf
      .map((item, idx) => ({
        item, idx,
        rawText: sanitise((item.children || []).map((c: any) => c.text || "").join("")),
      }))
      .filter(({ rawText }) => hasText(rawText))
    let i = 0
    let num = 0
    while (i < items.length) {
      // Detect a run of 2+ consecutive financial rows (bullets only, never numbered steps)
      if (items[i].item.listItem !== "number" && FIN_ROW.test(items[i].rawText)) {
        let j = i
        const rows: { label: string; amount: string }[] = []
        while (j < items.length && items[j].item.listItem !== "number") {
          const m = items[j].rawText.match(FIN_ROW)
          if (!m) break
          rows.push({ label: m[1].trim(), amount: m[2].trim() })
          j++
        }
        if (rows.length >= 2) {
          out.push(
            <View key={`tbl-${listKey}-${i}`} style={s.finTable}>
              {rows.map((r, ri) => {
                const isTotal = /^(total|net|gross|balance)\b/i.test(r.label)
                return (
                  <View key={ri} style={[s.finRow, isTotal ? s.finRowTotal : {}]} wrap={false}>
                    <Text style={[s.finLabel, isTotal ? s.finTextBold : {}]}>{r.label}</Text>
                    <Text style={[s.finAmount, isTotal ? s.finTextBold : {}]}>{r.amount}</Text>
                  </View>
                )
              })}
            </View>
          )
          i = j
          continue
        }
      }
      // Fallback: render exactly as before
      const { item, idx } = items[i]
      const content = renderSpans(item.children || [])
      if (content) {
        let dot: string
        if (item.listItem === "number") {
          num++
          dot = `${num}.`
        } else {
          dot = "\u2022"
        }
        out.push(
          <View key={`list-${listKey}-${idx}`} style={s.listRow} wrap={false}>
            <Text style={s.listDot}>{dot}</Text>
            <Text style={s.listText}>{content}</Text>
          </View>
        )
      }
      i++
    }
    listBuf = []
    listKey++
  }

  const skippedIndex = new Set<number>()
  blocks.forEach((b: any, i: number) => {
    if (b._type === "tableBlock") {
      flushList()
      const headers: string[] = (b.headers || []).map((h: any) => sanitise(String(h ?? "")))
      const rows: string[][] = (b.rows || []).map((r: any) => (r.cells || []).map((c: any) => sanitise(String(c ?? ""))))
      if (rows.length === 0 && headers.length === 0) return
      const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1)
      const pad = (cells: string[]) => Array.from({ length: colCount }, (_, ci) => cells[ci] ?? "")
      const numericCol = Array.from({ length: colCount }, (_, ci) =>
        ci > 0 &&
        rows.some((r) => /\d/.test(r[ci] || "")) &&
        rows.every((r) => !(r[ci] || "").trim() || /^[-(]?[\u00a3$\u20ac]?\s?[-\d][\d,.]*\s?\)?%?$/.test((r[ci] || "").trim()))
      )
      out.push(
        <View key={"tb-" + i} style={s.finTable}>
          {headers.some((h) => h.length > 0) ? (
            <View style={s.finHeaderRow}>
              {pad(headers).map((h, hi) => (
                <Text key={hi} style={[s.finHeaderCell, numericCol[hi] ? { textAlign: "right" } : {}]}>{h}</Text>
              ))}
            </View>
          ) : null}
          {rows.map((cells, ri) => {
            const isTotal = /^(total|net|gross|balance)\b/i.test(cells[0] || "")
            return (
              <View key={ri} style={[s.finRow, isTotal ? s.finRowTotal : {}]} wrap={false}>
                {pad(cells).map((c, ci) => (
                  <Text key={ci} style={[s.finCell, numericCol[ci] ? { textAlign: "right" } : {}, isTotal ? s.finTextBold : {}]}>{c}</Text>
                ))}
              </View>
            )
          })}
        </View>
      )
      return
    }
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

// ── Props ─────────────────────────────────────────────────────────────────────
interface ChapterTemplateProps {
  course:               any
  chapterIndex:         number
  bookType:             "combined" | "study" | "practice"
  edition:              string
  subtitle:             string
  questionNumberOffset: number
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ChapterTemplate({ course, chapterIndex, bookType, subtitle, questionNumberOffset }: ChapterTemplateProps) {
  const ch = (course.chapters || [])[chapterIndex]
  const showNotes     = bookType === "combined" || bookType === "study"
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

  // Continuous numbering across the merged book: starts from
  // questionNumberOffset (the total question count of all prior chapters).
  function chapterQuestionList(chapter: any) {
    const list: { q: any; num: number }[] = []
    let n = questionNumberOffset
    for (const ls of (chapter.lessons || [])) {
      for (const art of (ls.linkedArticles || [])) {
        for (const q of (art.quizQuestions || [])) {
          n++
          list.push({ q, num: n })
        }
      }
    }
    return list
  }

  if (!ch) {
    return (
      <Document title={subtitle} creator="Accounting Body Press" producer="Accounting Body Press">
        <Page size={[W, H]} style={s.page}>
          <Text style={s.body}>Chapter not found.</Text>
        </Page>
      </Document>
    )
  }

  return (
    <Document
      title={subtitle}
      author="Accounting Body Editorial Team"
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      <Page size={[W, H]} style={s.page}>

        <Text style={s.runningHead} fixed>{sanitise(subtitle)}</Text>
        <View style={s.runningLine} fixed />

        {/* Chapter header */}
        <View style={s.chapterWrap}>
          <Text style={s.chapterLabel}>Chapter {chapterIndex + 1}</Text>
          <Text style={s.chapterTitle}>{cleanChapterTitle(sanitise(ch.chapterTitle))}</Text>
          <View style={s.chapterRule} />
        </View>

        {/* Lessons */}
        {(ch.lessons || []).map((ls: any, li: number) => (
          <View key={ls._id || li}>
            {(!showNotes || !ls.linkedArticles || ls.linkedArticles.length === 0) && !sameTitle(ls.title, ch.chapterTitle) && (
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
                      {sameTitle(ls.title, ch.chapterTitle) ? null : <Text style={s.lessonTitle}>{sanitise(ls.title)}</Text>}
                      {sameTitle(art.title, ls.title) || sameTitle(art.title, ch.chapterTitle) ? null : <Text style={s.articleTitle}>{sanitise(art.title)}</Text>}
                      {renderFirstBlock(art.body || [])}
                    </View>
                  ) : (
                    sameTitle(art.title, ls.title) || sameTitle(art.title, ch.chapterTitle) ? null : <Text style={s.articleTitle}>{sanitise(art.title)}</Text>
                  )}
                  {bodyToRender && bodyToRender.length > 0
                    ? renderBlocks(bodyToRender)
                    : (firstIdx === -1 ? <Text style={s.noContent}>Study notes not yet available.</Text> : null)
                  }
                </View>
              )
            })}
          </View>
        ))}

        {/* End-of-chapter Questions (answers are in the separate answers section) */}
        {showQuestions && chapterQuestionList(ch).length > 0 && (
          <View>
            <View style={s.sectionRule} />
            <Text style={s.sectionHeader}>End of Chapter Questions</Text>
            {chapterQuestionList(ch).map(({ q, num }: { q: any; num: number }) => (
              <View key={num} style={s.questionWrap} wrap={false}>
                <Text style={s.questionLabel}>Question {num}</Text>
                <Text style={s.questionText}>{sanitise(q.questionText)}</Text>
                {(q.options || []).map((opt: any, oi: number) => (
                  <View key={oi} style={s.optionRow}>
                    <Text style={s.optionLetter}>{LETTERS[oi]}.</Text>
                    <Text style={s.optionText}>{sanitise(opt)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <Text style={s.footerLine} fixed>{sanitise(subtitle)} | {cleanChapterTitle(sanitise(ch.chapterTitle))}</Text>
      </Page>
    </Document>
  )
}
