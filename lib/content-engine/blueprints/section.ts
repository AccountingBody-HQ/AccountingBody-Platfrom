// A small helper so every blueprint section is written the same way.
import type { BlockType, BlueprintSection } from '../types'

export function section(
  id: string,
  title: string,
  purpose: string,
  words: [number, number],
  requiredBlockTypes: BlockType[],
  optional = false,
): BlueprintSection {
  return { id, title, purpose, minWords: words[0], maxWords: words[1], requiredBlockTypes, optional }
}
