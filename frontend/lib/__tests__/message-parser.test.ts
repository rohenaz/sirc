/**
 * Tests for message parser URL detection
 * Run with: bun test message-parser.test.ts
 */

import { describe, expect, test } from 'bun:test';
import { parseMessage, extractUrls, isImageUrl, isVideoUrl } from '../message-parser';

describe('parseMessage', () => {
  test('parses plain text without URLs', () => {
    const result = parseMessage('Hello, this is a plain message');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('Hello, this is a plain message');
  });

  test('parses message with http URL', () => {
    const result = parseMessage('Check out http://example.com');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('Check out ');
    expect(result[1].type).toBe('link');
    expect(result[1].content).toBe('http://example.com');
    expect(result[1].url).toBe('http://example.com');
  });

  test('parses message with https URL', () => {
    const result = parseMessage('Visit https://github.com/user/repo');
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('link');
    expect(result[1].url).toBe('https://github.com/user/repo');
  });

  test('parses message with www URL', () => {
    const result = parseMessage('Go to www.example.com for more info');
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe('link');
    expect(result[1].content).toBe('www.example.com');
    expect(result[1].url).toBe('https://www.example.com');
  });

  test('parses message with naked domain', () => {
    const result = parseMessage('Visit example.com today');
    expect(result[1].type).toBe('link');
    expect(result[1].url).toBe('https://example.com');
  });

  test('parses multiple URLs in one message', () => {
    const result = parseMessage('Check https://example.com and www.github.com');
    expect(result).toHaveLength(4);
    expect(result[1].type).toBe('link');
    expect(result[3].type).toBe('link');
  });

  test('parses URL with path and query string', () => {
    const result = parseMessage('https://example.com/path/to/page?foo=bar&baz=qux#section');
    expect(result[0].type).toBe('link');
    expect(result[0].url).toBe('https://example.com/path/to/page?foo=bar&baz=qux#section');
  });

  test('parses URL with port', () => {
    const result = parseMessage('http://localhost:8080/api');
    expect(result[0].type).toBe('link');
    expect(result[0].url).toBe('http://localhost:8080/api');
  });

  test('parses FTP URL', () => {
    const result = parseMessage('Download from ftp://files.example.com/file.zip');
    expect(result[1].type).toBe('link');
    expect(result[1].url).toBe('ftp://files.example.com/file.zip');
  });

  test('handles URL at start of message', () => {
    const result = parseMessage('https://example.com is a great site');
    expect(result[0].type).toBe('link');
    expect(result[1].type).toBe('text');
  });

  test('handles URL at end of message', () => {
    const result = parseMessage('Check out https://example.com');
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('link');
  });

  test('handles URL with special characters', () => {
    const result = parseMessage('https://example.com/path_(with)_parens');
    expect(result[0].type).toBe('link');
  });

  test('does not match invalid URLs', () => {
    // Should not match things like "1.2" or single words
    const result1 = parseMessage('Version 1.2');
    expect(result1.every(p => p.type === 'text')).toBe(true);

    const result2 = parseMessage('foo.bar without context');
    // This might match depending on validation - adjust as needed
  });
});

describe('extractUrls', () => {
  test('extracts all URLs from message', () => {
    const urls = extractUrls('Visit https://example.com and www.github.com');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe('https://example.com');
    expect(urls[1]).toBe('https://www.github.com');
  });

  test('returns empty array for text without URLs', () => {
    const urls = extractUrls('Hello world');
    expect(urls).toHaveLength(0);
  });

  test('normalizes URLs without protocol', () => {
    const urls = extractUrls('www.example.com');
    expect(urls[0]).toBe('https://www.example.com');
  });
});

describe('isImageUrl', () => {
  test('detects image URLs by extension', () => {
    expect(isImageUrl('https://example.com/image.jpg')).toBe(true);
    expect(isImageUrl('https://example.com/image.png')).toBe(true);
    expect(isImageUrl('https://example.com/image.gif')).toBe(true);
    expect(isImageUrl('https://example.com/image.webp')).toBe(true);
  });

  test('detects image URLs with query strings', () => {
    expect(isImageUrl('https://example.com/image.jpg?size=large')).toBe(true);
  });

  test('returns false for non-image URLs', () => {
    expect(isImageUrl('https://example.com/page.html')).toBe(false);
    expect(isImageUrl('https://example.com/document.pdf')).toBe(false);
  });
});

describe('isVideoUrl', () => {
  test('detects video URLs by extension', () => {
    expect(isVideoUrl('https://example.com/video.mp4')).toBe(true);
    expect(isVideoUrl('https://example.com/video.webm')).toBe(true);
    expect(isVideoUrl('https://example.com/video.mov')).toBe(true);
  });

  test('returns false for non-video URLs', () => {
    expect(isVideoUrl('https://example.com/page.html')).toBe(false);
    expect(isVideoUrl('https://example.com/image.jpg')).toBe(false);
  });
});
