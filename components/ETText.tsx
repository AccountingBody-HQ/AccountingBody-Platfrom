'use client'

import React from 'react'
import { useETLanguage } from '@/components/layout/ETLanguageContext'

interface ETTextProps {
  en: string
  am: string
  om: string
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export function ETText({ en, am, om, className, as: Tag = 'span' }: ETTextProps) {
  const { language } = useETLanguage()
  const text = language === 'am' ? am : language === 'om' ? om : en
  return className ? <Tag className={className}>{text}</Tag> : <>{text}</>
}
