/*
 * Minimal entity codec used in browser builds instead of `he` (mapped through the
 * "browser" field of package.json), ported from insane@2.6.2's she.js (MIT,
 * (c) Nicolas Bevacqua) so that browser output stays byte-identical to the
 * insane-based releases. Written as an ES module with a default export so it works
 * both for `import he from 'he'` (index.mjs) and bundled `require('he')` (index.js).
 */
var escapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
var unescapes = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};
var rescaped = /(&amp;|&lt;|&gt;|&quot;|&#39;)/g;
var runescaped = /[&<>"']/g;

function escapeHtmlChar(match) {
  return escapes[match];
}
function unescapeHtmlChar(match) {
  return unescapes[match];
}

export function encode(text) {
  return text == null ? '' : String(text).replace(runescaped, escapeHtmlChar);
}

export function decode(html) {
  return html == null ? '' : String(html).replace(rescaped, unescapeHtmlChar);
}

export default { encode: encode, decode: decode };
