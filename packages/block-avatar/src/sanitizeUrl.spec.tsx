/**
 * @jest-environment node
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from '@jest/globals';

import { Avatar } from '.';

describe('block-avatar url sanitization', () => {
  it.each(['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', 'data:image/svg+xml,<svg>'])(
    'drops unsafe image url %j',
    (imageUrl) => {
      expect(renderToStaticMarkup(<Avatar props={{ imageUrl }} />)).toContain('src=""');
    }
  );

  it.each(['https://example.com/a.png', 'cid:avatar', 'data:image/jpeg;base64,AAAA', '{{avatar_url}}'])(
    'keeps safe image url %j',
    (imageUrl) => {
      expect(renderToStaticMarkup(<Avatar props={{ imageUrl }} />)).toContain(`src="${imageUrl}"`);
    }
  );
});
