/*
 * Whitelist-based HTML sanitizer ported from insane@2.6.2 (https://github.com/bevacqua/insane,
 * MIT, (c) Nicolas Bevacqua). Behaviour is unchanged except that a valueless `class`
 * attribute is dropped instead of throwing a TypeError.
 */
import { parse, ParserHandler, VOID_ELEMENTS } from './parser';

export type SanitizerToken = {
  tag: string;
  attrs: Record<string, string | undefined>;
};

export type SanitizerOptions = {
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  allowedSchemes: string[];
  allowedClasses?: Record<string, string[]>;
  filter?: (token: SanitizerToken) => boolean;
  transformText?: (text: string) => string;
};

export type EntityCodec = {
  encode: (value: string) => string;
  decode: (value: string) => string;
};

const URI_ATTRIBUTES: Record<string, true> = {
  background: true,
  base: true,
  cite: true,
  href: true,
  longdesc: true,
  src: true,
  usemap: true,
};

export function sanitizeHtml(html: string, options: SanitizerOptions, codec: EntityCodec): string {
  const buffer: string[] = [];
  parse(html, createHandler(buffer, options, codec.encode), codec.decode);
  return buffer.join('');
}

function createHandler(buffer: string[], o: SanitizerOptions, encode: (value: string) => string): ParserHandler {
  let context: { ignoring: string | false; depth: number };

  reset();

  return { start, end, chars };

  function out(value: string) {
    buffer.push(value);
  }

  function start(tag: string, attrs: Record<string, string | undefined>, unary: boolean) {
    const low = tag.toLowerCase();

    if (context.ignoring) {
      ignore(low);
      return;
    }
    if ((o.allowedTags || []).indexOf(low) === -1) {
      ignore(low);
      return;
    }
    if (o.filter && !o.filter({ tag: low, attrs })) {
      ignore(low);
      return;
    }

    out('<');
    out(low);
    Object.keys(attrs).forEach(parseAttribute);
    out(unary ? '/>' : '>');

    function parseAttribute(key: string) {
      let value = attrs[key];
      const classesOk = (o.allowedClasses || {})[low] || [];
      const attrsOk = (o.allowedAttributes || {})[low] || [];
      let valid: boolean;
      const lkey = key.toLowerCase();
      if (lkey === 'class' && attrsOk.indexOf(lkey) === -1) {
        value = (value ?? '')
          .split(' ')
          .filter((className) => classesOk.indexOf(className) !== -1)
          .join(' ')
          .trim();
        valid = value.length > 0;
      } else {
        valid = attrsOk.indexOf(lkey) !== -1 && (URI_ATTRIBUTES[lkey] !== true || testUrl(value as string));
      }
      if (valid) {
        out(' ');
        out(key);
        if (typeof value === 'string') {
          out('="');
          out(encode(value));
          out('"');
        }
      }
    }
  }

  function end(tag: string) {
    const low = tag.toLowerCase();
    const allowed = (o.allowedTags || []).indexOf(low) !== -1;
    if (allowed) {
      if (context.ignoring === false) {
        out('</');
        out(low);
        out('>');
      } else {
        unignore(low);
      }
    } else {
      unignore(low);
    }
  }

  function testUrl(text: string): boolean {
    const first = text[0];
    if (first === '#' || first === '/') {
      return true;
    }
    const colon = text.indexOf(':');
    if (colon === -1) {
      return true;
    }
    const questionmark = text.indexOf('?');
    if (questionmark !== -1 && colon > questionmark) {
      return true;
    }
    const hash = text.indexOf('#');
    if (hash !== -1 && colon > hash) {
      return true;
    }
    return o.allowedSchemes.some((scheme) => text.indexOf(scheme + ':') === 0);
  }

  function chars(text: string) {
    if (context.ignoring === false) {
      out(o.transformText ? o.transformText(text) : text);
    }
  }

  function ignore(tag: string) {
    if (VOID_ELEMENTS[tag]) {
      return;
    }
    if (context.ignoring === false) {
      context = { ignoring: tag, depth: 1 };
    } else if (context.ignoring === tag) {
      context.depth++;
    }
  }

  function unignore(tag: string) {
    if (context.ignoring === tag) {
      if (--context.depth <= 0) {
        reset();
      }
    }
  }

  function reset() {
    context = { ignoring: false, depth: 0 };
  }
}
