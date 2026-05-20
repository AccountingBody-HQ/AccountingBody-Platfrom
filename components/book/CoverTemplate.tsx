// components/book/CoverTemplate.tsx
// Accounting Body Press - Premium Cover
// Design: Authority - clean, confident, no gimmicks
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const W = 6.25 * 72
const H = 9.25 * 72
const BLEED = 0.125 * 72

const NAVY    = '#0C1A3D'
const GOLD    = '#C9982A'
const WHITE   = '#FFFFFF'
const SILVER  = '#94A3B8'

const s = StyleSheet.create({
  page: {
    width: W,
    height: H,
    backgroundColor: NAVY,
    padding: 0,
    margin: 0,
  },
  // Right gold edge stripe - thin elegant line
  rightStripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 6,
    backgroundColor: GOLD,
  },
  // Bottom white bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 6,
    height: 72,
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BLEED + 28,
  },
  bottomPublisher: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    letterSpacing: 0.5,
  },
  bottomEdition: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: GOLD,
    letterSpacing: 1,
  },
  // Main content area
  mainContent: {
    position: 'absolute',
    top: BLEED + 28,
    left: BLEED + 28,
    right: BLEED + 28 + 6,
    bottom: 72,
  },
  // Top row - monogram + book type
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  monogram: {
    fontSize: 48,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
    lineHeight: 1,
  },
  bookTypePill: {
    borderWidth: 1,
    borderColor: GOLD,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  bookTypeText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
    letterSpacing: 2,
  },
  // Subject line above title
  subjectLine: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: SILVER,
    letterSpacing: 3,
    marginTop: 48,
    marginBottom: 16,
  },
  // Gold rule
  goldRule: {
    height: 1.5,
    backgroundColor: GOLD,
    width: 48,
    marginBottom: 20,
  },
  // Main title
  titleText: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    lineHeight: 1.25,
    marginBottom: 24,
  },
  // Author line
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  authorLine: {
    height: 1,
    backgroundColor: SILVER,
    width: 20,
    marginRight: 10,
  },
  authorText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: SILVER,
    letterSpacing: 1,
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

        <View style={s.rightStripe} />

        <View style={s.bottomBar}>
          <Text style={s.bottomPublisher}>Accounting Body Press</Text>
          <Text style={s.bottomEdition}>{edition}</Text>
        </View>

        <View style={s.mainContent}>
          <View style={s.topRow}>
            <Text style={s.monogram}>AB</Text>
            <View style={s.bookTypePill}>
              <Text style={s.bookTypeText}>{LABELS[bookType] || 'STUDY TEXT'}</Text>
            </View>
          </View>

          <Text style={s.subjectLine}>ACCOUNTING BODY PRESS</Text>
          <View style={s.goldRule} />
          <Text style={s.titleText}>{subtitle}</Text>

          <View style={s.authorRow}>
            <View style={s.authorLine} />
            <Text style={s.authorText}>ACCOUNTING BODY EDITORIAL TEAM</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
