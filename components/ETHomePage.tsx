'use client'

import React from 'react'
import Link from 'next/link'
import { useETLanguage } from '@/components/layout/ETLanguageContext'
import HeroSearch from '@/components/HeroSearch'

const heroData = {
  en: {
    eyebrow: 'For the Ethiopian Community — Worldwide · አማርኛ · Afaan Oromoo',
    h1a: 'The accounting and finance experts',
    h1b: 'built for Ethiopia',
    h1c: 'and its diaspora.',
    body: 'EthioTax delivers professional accounting, tax, audit, payroll and business consulting to Ethiopian individuals and businesses — in Ethiopia and across the global diaspora. Qualified professionals. Amharic and Afaan Oromoo service available.',
    sub: 'UK · USA · Canada · UAE · Ethiopia · Sweden · Australia',
    cta1: 'Talk to us on WhatsApp',
    cta2: 'Explore our services',
    search: 'Search tax guides, accounting articles, ETICPA resources…',
    howTitle: 'Five steps to a managed service',
    howBody: 'From your first inquiry to long-term financial partnership — EthioTax manages every step.',
    quote: 'Get a free quote',
    seeHow: 'See how it works',
    servicesTitle: 'Professional services and study — everything in one place',
    servicesBody: 'EthioTax delivers fully managed professional services for the Ethiopian community, and a world-class study platform for the next generation of Ethiopian finance professionals.',
    profServices: 'Professional Services',
    statsTitle: 'Why EthioTax',
    statsH2: 'Eight reasons the community trusts us',
    statsBody: 'EthioTax is not a directory. We are not a marketplace. We are a fully managed professional services firm built specifically for the Ethiopian community.',
    clientStories: 'Client Stories',
    whatClientsSay: 'What our clients say',
    clientsBody: 'EthioTax clients across the UK, USA and Canada share their experience.',
  },
  am: {
    eyebrow: 'ለኢትዮጵያውያን ምህበተኞች — ዓለም · አማርኛ · Afaan Oromoo',
    h1a: 'የሐሳቡ እና የምረጥ የምክንሳቡ ሎወቶች',
    h1b: 'ለኢትዮጵያ የተገለጸ',
    h1c: 'እና ዲያስፖራውን።',
    body: 'EthioTax ለኢትዮጵያውያን ስረሮች እና ድርጅቶች የሐሳቡ መቄባበት፣ የገብር ምክር፣ ያደርስ የርቄት ደሕናነት እና የድርጅት ምክር ያሰጥል።',
    sub: 'እንግሊዘኛ · አሜሪካ · ካናዳ · ዩኤይ · ኢትዮጵያ · ስዊዲን · ኣስትሬይላ',
    cta1: 'በዋቴሳፕ ይነጋሩን',
    cta2: 'የምንድሮችን አድርግ',
    search: 'የገብር ምክርችን ይዳሽጉ…',
    howTitle: 'የምንድሮት አምስት የቨብላት ደርጅት ስራዎች',
    howBody: 'ከመጀመሪውን ጥያቂት እስከዳር ስበ ዳርግከት የደርግ ምክር ድርጅት — EthioTax እድንም እህደም ይየጠል።',
    quote: 'በነጸ ካርታታ ይይ፡',
    seeHow: 'ድንድ እንደሰራ ይመለከቱ',
    servicesTitle: 'የምንድሮት አምስት እና ትምሄርት — ሁሉም በዓክ ገጩ',
    servicesBody: 'EthioTax ለኢትዮጵያውያን ምህበተኞች የተሓለለ የምንድሮት አምስት ያሰጥል።',
    profServices: 'የምንድሮት አምስቶች',
    statsTitle: 'ወንደም EthioTax',
    statsH2: 'ምህበተኞውን የሚበቀብት ደርጅት ስምንት ስርዓተር',
    statsBody: 'EthioTax ለኢትዮጵያውያን ምህበተኞች የተገለጸ የተመረጠ የምንድሮት አምስት ድርጅት ነው።',
    clientStories: 'የዘባዬች ልምድነች',
    whatClientsSay: 'ዘባኩዌች ምን ይሉ።',
    clientsBody: 'በእንግሊዘኛ፣ አሜሪካ እና ካናዳ የሚገኘት EthioTax ዘባኩዌች የላጃውን ተሳብ ይየዝጉ።',
  },
  om: {
    eyebrow: 'Hawaasa Itoophiyaa Addunyaatti · Afaan Oromoo · Amaariffa',
    h1a: 'Ogeeyyiin herrega fi maallaqaa',
    h1b: 'Itoophiyaaf kan ijaarame',
    h1c: 'fi sabboontota ishee.',
    body: "EthioTax herrega ogummaa, gibira, to'annoo, mindaa fi gorsa daldala dhuunfaafi dhaabbilee Itoophiyaatiif ni kenna — biyya keessattis ta'ee diasporaa addunyaa guutuu keessatti.",
    sub: 'UK · USA · Canada · UAE · Itoophiyaa · Sweden · Awustiraaliyaa',
    cta1: 'WhatsApp irratti nu quunnamaa',
    cta2: 'Tajaajila keenya ilaalaa',
    search: 'Qajeelcha gibira, barreeffama herregaa barbaadi…',
    howTitle: 'Tarkaanfii shan tajaajila bulchamaa',
    howBody: 'Gaaffii jalqabaa irraa hariiroo maallaqaa yeroo dheeraa — EthioTax tarkaanfii hundumaa bulcha.',
    quote: 'Tilmaama bilisaa argadhu',
    seeHow: 'Akkamiin hojjeta ilaalaa',
    servicesTitle: 'Tajaajila ogummaa fi barnoota — hundumtuu bakka tokkotti',
    servicesBody: 'EthioTax hawaasa Itoophiyaatiif tajaajila ogummaa guutumaan bulchama kenna.',
    profServices: 'Tajaajila Ogummaa',
    statsTitle: 'Maaliif EthioTax',
    statsH2: 'Sababa saddeetiin hawaasni nu amanuu',
    statsBody: 'EthioTax galmeessaa miti. Gabaa miti. Dhaabbata tajaajila ogummaa hawaasa Itoophiyaatiif addatti ijaarame.',
    clientStories: 'Seenaa Maamilaa',
    whatClientsSay: 'Maamiloonni keenya maal jedhu',
    clientsBody: 'Maamiloonni EthioTax UK, USA fi Kaanaadaa keessa jiran muuxannoo isaanii qooduu.',
  },
}

const stepsData = {
  en: [
    { step: '01', title: 'Tell us what you need', body: 'Contact EthioTax by WhatsApp, email or our website form. You can write in English, Amharic or Afaan Oromoo. We respond within 24 hours, every time.' },
    { step: '02', title: 'We prepare your proposal', body: 'EthioTax qualifies your requirement, selects the right professional from our verified network, and delivers a clear fixed-fee proposal within 72 hours.' },
    { step: '03', title: 'We manage everything', body: 'Once you approve, EthioTax briefs the professional, monitors progress and quality-checks every deliverable before it reaches you.' },
    { step: '04', title: 'You receive the work', body: 'EthioTax delivers your completed work with a covering note. We follow up within 5 days to confirm your satisfaction.' },
    { step: '05', title: 'We stay with you', body: 'EthioTax tracks your deadlines, sends annual reminders and proactively advises as your needs grow. One relationship. Complete financial support.' },
  ],
  am: [
    { step: '01', title: 'ሞን ምን እንደመቁ ብረቱን', body: 'በዋቴሳፕ፣ በኢሜይል ወይም በዳሳፈ ፈረም EthioTaxን ያናጋቷ። በአማርኛ፣ በአፋን ዎሮሞ ወይም በእንግሊዝኛ ልየለዋ። በ2019 24 ሳዓት ዮሉበት እንሰጣለፄ።' },
    { step: '02', title: 'ካርዓድ እንነድባለን', body: 'EthioTax ስራዎን ከተመረጠወ ደብረቶቻ ውስጠይ እጅስተሳቡ፣ ተቁዕነውን የምክንመተወ የምክንዙተወን ከመርባቺነት ዖላለይ ይመርጣል።' },
    { step: '03', title: 'ሁሉንም እንናለቀጥለነበት', body: 'ከከረጀ በኋላ፣ EthioTax የምክንሳቡን አቅሮቡ፣ ተጁነትን ይከታተላል፣ ባለዙ ክእደት ዝርዝር ይክዋል።' },
    { step: '04', title: 'ስራዎን ተቀብሉታል።', body: 'EthioTax ተየነወነውን ስራ በየመከተት ምዘር ይልክል። በ\u2005 ቀናት ወስጥ ሰአል ስለስተውን ለማረጋገጥ ይከታተላል።' },
    { step: '05', title: 'ዓበት ደግባ እንደልን ደተወናለን', body: 'EthioTax ሞያየነውን ምዘር ይከታተላል፣ የዓመት ቪስቐሞችን ይሎካል። ዓለም የተዌገን የምክንሳቡ ደግባ።' },
  ],
  om: [
    { step: '01', title: 'Maal barbaaddu nuuf himi', body: "EthioTax WhatsApp, imeelii ykn foormii marsariitii keenyaan quunnamaa. Afaan Oromoo, Amaariffa ykn Ingliziin barreessuu dandeessa. Sa'aatii 24 keessatti deebii siif kennina." },
    { step: '02', title: 'Yaada kee qopheessina', body: "EthioTax barbaachisummaa kee mirkanneessee oggeessa sirrii filatee sagantaa gatii murtaa'aa sa'aatii 72 keessatti siif dhiyeessa." },
    { step: '03', title: "Hundumaa too'anna", body: "Erga hayyamte booda EthioTax oggeessa qajeelchee deemsa hordofee fi bu'aa hundumaa si bira ga'uu dura ni mirkaneessa." },
    { step: '04', title: 'Hojii kee argatta', body: 'EthioTax hojii fixame ibsa waliin siif ergaa. Guyyaa 5 keessatti gammachuu kee mirkaneessuuf si hordofna.' },
    { step: '05', title: 'Waliin turra', body: "EthioTax yeroo murtaa'aa kee hordofee yaadachiisaa fi gorsaa tursa. Hidhata tokko. Deeggarsa maallaqaa guutuu." },
  ],
}

const pillarsData = {
  en: [
    { id: 'tax', title: 'Tax & Compliance', description: 'EthioTax manages your tax obligations across every jurisdiction. UK Self Assessment, US returns, Ethiopian ERCA filings and cross-border treaty claims.', href: '/get-help', highlights: ['UK Self Assessment', 'US & Canadian returns', 'Ethiopian ERCA filing', 'Cross-border tax planning'] },
    { id: 'accounting', title: 'Accounting & Bookkeeping', description: 'Monthly bookkeeping, annual accounts, management reporting and software setup. ETICPA-standard accounts for Ethiopian entities.', href: '/get-help', highlights: ['Monthly bookkeeping', 'Annual accounts', 'Management reports', 'Xero & QuickBooks setup'] },
    { id: 'consulting', title: 'Business Consulting', description: 'Company formation, business plans, financial modelling and diaspora investment structuring.', href: '/get-help', highlights: ['Company formation', 'Business plans', 'Diaspora investment', 'Financial modelling'] },
    { id: 'payroll', title: 'Payroll & Audit', description: 'UK PAYE, Ethiopian payroll and pension auto-enrolment managed end to end. ETICPA-standard audit and assurance for Ethiopian entities.', href: '/get-help', highlights: ['UK PAYE processing', 'Ethiopian payroll', 'Pension auto-enrolment', 'ETICPA-standard audit'] },
  ],
  am: [
    { id: 'tax', title: 'የገብር እና ሳልታዊ መቷጵያ', description: 'EthioTax በሁሉም የምትሮበት መስራዝት የገብር ተድሮዎን ይቀዋል። UK፣ አሜሪካ፣ ኢትዮጵያ ERCA።', href: '/get-help', highlights: ['የUK ሰልፍ አቀባል', 'የUS እና ካናዳ ሰኔ', 'ERCA ኢትዮጵያ', 'አጦራዊ የገብር እቃዳ'] },
    { id: 'accounting', title: 'አካዘንት እና ቡከኬፒንግ', description: 'ወርሃዊ ቡከኬፒንግ፣ የዓመት ህሳቡ፣ የአመርያ ሮፅርት እና የዦይስወር ውቅድ።', href: '/get-help', highlights: ['ወርሃዊ ቡከኬፒንግ', 'የዓመት ህሳቡ', 'የአመርያ ሮፅርት', 'Xero እና QuickBooks'] },
    { id: 'consulting', title: 'የድርጅት ምክር', description: 'የድርጅት ምስረት፣ የድርጅት ዕድድ፣ የምረጥ ሞደሉንግ እና የዲያስፖራ ባለስላት መዋቀር።', href: '/get-help', highlights: ['የድርጅት ምስረት', 'የድርጅት ዕድድ', 'የዲያስፖራ ባለስላት', 'የምረጥ ሞደሉንግ'] },
    { id: 'payroll', title: 'ወር እና ያደርስ የርቄት ደሕናነት', description: 'የUK PAYE፣ የኢትዮጵያ ወር እና የአባዊ ኪድይ ተቀዳድቤል።', href: '/get-help', highlights: ['UK PAYE', 'የኢትዮጵያ ወር', 'የአባዊ ኪድይ', 'ETICPA የርቄት ደሕናነት'] },
  ],
  om: [
    { id: 'tax', title: 'Gibira & Haqa', description: 'EthioTax dirqama gibira kee biyya jiraattu fi hojjettu hundatti siif bulcha. UK, US, ERCA Itoophiyaa.', href: '/get-help', highlights: ['Gibira dhuunfaa UK', 'Galii US fi Kaanaadaa', 'ERCA Itoophiyaa', "Karoora gibira daangaa ce'u"] },
    { id: 'accounting', title: 'Herrega & Galmee', description: "Galmee ji'aa ji'aan, herrega waggaa, gabaasa bulchiinsaa fi qophii softweerii. Herrega ETICPA-sadarkaa.", href: '/get-help', highlights: ["Galmee ji'aa ji'aan", 'Herrega waggaa', 'Gabaasa bulchiinsaa', 'Qophii Xero & QuickBooks'] },
    { id: 'consulting', title: 'Gorsaa Daldalaa', description: 'Hundeenya dhaabbata, karoora daldala, moodeelii maallaqaa fi ijaarsa maallaqaa diasporaa.', href: '/get-help', highlights: ['Hundeenya dhaabbata', 'Karoora daldala', 'Maallaqaa diasporaa', 'Moodeelii maallaqaa'] },
    { id: 'payroll', title: "Mindaa & To'annoo", description: "PAYE UK, mindaa Itoophiyaa fi galii mirkaneessa dursee raawwatama. To'annoo ETICPA-sadarkaa.", href: '/get-help', highlights: ['PAYE UK', 'Mindaa Itoophiyaa', 'Galii pension', "To'annoo ETICPA-sadarkaa"] },
  ],
}

const trustData = {
  en: [
    { title: 'The Vetting Premium', body: 'Every professional in our network is qualified, referenced, licensed and performance-monitored. You never deal with an unverified provider.' },
    { title: 'The Convenience Premium', body: 'One inquiry. One point of contact. EthioTax manages every step from brief to delivery.' },
    { title: 'The Community Premium', body: 'We understand Amharic, Afaan Oromoo, ERCA, Ethiopian business law and the cross-border reality of diaspora life.' },
    { title: 'The Quality Assurance Premium', body: 'Every deliverable is reviewed by EthioTax before it reaches you. No raw output. No surprises.' },
    { title: 'The Cross-Border Expertise Premium', body: 'UK, USA, Canada, UAE, Ethiopia and beyond. Our specialists operate across every jurisdiction the diaspora calls home.' },
    { title: 'The Relationship Continuity Premium', body: 'EthioTax remembers every engagement. We track your deadlines, send annual reminders and proactively advise.' },
    { title: 'The Amharic Accessibility Premium', body: 'Professional financial services in your language. English, Amharic or Afaan Oromoo — you choose, we deliver.' },
    { title: 'The Ecosystem Premium', body: 'EthioTax is the first pillar of a complete Ethiopian financial services ecosystem. BirrBank finance marketplace coming next.' },
  ],
  am: [
    { title: 'የምመርሚያ ባህሪት', body: 'በድርጅት ደስታቺነት ውስጥ የተመረጠ፣ የተከተተ፣ የምክንዘ እና የምረት የተቀለቀሉ ነው።' },
    { title: 'የተረድታዊ ባህሪት', body: 'ዓክ ጥያቂት። ዓክ የከቩያዘት ነጥባ። EthioTax እቅድ እስከአድሪስ ሁሉንም ይየጠል።' },
    { title: 'የምህበተኙ ባህሪት', body: 'አማርኛ፣ አፋን ዎሮሞ፣ ERCA፣ የኢትዮጵያ የድርጅት ጥግት እና የዲያስፖራ እደርግን እንደሮዱተለብናለን።' },
    { title: 'የካሊተክ ሙየ ባህሪት', body: 'እየቱንም አካዳጀ EthioTax ቢር እስከሀት በዳቀ ይከታተላል።' },
    { title: 'የአጦሣዊ እወቆት ባህሪት', body: 'እንግሊዘኛ፣ አሜሪካ፣ ካናዳ፣ ዩኤይ፣ ኢትዮጵያ እና ዓለም።' },
    { title: 'የስራ ንክት ባህሪት', body: 'EthioTax እየቱንም የምክንሳቡ ደህናነት አክብቷል።' },
    { title: 'የአማርኛ አደራሽነት ባህሪት', body: 'በዘመድ ቕንግዎች የምክንሳቡ ደሕናነት። እንግሊዝኛ፣ አማርኛ ወይም አፋን ዎሮሞ።' },
    { title: 'የክህለ ሥል ባህሪት', body: 'EthioTax የኢትዮጵያ የምረጥ የምክንሣቡ ድርጅት የመጀመሪውን ቅድሜ ምዘር ነው።' },
  ],
  om: [
    { title: 'Mirkaneessa Ogummaa', body: 'Oggeessi hundi network keenyaa leenjifamoo, eeramoo, hayyama qaba fi hordofama.' },
    { title: "Mijaa'ina", body: 'Gaaffii tokko. Quunnamtii tokko. EthioTax jalqabbii hanga xumuraatti hundumaa bulcha.' },
    { title: 'Hawaasa', body: 'Afaan Oromoo, Amaariffa, ERCA, seeraa daldala Itoophiyaa fi jireenya diasporaa ni hubanna.' },
    { title: 'Mirkaneessa Qulqullina', body: "Bu'aa hundumaa EthioTax siif ilaalee si bira ga'a. Sadarkaa ogummaa mirkana'e." },
    { title: "Ogummaa Daangaa Ce'u", body: 'Ingland, USA, Kaanaadaa, UAE, Itoophiyaa fi achi ol.' },
    { title: 'Itti Fufumsa Hariiroo', body: "EthioTax hirmaannaa hundumaa ni yaadata. Yeroo murtaa'aa hordofee yaadachiisaa fi gorsaa tursa." },
    { title: 'Tajaajila Afaan Oromoo', body: 'Tajaajila maallaqaa ogummaa afaan keetti. Inglizii, Amaariffa ykn Afaan Oromoo — ati filadduu, nuyi kennina.' },
    { title: 'Sirna Guutuu', body: 'EthioTax calqaba sirna tajaajila maallaqaa Itoophiyaa guutuu. BirrBank itti aanee dhufa.' },
  ],
}

const statsData = {
  en: [
    { value: '24hr', label: 'Response Guarantee', sublabel: 'Every inquiry, every channel' },
    { value: '72hr', label: 'Fixed-Fee Proposal', sublabel: 'Clear scope, clear price' },
    { value: '100%', label: 'Quality Checked', sublabel: 'Every deliverable reviewed' },
    { value: 'Global', label: 'Diaspora Coverage', sublabel: 'UK, USA, Canada, UAE, Ethiopia & more' },
  ],
  am: [
    { value: '24hr', label: 'የመለስ ካርታታ', sublabel: 'እየቱንም ጥያቂት፣ እየቱንም ገና' },
    { value: '72hr', label: 'የደከበተ ክሥል', sublabel: 'ነጹ ክረረት፣ ነፙ ውዳት' },
    { value: '100%', label: 'የተገመገመነ ካይተደረገ', sublabel: 'እየቱንም አካዳጀ የተከተተ' },
    { value: 'ዓለም', label: 'የዲያስፖራ ድብዘት', sublabel: 'እንግሊዘኛ፣ አሜሪካ፣ ካናዳ፣ ዩኤይ፣ ኢትዮጵያ እና ዓለም' },
  ],
  om: [
    { value: '24hr', label: 'Mirkaneessa Deebii', sublabel: 'Gaaffii hundumaa, karaa hundumaa' },
    { value: '72hr', label: "Sagantaa Gatii Murtaa'aa", sublabel: 'Daangaa ifaa, gatii ifaa' },
    { value: '100%', label: "Qulqullina Mirkana'e", sublabel: "Bu'aa hundumaa ilaalama" },
    { value: 'Addunyaa', label: 'Diasporaa', sublabel: 'Ingland, USA, Kaanaadaa, UAE, Itoophiyaa fi achi ol' },
  ],
}

const testiData = {
  en: [
    { initials: 'TA', name: 'Tigist A.', role: 'Business owner — London, UK', quote: 'EthioTax handled my UK Self Assessment quickly and professionally. They understood my situation straight away and the whole process was straightforward. I will not be going anywhere else.' },
    { initials: 'DM', name: 'Dawit M.', role: 'Finance professional — Washington DC, USA', quote: 'I needed advice on structuring a diaspora investment in Ethiopia. EthioTax provided a clear proposal within 72 hours and guided me through the entire process. Excellent service.' },
    { initials: 'SG', name: 'Selam G.', role: 'Business owner — Toronto, Canada', quote: 'Managing accounts across two countries was always complicated. EthioTax handled everything and I could communicate in Amharic throughout. Professional, reliable and highly recommended.' },
  ],
  am: [
    { initials: 'TA', name: 'Tigist A.', role: 'የድርጅት ባለቀኘ — ሎንደን፣ እንግሊዘኛ', quote: 'EthioTax የUK ሰልፍ አቀባልን በልዐ ኃነ የመረሰውን ኒቱን ጓት አባረቅ አደርገዘወ። ዓለም ዳካ ዓለም መሕደድ አይርጸም።' },
    { initials: 'DM', name: 'Dawit M.', role: 'የምረጥ የምክንሳቡ — ዋሺንጁን DC፣ አሜሪካ', quote: 'በኢትዮጵያ የዲያስፖራ ባለስላት ወር እንደማደርግ ብዊታ መክንሾን ፈለገዕ። EthioTax በ\u2072 ሳዓት ውስጥ ነፙ ካርታታ አቃርቡ፣ ዕድድውን ሙሉውን በሁሉ ኪንኑ።' },
    { initials: 'SG', name: 'Selam G.', role: 'የድርጅት ባለቀኘ — ተሮንቲ፣ ካናዳ', quote: 'በሁሉት ቔሰቃ ቐንት ደህናነት አዾገድዜ፣ ባለሁሉም ዪተዕ አክቦ ለመ፣ EthioTax ሁሉንም አደርጄማል። በሁሉም አማርኛውን ተገልጌደ ዓለ።' },
  ],
  om: [
    { initials: 'TA', name: 'Tigist A.', role: 'Abbaa daldala — London, UK', quote: 'EthioTax gibira dhuunfaa UK koo saffisaan fi ogummaan bulche. Haalli koo dafee hubatame. Bakka biraatti hin deemu.' },
    { initials: 'DM', name: 'Dawit M.', role: 'Oggeessa maallaqaa — Washington DC, USA', quote: "Maallaqaa diasporaa Itoophiyaa keessatti ijaaruuf gorsa barbaadeera. EthioTax sa'aatii 72 keessatti sagantaa ifaa dhiyeessee adeemsaa guutuu koo qajeelche." },
    { initials: 'SG', name: 'Selam G.', role: 'Abbaa daldala — Toronto, Kaanaadaa', quote: 'Herrega biyyoota lama keessatti bulchuu yeroo hunda ulfaataa ture. EthioTax hundumaa bulchee guutumaan Amaarifaan haasofuu dandeesse.' },
  ],
}

export function ETHomePage() {
  const { language } = useETLanguage()
  const h = heroData[language] ?? heroData.en
  const steps = stepsData[language] ?? stepsData.en
  const pillars = pillarsData[language] ?? pillarsData.en
  const trustPoints = trustData[language] ?? trustData.en
  const stats = statsData[language] ?? statsData.en
  const testimonials = testiData[language] ?? testiData.en

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 flex items-center">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(ellipse at top left, #1A4731 0%, transparent 60%)' }} />
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10" style={{ background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)' }} />
        </div>
        <div className="container-site relative z-10 py-20 md:py-32">
          <div className="max-w-4xl">
            <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-7">{h.eyebrow}</p>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              {h.h1a}
              <br />
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {h.h1b}
              </span>
              <br />
              {h.h1c}
            </h1>
            <p className="text-white/65 text-xl leading-relaxed mb-6 max-w-2xl">{h.body}</p>
            <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">{h.sub}</p>
            <div className="flex flex-col sm:flex-row items-stretch gap-3 mb-16">
              <Link href="/wa" target="_blank" rel="noopener noreferrer" className="sm:flex-1 inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                {h.cta1}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/get-help" className="sm:flex-1 inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all">
                {h.cta2}
              </Link>
            </div>
            <div className="w-full mb-10">
              <HeroSearch placeholder={h.search} />
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {[
                { value: 'Tax & Accounting', label: h.profServices === 'Professional Services' ? 'for individuals & businesses' : h.profServices },
                { value: 'Cross-Border', label: 'expertise' },
                { value: 'Amharic & Afaan Oromoo', label: 'service available' },
                { value: 'Global', label: 'diaspora coverage' },
              ].map(item => (
                <div key={item.label} className="flex items-baseline gap-2">
                  <span className="text-white font-display text-xl">{item.value}</span>
                  <span className="text-white/40 text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-16">
            <span className="eyebrow mb-3 block">How It Works</span>
            <h2 className="section-title mb-4">{h.howTitle}</h2>
            <p className="text-slate-500 text-lg leading-relaxed">{h.howBody}</p>
          </div>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-5">
            {steps.map((step, i) => (
              <div key={step.step} className="relative flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-8">
                {i < steps.length - 1 && <div className="hidden md:block absolute top-9 left-[calc(50%+2.5rem)] right-0 h-px bg-slate-200" />}
                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-gold-500 mb-6 shadow-sm">
                  <span className="font-display text-xl font-bold text-gold-500">{step.step}</span>
                </div>
                <h3 className="font-display text-lg text-navy-950 mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/get-help" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
              {h.quote}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold border-2 transition-colors" style={{ borderColor: '#1A4731', color: '#1A4731' }}>
              {h.seeHow}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Professional Services */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl mb-14">
            <span className="eyebrow mb-3 block">What EthioTax Offers</span>
            <h2 className="section-title mb-4">{h.servicesTitle}</h2>
            <p className="text-slate-500 text-lg leading-relaxed">{h.servicesBody}</p>
          </div>
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white">
                <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#1A4731'}} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{color: '#1A4731'}}>{h.profServices}</span>
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {pillars.map((pillar) => (
                <Link key={pillar.id} href={pillar.href} className="group flex flex-col bg-white rounded-xl border-2 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200" style={{borderColor: '#1A4731'}}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{backgroundColor: '#1A4731'}}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="1.75" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <h3 className="font-display text-lg mb-2 group-hover:opacity-80" style={{color: '#1A4731'}}>{pillar.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">{pillar.description}</p>
                  <ul className="space-y-1.5 mb-5">
                    {pillar.highlights.map((hl: string) => (
                      <li key={hl} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: '#C9982A'}} />
                        {hl}
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="container-site py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={stat.label} className={`flex flex-col items-start ${i < 3 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{backgroundColor: '#f0f7f4'}}>
                  <span className="text-lg font-bold" style={{color: '#1A4731'}}>&#10003;</span>
                </div>
                <span className="stat-number mb-1" style={{color: '#1A4731'}}>{stat.value}</span>
                <span className="text-sm font-semibold text-navy-950">{stat.label}</span>
                <span className="text-xs text-slate-400 mt-0.5">{stat.sublabel}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why EthioTax */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-14">
            <span className="eyebrow mb-3 block">{h.statsTitle}</span>
            <h2 className="section-title mb-4">{h.statsH2}</h2>
            <p className="text-slate-500 text-lg leading-relaxed">{h.statsBody}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
            {trustPoints.map((point, i) => (
              <div key={point.title} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-white text-sm font-bold shrink-0" style={{backgroundColor: '#1A4731'}}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h4 className="font-semibold text-sm mb-2" style={{color: '#1A4731'}}>{point.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section" style={{ backgroundColor: '#f0f7f4' }}>
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">{h.clientStories}</span>
            <h2 className="section-title mb-4">{h.whatClientsSay}</h2>
            <p className="text-slate-500 text-lg leading-relaxed">{h.clientsBody}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ initials, name, role, quote: q }) => (
              <div key={name} className="bg-white rounded-2xl p-8 shadow-sm border-t-4 flex flex-col" style={{ borderTopColor: '#C9982A' }}>
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="16" height="16" viewBox="0 0 16 16" fill="#C9982A"><path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1-3-2.9 4.2-.9z"/></svg>
                  ))}
                </div>
                <div className="text-4xl font-display leading-none mb-3 opacity-40" style={{ color: '#1A4731' }}>&ldquo;</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 flex-1">{q}</p>
                <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: '#e8f0eb' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white" style={{ backgroundColor: '#1A4731' }}>{initials}</div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                    <p className="text-gray-400 text-xs">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
