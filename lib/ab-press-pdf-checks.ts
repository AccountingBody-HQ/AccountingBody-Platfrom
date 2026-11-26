// The PDF checks AB Press shares between the screen and the server routes
// (owner decision D349). pdf-lib only, loaded when a check runs, so the module
// is safe in the browser and on the server.
import type { PDFDict as PDFDictType } from 'pdf-lib'

// Whether every font of a PDF is embedded, as KDP asks (owner decision D346):
// each font's descriptor holds its font file; a Type 0 font is judged by its
// descendant fonts; a Type 3 font draws its own glyphs. false when the PDF
// cannot be read.
export async function fontsEmbedded(bytes: Uint8Array): Promise<boolean> {
  try {
    const { PDFDocument, PDFDict, PDFName, PDFArray } = await import('pdf-lib')
    const doc = await PDFDocument.load(bytes)
    const embedded = (font: PDFDictType): boolean => {
      const subtype = font.lookup(PDFName.of('Subtype'))
      if (subtype === PDFName.of('Type3')) return true
      if (subtype === PDFName.of('Type0')) {
        const kids = font.lookup(PDFName.of('DescendantFonts'))
        return kids instanceof PDFArray && kids.size() > 0 &&
          kids.asArray().every(kid => { const d = doc.context.lookup(kid); return d instanceof PDFDict && embedded(d) })
      }
      const descriptor = font.lookup(PDFName.of('FontDescriptor'))
      return descriptor instanceof PDFDict && ['FontFile', 'FontFile2', 'FontFile3'].some(key => descriptor.has(PDFName.of(key)))
    }
    return doc.context.enumerateIndirectObjects().every(([, object]) =>
      !(object instanceof PDFDict) || object.lookup(PDFName.of('Type')) !== PDFName.of('Font') || embedded(object))
  } catch {
    return false
  }
}
