/*
 * Browsers ignore ASCII tab/newline anywhere in a URL and strip leading C0 control
 * characters and spaces before reading the scheme, so `java\tscript:` and
 * ` javascript:` are still script URLs. Normalise the same way before checking.
 */
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const TAB_OR_NEWLINE = /[\t\n\r]/g;
const SAFE_DATA_IMAGE = /^data:image\/(?:png|gif|jpe?g|webp|bmp)[;,]/i;

export const LINK_SCHEMES = ['http', 'https', 'mailto', 'tel'];
export const IMAGE_SCHEMES = ['http', 'https', 'cid'];

/**
 * Returns `url` unchanged when it is relative (`/path`, `#anchor`, `?query`, `//host`,
 * `{{placeholder}}`, ...) or uses one of `allowedSchemes`, and `null` otherwise
 * (`javascript:`, `vbscript:`, `data:`, ...). Template placeholders are kept because
 * consumers substitute variables into the rendered HTML afterwards.
 */
export function sanitizeUrl(url: string, allowedSchemes: string[], allowDataImages = false): string | null {
  const normalized = stripLeadingControls(url.replace(TAB_OR_NEWLINE, ''));
  const match = SCHEME.exec(normalized);
  if (!match) {
    return url;
  }
  if (allowedSchemes.indexOf(match[1].toLowerCase()) !== -1) {
    return url;
  }
  if (allowDataImages && SAFE_DATA_IMAGE.test(normalized)) {
    return url;
  }
  return null;
}

function stripLeadingControls(value: string): string {
  let i = 0;
  while (i < value.length && value.charCodeAt(i) <= 0x20) {
    i++;
  }
  return value.substring(i);
}
