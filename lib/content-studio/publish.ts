// What the screen sends to the existing publish route once an answer passes
// the gate: the site's own question bundle (made by the site's normaliser),
// the note it belongs to and the quality record.
import type { CompiledPrompt, Scorecard } from '@/lib/content-engine'
import { normalise, validateNormalisedBundle, type NormalisedBundle } from '@/lib/question-normaliser'
import { checkPublishBundle } from '@/lib/question-publish-checks'
import { OUTSIDE_AI_MODEL, STUDIO_MODEL } from './config'
import type { StudyNote } from './note'
import { WORDING } from './wording'

export type Door = 'copy' | 'generate'

export interface PublishPayload {
  bundle: NormalisedBundle
  articleSlug: string
  registry: { promptId: string; promptVersion: string; model: string; qualityScore: number }
}

export function setTitleOf(noteTitle: string): string {
  return `${noteTitle} — Practice Questions`
}

export function publishPayloadOf(
  note: StudyNote,
  compiled: CompiledPrompt,
  card: Scorecard,
  door: Door,
): { ok: true; payload: PublishPayload } | { ok: false; message: string } {
  const notReady = { ok: false as const, message: WORDING.notPublishable }
  const output = card.output
  if (!card.ok || !output || !('questionSet' in output)) return notReady
  let bundle: NormalisedBundle
  try {
    const result = normalise(output.questionSet)
    if (result.warnings.length > 0) return notReady
    bundle = result.bundle
  } catch {
    return notReady
  }
  bundle.title = setTitleOf(note.title)
  bundle.excerpt = output.summary
  bundle.topic = note.title
  if (validateNormalisedBundle(bundle).length > 0) return notReady
  if (!checkPublishBundle(bundle).ok) return notReady
  return {
    ok: true,
    payload: {
      bundle,
      articleSlug: note.contentId,
      registry: {
        promptId: compiled.promptId,
        promptVersion: compiled.promptVersion,
        model: door === 'generate' ? STUDIO_MODEL : OUTSIDE_AI_MODEL,
        qualityScore: card.score,
      },
    },
  }
}
