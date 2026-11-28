// Article: a professional insight piece. Sections and word ranges follow the
// Studio article structure; the purposes also carry the content generator's
// Article standard.
import type { Blueprint } from '../types'
import { section } from './section'

export const ARTICLE: Blueprint = {
  id: 'article',
  version: '1.0.0',
  contentTypes: ['article'],
  purpose: 'A high-quality, professionally authoritative article on an accounting, finance, or business topic relevant to the AccountingBody audience. Must deliver genuine professional insight — not a generic explainer. Must be the best article available online on this specific topic.',
  output: 'document',
  sections: [
    section('introduction', 'Introduction', 'Open with a hook: a striking fact, a common misconception, or a professional scenario that makes the reader want to continue. State clearly what the article covers and why it matters. The first sentence must compel the reader to read the second.', [150, 200], ['paragraph']),
    section('core-concept', 'Core concept explained', 'Define the central concept with precision. Explain it from first principles — assume zero prior knowledge. Include one concrete, original worked example or analogy.', [200, 300], ['paragraph']),
    section('key-principles', 'Key principles or components', 'Use a level-3 heading for each principle or component: minimum 3, maximum 5, each 60-100 words. Each principle must be actionable or applicable — not just descriptive.', [300, 400], ['heading', 'paragraph']),
    section('real-world-application', 'Real-world application or example', 'A realistic, original scenario involving a named fictional entity. Show the concept in action with specific figures where relevant. Draw an explicit lesson from the example.', [150, 200], ['paragraph']),
    section('common-misconceptions', 'Common misconceptions or pitfalls', 'Identify 2-3 specific, named misconceptions that professionals actually hold. Explain precisely why each is wrong. No generic "be careful" warnings.', [150, 200], ['common_mistake']),
    section('professional-implications', 'Implications for professionals', 'What this means for a practising accountant, finance director, or exam candidate right now. Actionable insight, not general commentary.', [150, 200], ['paragraph']),
    section('key-takeaways', 'Key takeaways', 'Exactly 4 points, each one crisp, complete sentence that stands alone. No point may begin with the same word as another.', [20, 120], ['takeaway']),
    section('conclusion', 'Conclusion', 'Synthesise — do not summarise. Connect the concept to the bigger picture. End with a forward-looking or thought-provoking closing sentence. A definitive, opinionated close.', [100, 150], ['paragraph']),
  ],
  totalWords: { min: 1200, max: 1800 },
  rules: [
    'Naturally use the primary topic phrase and 3-5 closely related search terms; the title, the first paragraph and at least two headings contain the topic phrase or a close variant.',
    'Short paragraphs: at most 5 sentences each.',
    'The key takeaways block has exactly 4 points.',
  ],
}
