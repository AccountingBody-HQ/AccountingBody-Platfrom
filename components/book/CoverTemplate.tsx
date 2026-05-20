// components/book/CoverTemplate.tsx
// Accounting Body Press - KDP Cover Template
// Colour cover: 6x9 inch + 0.125 inch bleed on all sides
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// KDP cover with bleed: 6.25 x 9.25 inches
const W = 6.25 * 72
const H = 9.25 * 72
const BLEED = 0.125 * 72
const SAFE = 0.25 * 72

const s = StyleSheet.create({
  page: {
    width: W,
    height: H,
    backgroundColor: '#0C1A3D',
    padding: 0,
  },
  safeArea: {
    position: 'absolute',
    top: BLEED + SAFE,
    left: BLEED + SAFE,
    right: BLEED + SAFE,
    bottom: BLEED + SAFE,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  publisherName: {
    fontSize: 9,
    color: '#D4A017',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  goldBar: {
    width: W,
    height: 6,
    backgroundColor: '#D4A017',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  goldBarBottom: {
    width: W,
    height: 6,
    backgroundColor: '#D4A017',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  bookTypeLabel: {
    fontSize: 10,
    color: '#D4A017',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  titleDivider: {
    width: 48,
    height: 3,
    backgroundColor: '#D4A017',
    marginBottom: 20,
  },
  bookTitle: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 1.2,
  },
  editionText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: '#1e3a6e',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  authorText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  copyrightText: {
    fontSize: 8,
    color: '#64748b',
  },
  accentBlock: {
    position: 'absolute',
    right: 0,
    top: H * 0.25,
    width: 8,
    height: H * 0.5,
    backgroundColor: '#D4A017',
  },
})

interface CoverTemplateProps {
  subtitle: string
  bookType: 'combined' | 'study' | 'practice'
  edition: string
}

const BOOK_TYPE_LABELS: Record<string, string> = {
  combined: 'Study Text & Practice Kit',
  study: 'Study Text',
  practice: 'Practice Kit',
}

export function CoverTemplate({ subtitle, bookType, edition }: CoverTemplateProps) {
  const year = new Date().getFullYear()
  return (
    <Document
      title={subtitle + ' - Cover'}
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      <Page size={[W, H]} style={s.page}>
        <View style={s.goldBar} />
        <View style={s.goldBarBottom} />
        <View style={s.accentBlock} />
        <View style={s.safeArea}>
          <View style={s.topSection}>
            <Text style={s.publisherName}>Accounting Body Press</Text>
          </View>
          <View style={s.middleSection}>
            <Text style={s.bookTypeLabel}>{BOOK_TYPE_LABELS[bookType] || 'Study Text'}</Text>
            <View style={s.titleDivider} />
            <Text style={s.bookTitle}>{subtitle}</Text>
            <Text style={s.editionText}>{edition}</Text>
          </View>
          <View style={s.bottomSection}>
            <Text style={s.authorText}>Accounting Body Editorial Team</Text>
            <Text style={s.copyrightText}>Copyright {year} Accounting Body Press</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
