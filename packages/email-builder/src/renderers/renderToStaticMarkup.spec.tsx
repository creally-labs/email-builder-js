/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';

import renderToStaticMarkup from './renderToStaticMarkup';

describe('renderToStaticMarkup', () => {
  it('renders into a string', () => {
    const result = renderToStaticMarkup(
      {
        root: {
          type: 'Container',
          data: {
            props: {
              childrenIds: [],
            },
          },
        },
      },
      { rootBlockId: 'root' }
    );
    // React 19 emits an empty <head> that React 18 leaves out.
    expect(result).toMatch(/^<!DOCTYPE html><html>(<head><\/head>)?<body><div><\/div><\/body><\/html>$/);
  });
});
