// components/book/FullCoverTemplate.tsx
// Accounting Body Press - Full Wrap KDP Cover
// Front + Spine + Back as single PDF
// Spine width calculated dynamically from page count
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"

Font.registerHyphenationCallback((word: string) => [word])

// ── KDP dimensions ────────────────────────────────────────────────────────────
const BLEED        = 0.125 * 72   // 9pt bleed on all sides
const FRONT_W      = 6.125 * 72   // front cover width + bleed
const BACK_W       = 6.125 * 72   // back cover width + bleed
const COVER_H      = 9.25  * 72   // height including bleed

// Spine width: KDP formula for white paper = pageCount * 0.002252 inches
// Minimum spine width for text: 0.5 inches
function spineWidth(pageCount: number): number {
  const inches = Math.max(pageCount * 0.002252, 0.5)
  return inches * 72
}

const NAVY  = "#0C1A3D"
const GOLD  = "#C9982A"
const WHITE = "#FFFFFF"
const SILVER = "#94A3B8"
const DARK_NAVY = "#081428"

const LABELS: Record<string, string> = {
  combined: "STUDY TEXT & PRACTICE KIT",
  study:    "STUDY TEXT",
  practice: "PRACTICE & REVISION KIT",
}

interface FullCoverTemplateProps {
  subtitle:  string
  bookType:  "combined" | "study" | "practice"
  edition:   string
  pageCount: number
  description?: string
}

export function FullCoverTemplate({ subtitle, bookType, edition, pageCount, description }: FullCoverTemplateProps) {
  const SW        = spineWidth(pageCount)
  const TOTAL_W   = BACK_W + SW + FRONT_W
  const TOTAL_H   = COVER_H
  const LABEL     = LABELS[bookType] || "STUDY TEXT"
  const DESC      = description || "A comprehensive study resource developed by the Accounting Body Editorial Team for professional accounting qualification preparation."

  const s = StyleSheet.create({
    page: {
      width:  TOTAL_W,
      height: TOTAL_H,
      backgroundColor: NAVY,
      padding: 0,
      margin: 0,
      position: "relative",
    },
    // ── FRONT COVER ──────────────────────────────────────────────────────────
    frontCover: {
      position: "absolute",
      top: 0,
      left: BACK_W + SW,
      width: FRONT_W,
      height: TOTAL_H,
      backgroundColor: NAVY,
    },
    frontRightStripe: {
      position: "absolute",
      top: 0, bottom: 0, right: 0,
      width: 6,
      backgroundColor: GOLD,
    },
    frontBottomBar: {
      position: "absolute",
      bottom: 0, left: 0, right: 6,
      height: 72,
      backgroundColor: WHITE,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: BLEED + 28,
    },
    frontBottomPublisher: {
      fontSize: 11, fontFamily: "Helvetica-Bold",
      color: NAVY, letterSpacing: 0.5,
    },
    frontBottomEdition: {
      fontSize: 8, fontFamily: "Helvetica",
      color: GOLD, letterSpacing: 1,
    },
    frontContent: {
      position: "absolute",
      top: BLEED + 28, left: BLEED + 28,
      right: BLEED + 28 + 6, bottom: 72,
    },
    frontTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    monogram: {
      fontSize: 48, fontFamily: "Helvetica-Bold",
      color: GOLD, lineHeight: 1,
    },
    bookTypePill: {
      borderWidth: 1, borderColor: GOLD,
      paddingHorizontal: 10, paddingVertical: 4, marginTop: 6,
    },
    bookTypeText: {
      fontSize: 7, fontFamily: "Helvetica-Bold",
      color: GOLD, letterSpacing: 2,
    },
    publisherLine: {
      fontSize: 8, fontFamily: "Helvetica-Bold",
      color: SILVER, letterSpacing: 3,
      marginTop: 48, marginBottom: 16,
    },
    goldRule: {
      height: 1.5, backgroundColor: GOLD,
      width: 48, marginBottom: 20,
    },
    titleText: {
      fontSize: 22, fontFamily: "Helvetica-Bold",
      color: WHITE, lineHeight: 1.25, marginBottom: 24,
    },
    authorRow: {
      flexDirection: "row", alignItems: "center", marginTop: 8,
    },
    authorLine: {
      height: 1, backgroundColor: SILVER,
      width: 20, marginRight: 10,
    },
    authorText: {
      fontSize: 8, fontFamily: "Helvetica",
      color: SILVER, letterSpacing: 1,
    },
    // ── SPINE ────────────────────────────────────────────────────────────────
    spine: {
      position: "absolute",
      top: 0,
      left: BACK_W,
      width: SW,
      height: TOTAL_H,
      backgroundColor: DARK_NAVY,
      overflow: "hidden",
    },
    spineTopGold: {
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: 4,
      backgroundColor: GOLD,
    },
    spineBottomGold: {
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      height: 4,
      backgroundColor: GOLD,
    },
    spineContent: {
      position: "absolute",
      left: SW / 2 - (TOTAL_H - 40) / 2,
      top: TOTAL_H / 2 - SW / 2,
      width: TOTAL_H - 40,
      height: SW,
      transform: "rotate(-90deg)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
    },
    spineTitle: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: WHITE,
      letterSpacing: 0.5,
      flex: 1,
      textAlign: "center",
    },
    spinePublisher: {
      fontSize: 6,
      fontFamily: "Helvetica",
      color: GOLD,
      letterSpacing: 1,
    },
    // ── BACK COVER ───────────────────────────────────────────────────────────
    backCover: {
      position: "absolute",
      top: 0, left: 0,
      width: BACK_W,
      height: TOTAL_H,
      backgroundColor: NAVY,
    },
    backLeftStripe: {
      position: "absolute",
      top: 0, bottom: 0, left: 0,
      width: 6,
      backgroundColor: GOLD,
    },
    backBottomBar: {
      position: "absolute",
      bottom: 0, left: 6, right: 0,
      height: 72,
      backgroundColor: WHITE,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: BLEED + 28,
    },
    backBottomLeft: {
      fontSize: 9, fontFamily: "Helvetica-Bold",
      color: NAVY,
    },
    backBottomIsbn: {
      fontSize: 7, fontFamily: "Helvetica",
      color: NAVY, letterSpacing: 0.5,
    },
    backContent: {
      position: "absolute",
      top: BLEED + 36, left: BLEED + 36 + 6,
      right: BLEED + 36, bottom: 88,
    },
    backMonogram: {
      fontSize: 32, fontFamily: "Helvetica-Bold",
      color: GOLD, marginBottom: 16,
    },
    backGoldRule: {
      height: 1.5, backgroundColor: GOLD,
      width: 36, marginBottom: 20,
    },
    backTitle: {
      fontSize: 14, fontFamily: "Helvetica-Bold",
      color: WHITE, marginBottom: 6, lineHeight: 1.3,
    },
    backLabel: {
      fontSize: 8, fontFamily: "Helvetica-Bold",
      color: GOLD, letterSpacing: 1.5,
      marginBottom: 24,
    },
    backDesc: {
      fontSize: 9, fontFamily: "Helvetica",
      color: SILVER, lineHeight: 1.7, marginBottom: 24,
    },
    backFeatureRow: {
      flexDirection: "row", alignItems: "flex-start",
      marginBottom: 8,
    },
    backFeatureDot: {
      fontSize: 9, color: GOLD, width: 14, marginTop: 1,
    },
    backFeatureText: {
      fontSize: 9, fontFamily: "Helvetica",
      color: WHITE, flex: 1, lineHeight: 1.5,
    },
    backPublisherBlock: {
      position: "absolute",
      bottom: 88 + 16, left: BLEED + 36 + 6,
    },
    backPublisherName: {
      fontSize: 8, fontFamily: "Helvetica-Bold",
      color: SILVER, letterSpacing: 1,
    },
    backWebsite: {
      fontSize: 7, fontFamily: "Helvetica",
      color: GOLD, marginTop: 2,
    },
  })

  const features = [
    "Written by the Accounting Body Editorial Team",
    "Structured chapter-by-chapter study notes",
    "Aligned to professional qualification syllabuses",
    "Clear explanations with worked examples",
  ]

  return (
    <Document
      title={subtitle}
      creator="Accounting Body Press"
      producer="Accounting Body Press"
    >
      <Page size={[TOTAL_W, TOTAL_H]} style={s.page}>

        {/* ── BACK COVER ── */}
        <View style={s.backCover}>
          <View style={s.backLeftStripe} />
          <View style={s.backBottomBar}>
            <Text style={s.backBottomLeft}>Accounting Body Press</Text>
            <Text style={s.backBottomIsbn}>accountingbody.com</Text>
          </View>
          <View style={s.backContent}>
            <Text style={s.backMonogram}>AB</Text>
            <View style={s.backGoldRule} />
            <Text style={s.backTitle}>{subtitle}</Text>
            <Text style={s.backLabel}>{LABEL}</Text>
            <Text style={s.backDesc}>{DESC}</Text>
            {features.map((f, i) => (
              <View key={i} style={s.backFeatureRow}>
                <Text style={s.backFeatureDot}>{"•"}</Text>
                <Text style={s.backFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <View style={s.backPublisherBlock}>
            <Text style={s.backPublisherName}>ACCOUNTING BODY PRESS</Text>
            <Text style={s.backWebsite}>accountingbody.com</Text>
          </View>
        </View>

        {/* ── SPINE ── */}
        <View style={s.spine}>
          <View style={s.spineTopGold} />
          <View style={s.spineBottomGold} />
          <View style={s.spineContent}>
            <Text style={s.spineTitle}>{subtitle}</Text>
            <Text style={s.spinePublisher}>AB PRESS</Text>
          </View>
        </View>

        {/* ── FRONT COVER ── */}
        <View style={s.frontCover}>
          <View style={s.frontRightStripe} />
          <View style={s.frontBottomBar}>
            <Text style={s.frontBottomPublisher}>Accounting Body Press</Text>
            <Text style={s.frontBottomEdition}>{edition}</Text>
          </View>
          <View style={s.frontContent}>
            <View style={s.frontTopRow}>
              <Text style={s.monogram}>AB</Text>
              <View style={s.bookTypePill}>
                <Text style={s.bookTypeText}>{LABEL}</Text>
              </View>
            </View>
            <Text style={s.publisherLine}>ACCOUNTING BODY PRESS</Text>
            <View style={s.goldRule} />
            <Text style={s.titleText}>{subtitle}</Text>
            <View style={s.authorRow}>
              <View style={s.authorLine} />
              <Text style={s.authorText}>ACCOUNTING BODY EDITORIAL TEAM</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}
