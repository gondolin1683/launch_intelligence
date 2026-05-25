// Anthropic-specific: pull citations out of a Messages API response's content blocks.
// Web-search citations appear both as `citations` on text blocks and inside
// `web_search_tool_result` blocks.

export function extractCitations(content) {
  const out = [];
  for (const block of content ?? []) {
    if (Array.isArray(block?.citations)) {
      for (const c of block.citations) {
        if (c?.url) out.push({ title: c.title ?? c.url, url: c.url });
      }
    }
    if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r?.url) out.push({ title: r.title ?? r.url, url: r.url });
      }
    }
  }
  const seen = new Set();
  const deduped = [];
  for (const c of out) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    deduped.push(c);
  }
  return deduped;
}
