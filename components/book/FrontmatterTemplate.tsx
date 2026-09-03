// components/book/FrontmatterTemplate.tsx
// Accounting Body Press - Title + Copyright + TOC (chapter-by-chapter generation)
// Rendered LAST in the client orchestration flow (app/roodber8/ab-press/page.tsx)
// so it can use each chapter's REAL page count, learned from generate-chapter's
// response, for exact TOC page numbers — no probe/estimate pass needed here,
// unlike the single-request generate/route.ts fallback for small courses.
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

// ── Styles (subset of BookTemplate.tsx used by title/copyright/TOC pages) ────
const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MT + 20, paddingBottom: MB,
    paddingLeft: MI, paddingRight: MO,
    fontFamily: "BookSans", backgroundColor: "#ffffff",
  },
  titlePage: { flex: 1, justifyContent: "center", alignItems: "center" },
  publisherLabel: {
    fontSize: 9, color: "#888888", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 1.5,
  },
  bookTitle: {
    fontSize: 22, fontFamily: "BookSans-Bold", color: "#0C1A3D",
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
    fontSize: 18, fontFamily: "BookSans-Bold", color: "#0C1A3D", marginBottom: 20,
  },
  tocChapterRow: { marginBottom: 8 },
  tocChapterText: {
    fontSize: 10, fontFamily: "BookSans-Bold", color: "#0C1A3D",
  },
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

// ── Props ─────────────────────────────────────────────────────────────────────
interface FrontmatterTemplateProps {
  course:             any
  bookType:           "combined" | "study" | "practice"
  edition:            string
  subtitle:           string
  chapterPageStarts:  number[]
  totalPages:         number
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FrontmatterTemplate({ course, bookType, edition, subtitle, chapterPageStarts, totalPages }: FrontmatterTemplateProps) {
  const year = new Date().getFullYear()
  const showQuestions = bookType === "combined" || bookType === "practice"

  // The client's page-count arithmetic (handleGenerate in page.tsx) budgets
  // exactly 1 page for the merged answers section when computing totalPages,
  // so the answers section's start page is always totalPages - 1.
  const answersPageStart = totalPages - 1

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
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              <Text style={s.tocChapterText}>
                Chapter {ci + 1}: {cleanChapterTitle(sanitise(ch.chapterTitle))}
              </Text>
              <View style={{ flex: 1, borderBottomWidth: 0.7, borderBottomColor: "#bbbbbb", borderBottomStyle: "dotted", marginHorizontal: 4, marginBottom: 2 }} />
              <Text style={s.tocChapterText}>{chapterPageStarts[ci] ? String(chapterPageStarts[ci]) : ""}</Text>
            </View>
          </View>
        ))}
        {showQuestions && (
          <View style={s.tocChapterRow}>
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              <Text style={s.tocChapterText}>Answers and Explanations</Text>
              <View style={{ flex: 1, borderBottomWidth: 0.7, borderBottomColor: "#bbbbbb", borderBottomStyle: "dotted", marginHorizontal: 4, marginBottom: 2 }} />
              <Text style={s.tocChapterText}>{String(answersPageStart)}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  )
}
