/* eslint-disable @typescript-eslint/no-explicit-any */
// HTML → Portable Text blocks
// Converts plain HTML (WordPress-stripped) into minimal Portable Text blocks
// so BookTemplate / docx export can render without modification.
export function htmlToBlocks(html: string): any[] {
  if (!html) return []
  const text = html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n__H__$1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n__LI__$1")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, i) => {
      if (line.startsWith("__H__")) {
        return {
          _type: "block", _key: `b${i}`, style: "h2", markDefs: [],
          children: [{ _type: "span", text: line.replace("__H__", ""), marks: [] }],
        }
      }
      if (line.startsWith("__LI__")) {
        return {
          _type: "block", _key: `b${i}`, style: "normal", listItem: "bullet", markDefs: [],
          children: [{ _type: "span", text: line.replace("__LI__", ""), marks: [] }],
        }
      }
      return {
        _type: "block", _key: `b${i}`, style: "normal", markDefs: [],
        children: [{ _type: "span", text: line, marks: [] }],
      }
    })
}
