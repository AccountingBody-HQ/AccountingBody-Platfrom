// components/book/CoverTemplate.tsx
// Accounting Body Press - KDP Cover v3 - Kaplan-style Option A
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const W = 6.25 * 72   // 450pt
const H = 9.25 * 72   // 666pt
const BLEED = 0.125 * 72  // 9pt

const NAVY  = '#0C1A3D'
const GOLD  = '#C9982A'
const WHITE = '#FFFFFF'
const OFFWHITE = '#F4F6F9'
const DARKNAVY = '#060F22'

const s = StyleSheet.create({
  page: {
    width: W,
    height: H,
    backgroundColor: NAVY,
    padding: 0,
    margin: 0,
  },
  // TOP GOLD BAND - 42% of page height
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: H * 0.42,
    backgroundColor: GOLD,
  },
  // Thin dark line separating top band from navy
  separatorLine: {
    position: 'absolute',
    top: H * 0.42,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: DARKNAVY,
  },
  // BOTTOM NAVY section already set by page bg
  // Publisher label - top of gold band
  publisherRow: {
    position: 'absolute',
    top: BLEED + 18,
    left: BLEED + 24,
    right: BLEED + 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  publisherText: {
    fontSize: 8,
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },
  editionBadge: {
    backgroundColor: NAVY,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editionBadgeText: {
    fontSize: 7,
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  // TITLE BLOCK - sits across the gold/navy boundary
  titleBlock: {
    position: 'absolute',
    top: H * 0.26,
    left: BLEED + 24,
    right: BLEED + 24,
  },
  bookTypeLabel: {
    fontSize: 8,
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    marginBottom: 10,
  },
  titleText: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    lineHeight: 1.2,
    marginBottom: 0,
  },
  // White title card that overlaps gold/navy boundary
  titleCard: {
    position: 'absolute',
    top: H * 0.36,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    paddingVertical: 20,
    paddingLeft: BLEED + 24,
    paddingRight: BLEED + 24,
  },
  titleCardText: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    lineHeight: 1.25,
  },
  // BOTTOM SECTION - navy area
  bottomContent: {
    position: 'absolute',
    top: H * 0.42 + 4,
    left: BLEED + 24,
    right: BLEED + 24,
    bottom: BLEED + 20,
    justifyContent: 'space-between',
  },
  descriptionText: {
    fontSize: 10,
    color: OFFWHITE,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    marginTop: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  authorBlock: {},
  authorLabel: {
    fontSize: 7,
    color: GOLD,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  authorName: {
    fontSize: 9,
    color: WHITE,
    fontFamily: 'Helvetica',
  },
  logoBlock: {
    alignItems: 'flex-end',
  },
  logoText: {
    fontSize: 11,
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
  },
  logoSub: {
    fontSize: 7,
    color: GOLD,
    fontFamily: 'Helvetica',
    letterSpacing: 1,
    marginTop: 2,
  },
  // Bottom gold bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: GOLD,
  },
})

interface CoverTemplateProps {
  subtitle: string
  bookType: 'combined' | 'study' | 'practice'
  edition: string
}

const LABELS: Record<string, string> = {
  combined: 'STUDY TEXT & PRACTICE KIT',
  study:    'STUDY TEXT',
  practice: 'PRACTICE & REVISION KIT',
}

export function CoverTemplate({ subtitle, bookType, edition }: CoverTemplateProps) {
  return (
    <Document title={subtitle} creator="Accounting Body Press" producer="Accounting Body Press">
      <Page size={[W, H]} style={s.page}>

        {/* Top gold band */}
        <View style={s.topBand} />
        <View style={s.separatorLine} />
        <View style={s.bottomBar} />

        {/* Publisher row */}
        <View style={s.publisherRow}>
          <Text style={s.publisherText}>ACCOUNTING BODY PRESS</Text>
          <View style={s.editionBadge}>
            <Text style={s.editionBadgeText}>{edition}</Text>
          </View>
        </View>

        {/* Book type label in gold band */}
        <View style={{ position: 'absolute', top: H * 0.28, left: BLEED + 24 }}>
          <Text style={s.bookTypeLabel}>{LABELS[bookType] || 'STUDY TEXT'}</Text>
        </View>

        {/* White title card bridging gold/navy */}
        <View style={s.titleCard}>
          <Text style={s.titleCardText}>{subtitle}</Text>
        </View>

        {/* Bottom navy content */}
        <View style={s.bottomContent}>
          <Text style={s.descriptionText}>Comprehensive study material developed by the Accounting Body Editorial Team. Aligned to current syllabus and examiner guidance.</Text>
          <View style={s.bottomRow}>
            <View style={s.authorBlock}>
              <Text style={s.authorLabel}>AUTHORED BY</Text>
              <Text style={s.authorName}>Accounting Body Editorial Team</Text>
            </View>
            <View style={s.logoBlock}>
              <Text style={s.logoText}>Accounting Body</Text>
              <Text style={s.logoSub}>PRESS</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
