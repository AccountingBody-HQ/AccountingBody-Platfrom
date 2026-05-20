// components/book/BookTemplate.tsx
// Accounting Body Press - PDF Interior Template
// KDP spec: 6x9 inch, black and white, embedded fonts
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'

// ---- Dimensions (points: 1 inch = 72pt) ------------------------------------
const W = 6 * 72   // 432pt
const H = 9 * 72   // 648pt
const MARGIN_TOP    = 0.75 * 72
const MARGIN_BOTTOM = 0.75 * 72
const MARGIN_INSIDE = 0.75 * 72
const MARGIN_OUTSIDE = 0.5 * 72

// ---- Styles ----------------------------------------------------------------
const s = StyleSheet.create({
  page: {
    width: W, height: H,
    paddingTop: MARGIN_TOP, paddingBottom: MARGIN_BOTTOM,
    paddingLeft: MARGIN_INSIDE, paddingRight: MARGIN_OUTSIDE,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  // Front matter
  titlePage: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  publisherLabel: {
    fontSize: 9, color: '#666666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
  },
  bookTitle: {
    fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#0C1A3D',
    textAlign: 'center', marginBottom: 8,
  },
  bookSubtitle: {
    fontSize: 14, color: '#333333', textAlign: 'center', marginBottom: 24,
  },
  editionText: {
    fontSize: 10, color: '#666666', textAlign: 'center',
  },
  divider: {
    borderBottomWidth: 1, borderBottomColor: '#D4A017',
    marginVertical: 16, width: '60%', alignSelf: 'center',
  },
  // Copyright page
  copyrightPage: {
    flex: 1, justifyContent: 'flex-end',
  },
  copyrightText: {
    fontSize: 8, color: '#666666', marginBottom: 4,
  },
  // TOC
  tocTitle: {
    fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0C1A3D',
    marginBottom: 16,
  },
  tocChapter: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 6,
  },
  tocChapterText: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0C1A3D', flex: 1,
  },
  tocLesson: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 3, paddingLeft: 12,
  },
  tocLessonText: {
    fontSize: 9, color: '#444444', flex: 1,
  },
  // Chapter
  chapterHeader: {
    marginBottom: 20,
  },
  chapterNumber: {
    fontSize: 9, color: '#D4A017', fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0C1A3D', marginBottom: 4,
  },
  chapterDivider: {
    borderBottomWidth: 1.5, borderBottomColor: '#D4A017', marginBottom: 16,
  },
  // Lesson
  lessonTitle: {
    fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0C1A3D',
    marginTop: 16, marginBottom: 8,
  },
  // Article
  articleTitle: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0C1A3D',
    marginTop: 12, marginBottom: 6,
  },
  bodyText: {
    fontSize: 10, color: '#222222', lineHeight: 1.6, marginBottom: 6,
  },
  // Practice questions
  practiceHeader: {
    fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0C1A3D',
    marginTop: 20, marginBottom: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#cccccc',
  },
  questionBox: {
    marginBottom: 12, padding: 8,
    borderLeftWidth: 2, borderLeftColor: '#D4A017',
  },
  questionNumber: {
    fontSize: 8, color: '#D4A017', fontFamily: 'Helvetica-Bold',
    marginBottom: 3, textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 10, color: '#222222', marginBottom: 6, lineHeight: 1.5,
  },
  optionRow: {
    flexDirection: 'row', marginBottom: 2,
  },
  optionLabel: {
    fontSize: 9, color: '#555555', width: 16, fontFamily: 'Helvetica-Bold',
  },
  optionText: {
    fontSize: 9, color: '#555555', flex: 1,
  },
  // Answer key
  answerHeader: {
    fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0C1A3D',
    marginTop: 20, marginBottom: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#cccccc',
  },
  answerRow: {
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 9, color: '#D4A017', fontFamily: 'Helvetica-Bold', marginBottom: 2,
  },
  answerText: {
    fontSize: 9, color: '#333333', lineHeight: 1.4,
  },
  // Page number
  pageNum: {
    position: 'absolute', bottom: 20, right: MARGIN_OUTSIDE,
    fontSize: 8, color: '#999999',
  },
  pageNumLeft: {
    position: 'absolute', bottom: 20, left: MARGIN_INSIDE,
    fontSize: 8, color: '#999999',
  },
  runningHead: {
    position: 'absolute', top: 20, right: MARGIN_OUTSIDE,
    fontSize: 7, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.5,
  },
})

// ---- Portable text serialiser (block array -> plain string) ----------------
function blocksToText(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) return ''
  return blocks
    .filter((b: any) => b._type === 'block' && b.children)
    .map((b: any) => b.children.map((c: any) => c.text || '').join('\n\n'))
    .filter(Boolean)
    .join(' ')
}

// ---- Option letters --------------------------------------------------------
const LETTERS = ['A', 'B', 'C', 'D', 'E']

// ---- Props -----------------------------------------------------------------
interface BookTemplateProps {
  course: any
  bookType: 'combined' | 'study' | 'practice'
  edition: string
  subtitle: string
}

// ---- Component -------------------------------------------------------------
export function BookTemplate({ course, bookType, edition, subtitle }: BookTemplateProps) {
  const year = new Date().getFullYear()
  const showNotes = bookType === 'combined' || bookType === 'study'
  const showQuestions = bookType === 'combined' || bookType === 'practice'

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
          <View style={s.divider} />
          <Text style={s.bookTitle}>{subtitle}</Text>
          <Text style={s.bookSubtitle}>
            {bookType === 'combined' ? 'Study Text & Practice Kit' : bookType === 'study' ? 'Study Text' : 'Practice Kit'}
          </Text>
          <View style={s.divider} />
          <Text style={s.editionText}>{edition}</Text>
        </View>
      </Page>

      {/* Copyright Page */}
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

      {/* Table of Contents */}
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

      {/* Chapters */}
      {(course.chapters || []).map((ch: any, ci: number) => (
        <Page key={ch._key || ci} size={[W, H]} style={s.page}>
          <Text style={s.runningHead}>{subtitle}</Text>

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

              {/* Articles / Study Notes */}
              {showNotes && (ls.linkedArticles || []).map((art: any, ai: number) => (
                <View key={art._id || ai}>
                  <Text style={s.articleTitle}>{art.title}</Text>
                  {art.body && art.body.length > 0 ? (
                    <Text style={s.bodyText}>{blocksToText(art.body)}</Text>
                  ) : (
                    <Text style={[s.bodyText, { color: '#999999' }]}>Study notes not available for this article.</Text>
                  )}
                </View>
              ))}

              {/* Practice Questions */}
              {showQuestions && (ls.linkedArticles || []).map((art: any, ai: number) => {
                const qs = art.quizQuestions || []
                if (qs.length === 0) return null
                return (
                  <View key={'q-' + (art._id || ai)}>
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

                    {/* Answer Key */}
                    <Text style={s.answerHeader}>Answer Key</Text>
                    {qs.map((q: any, qi: number) => (
                      <View key={'a-' + qi} style={s.answerRow}>
                        <Text style={s.answerLabel}>Q{qi + 1}: {LETTERS[q.correctIndex ?? 0]}</Text>
                        {q.explanation ? (
                          <Text style={s.answerText}>{q.explanation}</Text>
                        ) : null}
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
