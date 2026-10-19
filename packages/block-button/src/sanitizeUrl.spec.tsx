/**
 * @jest-environment node
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from '@jest/globals';

import { Button } from '.';

const UNSAFE = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  '\u0001javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
];

const SAFE = [
  'https://example.com/?a=1&b=2',
  'http://example.com',
  'HTTPS://EXAMPLE.COM',
  'mailto:hello@example.com',
  'tel:+123456',
  '/relative/path',
  '#anchor',
  '?ref=email',
  '//cdn.example.com/x',
  '{{unsubscribe_url}}',
  '{{ cta_url }}',
  'https://example.com/?u={{user_id}}',
];

describe('block-button url sanitization', () => {
  it.each(UNSAFE)('drops unsafe url %j', (url) => {
    const html = renderToStaticMarkup(<Button props={{ url, text: 'Go' }} />);
    expect(html).toContain('href=""');
    expect(html.toLowerCase()).not.toContain('script:');
  });

  it.each(SAFE)('keeps safe url %j', (url) => {
    const html = renderToStaticMarkup(<Button props={{ url, text: 'Go' }} />);
    const expected = renderToStaticMarkup(<a href={url} />).match(/href="[^"]*"/)?.[0];
    expect(html).toContain(expected);
  });
});
