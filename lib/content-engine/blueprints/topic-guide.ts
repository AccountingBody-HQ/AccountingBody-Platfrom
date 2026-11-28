// Topic guide: one blueprint for the seven guide content types. The shared
// sections come from what every guide in the content generator has in
// common; each preset adds that guide's own sections (placed before
// common-errors) and fixes its subject.
import type { Blueprint } from '../types'
import { section } from './section'

export const TOPIC_GUIDE: Blueprint = {
  id: 'topic-guide',
  version: '1.0.0',
  contentTypes: [
    'accounting-guide',
    'management-accounting-guide',
    'tax-guide',
    'audit-assurance-guide',
    'financial-management-guide',
    'ethics-professional-standards-guide',
    'business-law-regulation-guide',
  ],
  purpose: 'A technically precise, professionally authoritative guide on one topic, suitable for qualified professionals and for students at advanced professional level. Must go beyond surface definitions into practical application, professional judgement, and real-world complexity.',
  output: 'document',
  sections: [
    section('topic-overview', 'Topic overview', 'What this area covers, the professional problems it solves, the framework or authority that governs it (named, never reproduced), and why it matters in practice.', [100, 200], ['paragraph']),
    section('core-principles', 'Core principles', 'The fundamental rules and principles, explained in plain professional language and original teaching wording.', [150, 300], ['paragraph']),
    section('practical-application', 'Practical application with worked illustration', 'A full worked example or scenario using an invented organisation (realistic name, specific non-round figures, realistic situation). Show full workings and explain every step.', [150, 350], ['worked_example']),
    section('common-errors', 'Common errors', 'Specific, named mistakes professionals and preparers make in this area, each with the mechanism and the correct approach — never generic cautions.', [120, 250], ['common_mistake']),
    section('key-takeaways', 'Key takeaways', 'Points for immediate professional or examination application.', [60, 160], ['takeaway']),
  ],
  totalWords: { min: 1100, max: 2200 },
  presets: {
    'accounting-guide': {
      subject: 'financial-accounting',
      emphasis: 'A financial accounting or financial reporting topic for qualified accountants, financial controllers, CFOs and advanced students: recognition, measurement, judgement, disclosure and the differences between frameworks.',
      extraSections: [
        section('applicable-standards', 'Applicable standards and framework', 'Which accounting standards govern this area (referenced by name only — IFRS X, IAS X, FRS X — never reproduce standard text), explained in original teaching language.', [100, 200], ['list']),
        section('key-judgements', 'Key judgements and estimates', 'Where professional judgement is required, what factors influence it, the consequences of different judgements, and how auditors scrutinise this area.', [100, 250], ['paragraph']),
        section('disclosure-requirements', 'Disclosure requirements', 'What must be disclosed in financial statements, where, in what form, and the practical disclosure challenges.', [80, 200], ['list']),
        section('framework-differences', 'Differences between IFRS and UK/US GAAP', 'Where frameworks diverge materially and the practical implication of each divergence.', [80, 200], ['table']),
      ],
    },
    'management-accounting-guide': {
      subject: 'management-accounting',
      emphasis: 'A management accounting topic for management accountants, finance business partners, FP&A professionals and advanced students, connecting technical mechanics to real business decisions.',
      extraSections: [
        section('conceptual-framework', 'Conceptual framework', 'The theory and principles behind this technique, explained through a practical lens without unnecessary abstraction.', [100, 200], ['paragraph']),
        section('strengths-limitations', 'Strengths and limitations', 'Where this technique works well and where it breaks down — what a sophisticated practitioner knows that a student might not.', [100, 250], ['table']),
        section('decision-making', 'Integration with business decision-making', 'How this technique connects to broader business decisions, strategy, and other management accounting tools.', [100, 200], ['paragraph']),
      ],
    },
    'tax-guide': {
      subject: 'taxation',
      emphasis: 'A tax topic for accounting professionals and business owners, usable as a starting framework with professional caveats throughout. Every rate, threshold and deadline is tied to the "valid as at" date and the authority that sets it.',
      extraSections: [
        section('key-calculations', 'Key calculations', 'Full worked calculations as clearly structured numbered steps.', [100, 250], ['calculation']),
        section('planning-considerations', 'Common planning considerations', 'Legitimate planning points a professional adviser would consider, framed as general guidance, never as specific advice.', [80, 200], ['list']),
        section('compliance-obligations', 'Compliance obligations', 'What must be filed, when, with which authority, and the consequences of non-compliance.', [80, 200], ['list']),
        section('professional-caveats', 'Professional caveats', 'A clear statement that tax law changes frequently, rates and thresholds require verification with official sources, and professional advice should be sought for specific situations.', [40, 120], ['key_point']),
      ],
    },
    'audit-assurance-guide': {
      subject: 'audit-assurance',
      emphasis: 'An audit or assurance topic for audit professionals, advanced students and finance professionals who work with auditors.',
      extraSections: [
        section('audit-process', 'The audit process in this area', 'How audit work in this area is planned and executed: risk assessment, evidence gathering, and evaluation.', [100, 250], ['list']),
        section('professional-scepticism', 'Professional scepticism and judgement', 'Where professional scepticism matters most, what red flags to look for, and how experienced auditors approach this area differently.', [100, 200], ['key_point']),
        section('reporting-implications', 'Reporting implications', "How issues in this area affect the auditor's report and communication with those charged with governance.", [80, 200], ['paragraph']),
      ],
    },
    'financial-management-guide': {
      subject: 'financial-management',
      emphasis: 'A corporate finance or financial management topic for finance directors, treasury professionals, CFOs and advanced students, analytically rigorous.',
      extraSections: [
        section('theoretical-framework', 'Theoretical framework', 'The key financial theory underpinning this area, with a critical perspective on its real-world applicability.', [100, 200], ['paragraph']),
        section('mechanics', 'The mechanics', 'How the concept or technique works, with its mathematical foundations explained clearly as numbered steps.', [100, 250], ['calculation']),
        section('real-world-limitations', 'Real-world application and limitations', 'How this is applied in practice versus the theoretical model, and what experienced finance directors know about its limits.', [80, 200], ['paragraph']),
        section('risk-considerations', 'Risk considerations', 'The financial, market, or operational risks relevant to this area.', [80, 200], ['list']),
      ],
    },
    'ethics-professional-standards-guide': {
      subject: 'ethics-professional-standards',
      emphasis: 'A professional ethics or standards topic in accounting and finance, going beyond rule-recitation into genuine ethical reasoning and real-world application.',
      extraSections: [
        section('ethical-framework', 'The ethical framework', 'The relevant ethical principles and professional standards framework, referenced in general terms, never reproduced.', [100, 200], ['paragraph']),
        section('identifying-issues', 'Identifying the ethical issues', 'How to recognise when this issue arises in practice, including subtle and ambiguous situations.', [100, 200], ['list']),
        section('when-to-escalate', 'When to escalate', 'Triggers for escalation, to whom, and how — including whistleblowing considerations where relevant.', [80, 200], ['list']),
      ],
    },
    'business-law-regulation-guide': {
      subject: 'business-law-regulation',
      emphasis: 'A business law or regulatory topic for accounting and finance professionals, usable as a professional orientation guide, with clear caveats that it is not legal advice.',
      extraSections: [
        section('practical-implications', 'Practical implications for accountants and finance professionals', 'How this area of law affects the day-to-day work of accounting and finance professionals.', [100, 200], ['paragraph']),
        section('compliance-obligations', 'Key compliance obligations', 'What organisations must do, by when, and the consequences of non-compliance.', [80, 200], ['list']),
        section('professional-caveats', 'Professional caveats', 'A clear statement that this is general guidance, law changes, and specific situations require qualified legal advice.', [40, 120], ['key_point']),
      ],
    },
  },
  rules: [
    'Follow the preset emphasis for this content type.',
    'The key takeaways block has 6 or 7 points (a takeaway block holds at most 7).',
    'For tax and legal content: never state a rate, threshold or legal position as permanent or definitive; always name the relevant authority and give the jurisdiction context.',
  ],
}
