/**
 * @jest-environment node
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from '@jest/globals';

import { Image } from '.';

describe('block-image url sanitization', () => {
  it.each(['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x'])(
    'drops unsafe link %j and renders the image without an anchor',
    (linkHref) => {
      const html = renderToStaticMarkup(<Image props={{ url: 'https://example.com/a.png', linkHref }} />);
      expect(html).not.toContain('<a');
      expect(html).toContain('src="https://example.com/a.png"');
    }
  );

  it.each(['https://example.com', 'mailto:a@b.c', 'tel:+1', '/x', '#y', '{{link_url}}'])(
    'keeps safe link %j',
    (linkHref) => {
      const html = renderToStaticMarkup(<Image props={{ url: 'https://example.com/a.png', linkHref }} />);
      expect(html).toContain(`href="${linkHref}"`);
    }
  );

  it.each(['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'data:text/html,x', 'vbscript:x'])(
    'drops unsafe image src %j',
    (url) => {
      const html = renderToStaticMarkup(<Image props={{ url }} />);
      expect(html).not.toContain(' src=');
    }
  );

  it.each([
    'https://example.com/a.png',
    'http://example.com/a.png',
    'cid:logo@example',
    'data:image/png;base64,iVBORw0KGgo=',
    '/img/a.png',
    '{{logo_url}}',
  ])('keeps safe image src %j', (url) => {
    const html = renderToStaticMarkup(<Image props={{ url }} />);
    expect(html).toContain(`src="${url}"`);
  });
});
