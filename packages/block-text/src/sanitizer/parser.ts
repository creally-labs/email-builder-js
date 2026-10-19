/*
 * HTML tokenizer ported from insane@2.6.2 (https://github.com/bevacqua/insane, MIT,
 * (c) Nicolas Bevacqua).
 *
 * insane matches start and end tags with backtracking regular expressions that run in
 * exponential (start tag, CVE-2020-26303 / GHSA-w455-mfq9-hf74) and quadratic (end tag)
 * time on crafted input. This port keeps the exact language and captures of those
 * expressions but matches tags with hand-written, linear-time scanners:
 *
 *   rstart = /^<\s*([\w:-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)\s*>/
 *   rend   = /^<\s*\/\s*([\w:-]+)[^>]*>/
 *
 * Everything else (comment handling, text handling, the attribute regex, the "discard the
 * rest of the input on an unparseable tag" behaviour, the open-element stack) is unchanged.
 */

export type ParserHandler = {
  start: (tag: string, attrs: Record<string, string | undefined>, unary: boolean) => void;
  end: (tag: string) => void;
  chars: (text: string) => void;
};

export type Decode = (value: string) => string;

type StartTagMatch = {
  length: number;
  tagName: string;
  rest: string;
  unary: string;
};

type EndTagMatch = {
  length: number;
  tagName: string;
};

export const VOID_ELEMENTS: Record<string, true> = {
  area: true,
  br: true,
  col: true,
  hr: true,
  img: true,
  wbr: true,
  input: true,
  base: true,
  basefont: true,
  link: true,
  meta: true,
};

const rattrs = /([\w:-]+)(?:\s*=\s*(?:(?:"((?:[^"])*)")|(?:'((?:[^'])*)')|([^>\s]+)))?/g;
const rtag = /^</;
const rtagend = /^<\s*\//;
const rws = /\s/;

function isWhitespace(s: string, i: number): boolean {
  if (i >= s.length) {
    return false;
  }
  const c = s.charCodeAt(i);
  if (c < 128) {
    return c === 32 || (c >= 9 && c <= 13);
  }
  return rws.test(s[i]);
}

function isNameChar(s: string, i: number): boolean {
  if (i >= s.length) {
    return false;
  }
  const c = s.charCodeAt(i);
  return (
    (c >= 48 && c <= 57) || // 0-9
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    c === 95 || // _
    c === 58 || // :
    c === 45 // -
  );
}

function skipWhitespace(s: string, i: number): number {
  while (isWhitespace(s, i)) {
    i++;
  }
  return i;
}

function skipName(s: string, i: number): number {
  while (isNameChar(s, i)) {
    i++;
  }
  return i;
}

/**
 * Positions at which one `\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?` repetition
 * starting at `p` can end, in the order a backtracking regex engine would try them.
 */
function attributeEnds(s: string, p: number): number[] {
  if (!isWhitespace(s, p)) {
    return [];
  }
  const nameStart = skipWhitespace(s, p);
  const nameEnd = skipName(s, nameStart);
  if (nameEnd === nameStart) {
    return [];
  }
  const ends: number[] = [];
  let i = skipWhitespace(s, nameEnd);
  if (s[i] === '=') {
    i = skipWhitespace(s, i + 1);
    const quote = s[i];
    if (quote === '"' || quote === `'`) {
      const close = s.indexOf(quote, i + 1);
      if (close !== -1) {
        ends.push(close + 1);
      }
    }
    let unquotedEnd = i;
    while (unquotedEnd < s.length && s[unquotedEnd] !== '>' && !isWhitespace(s, unquotedEnd)) {
      unquotedEnd++;
    }
    for (let e = unquotedEnd; e > i; e--) {
      ends.push(e);
    }
  }
  ends.push(nameEnd);
  return ends;
}

/** `\s*(\/?)\s*>` anchored at `p`. */
function matchTagClose(s: string, p: number): { end: number; unary: string } | null {
  let i = skipWhitespace(s, p);
  let unary = '';
  if (s[i] === '/') {
    unary = '/';
    i++;
  }
  i = skipWhitespace(s, i);
  if (s[i] !== '>') {
    return null;
  }
  return { end: i + 1, unary };
}

/**
 * Linear-time equivalent of `html.match(rstart)`.
 *
 * The attribute list is a greedy `(...)*` whose repetitions are ambiguous, which is what
 * makes the regex backtrack exponentially. Because the expression has no back-references,
 * whether "the rest of the pattern matches from position p" depends only on p, so a
 * depth-first search in the regex's own priority order that remembers failed positions
 * finds the very same match the regex would, visiting each position at most once.
 */
export function matchStartTag(s: string): StartTagMatch | null {
  if (s[0] !== '<') {
    return null;
  }
  const nameStart = skipWhitespace(s, 1);
  const nameEnd = skipName(s, nameStart);
  if (nameEnd === nameStart) {
    return null;
  }

  const failed = new Set<number>();
  const stack: { position: number; candidates: number[]; next: number }[] = [
    { position: nameEnd, candidates: attributeEnds(s, nameEnd), next: 0 },
  ];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next < frame.candidates.length) {
      const candidate = frame.candidates[frame.next++];
      if (failed.has(candidate)) {
        continue;
      }
      if (isWhitespace(s, candidate)) {
        stack.push({ position: candidate, candidates: attributeEnds(s, candidate), next: 0 });
        continue;
      }
      // no further attribute can start here, only the tag close can follow
      const close = matchTagClose(s, candidate);
      if (close) {
        return startTagMatch(s, nameStart, nameEnd, candidate, close);
      }
      failed.add(candidate);
      continue;
    }
    const close = matchTagClose(s, frame.position);
    if (close) {
      return startTagMatch(s, nameStart, nameEnd, frame.position, close);
    }
    failed.add(frame.position);
    stack.pop();
  }
  return null;
}

function startTagMatch(
  s: string,
  nameStart: number,
  nameEnd: number,
  attributesEnd: number,
  close: { end: number; unary: string }
): StartTagMatch {
  return {
    length: close.end,
    tagName: s.substring(nameStart, nameEnd),
    rest: s.substring(nameEnd, attributesEnd),
    unary: close.unary,
  };
}

/** Linear-time equivalent of `html.match(rend)`. */
export function matchEndTag(s: string): EndTagMatch | null {
  if (s[0] !== '<') {
    return null;
  }
  let i = skipWhitespace(s, 1);
  if (s[i] !== '/') {
    return null;
  }
  const nameStart = skipWhitespace(s, i + 1);
  const nameEnd = skipName(s, nameStart);
  if (nameEnd === nameStart) {
    return null;
  }
  i = s.indexOf('>', nameEnd);
  if (i === -1) {
    return null;
  }
  return { length: i + 1, tagName: s.substring(nameStart, nameEnd) };
}

export function parse(input: string, handler: ParserHandler, decode: Decode): void {
  const stack: string[] = [];
  let html = input;
  let last = html;
  let chars: boolean;

  while (html) {
    parsePart();
  }
  parseEndTag(); // clean up any remaining tags

  function parsePart() {
    chars = true;
    parseTag();

    const same = html === last;
    last = html;

    if (same) {
      // discard, because it's invalid
      html = '';
    }
  }

  function parseTag() {
    if (html.substring(0, 4) === '<!--') {
      parseComment();
    } else if (rtagend.test(html)) {
      const match = matchEndTag(html);
      if (match) {
        html = html.substring(match.length);
        parseEndTag(match.tagName);
        chars = false;
      }
    } else if (rtag.test(html)) {
      const match = matchStartTag(html);
      if (match) {
        html = html.substring(match.length);
        parseStartTag(match.tagName, match.rest, match.unary);
        chars = false;
      }
    }
    parseTagDecode();
  }

  function parseComment() {
    const index = html.indexOf('-->');
    if (index >= 0) {
      html = html.substring(index + 3);
      chars = false;
    }
  }

  function parseTagDecode() {
    if (!chars) {
      return;
    }
    let text: string;
    const index = html.indexOf('<');
    if (index >= 0) {
      text = html.substring(0, index);
      html = html.substring(index);
    } else {
      text = html;
      html = '';
    }
    handler.chars(text);
  }

  function parseStartTag(tagName: string, rest: string, unary: string) {
    const attrs: Record<string, string | undefined> = {};
    const low = tagName.toLowerCase();
    const u = VOID_ELEMENTS[low] || Boolean(unary);

    rest.replace(rattrs, attrReplacer);

    if (!u) {
      stack.push(low);
    }
    handler.start(low, attrs, u);

    function attrReplacer(
      match: string,
      name: string,
      doubleQuotedValue: string | undefined,
      singleQuotedValue: string | undefined,
      unquotedValue: string | undefined
    ): string {
      if (doubleQuotedValue === undefined && singleQuotedValue === undefined && unquotedValue === undefined) {
        attrs[name] = undefined; // attribute is like <button disabled></button>
      } else {
        attrs[name] = decode(doubleQuotedValue || singleQuotedValue || unquotedValue || '');
      }
      return match;
    }
  }

  function parseEndTag(tagName?: string) {
    let pos = 0;
    const low = tagName === undefined ? undefined : tagName.toLowerCase();
    if (low) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos] === low) {
          break; // find the closest opened tag of the same type
        }
      }
    }
    if (pos >= 0) {
      for (let i = stack.length - 1; i >= pos; i--) {
        handler.end(stack[i]); // close all the open elements, up the stack
      }
      stack.length = pos;
    }
  }
}
