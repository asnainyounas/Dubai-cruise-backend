// src/middleware/markdownNegotiation.js
const fs = require('fs');
const path = require('path');

const DEFAULT_MARKDOWN_DIR = path.resolve(__dirname, '../../content/markdown');

const ROUTE_FILE_MAP = Object.freeze({
  '/': 'home.md',
  '/cruises/dubai-marina-cruise': 'dubai-marina-cruise.md',
  '/cruises/creek-cruise': 'creek-cruise.md',
  '/contact': 'contact.md',
});

const Q_REGEX = /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/;

/**
 * Split a string by a delimiter character, ignoring occurrences inside double quotes.
 * Supports escaped characters (\").
 * Returns null if quotes are unbalanced (malformed header).
 */
function splitOutsideQuotes(str, delimiter) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inQuotes) {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (inQuotes) {
    return null;
  }

  parts.push(current);
  return parts;
}

/**
 * Parses the Accept header to determine if text/markdown is explicitly preferred over text/html.
 */
function isMarkdownPreferred(acceptHeader) {
  if (typeof acceptHeader !== 'string' || !acceptHeader.trim()) {
    return false;
  }

  const clauses = splitOutsideQuotes(acceptHeader, ',');
  if (!clauses) {
    return false;
  }

  let markdownQ = null;
  let htmlQ = null;

  for (const rawClause of clauses) {
    const clause = rawClause.trim();
    if (!clause) continue;

    const parts = splitOutsideQuotes(clause, ';');
    if (!parts || parts.length === 0) {
      return false;
    }

    const mediaType = parts[0].trim().toLowerCase();

    // Only inspect explicitly listed text/markdown and text/html
    if (mediaType !== 'text/markdown' && mediaType !== 'text/html') {
      continue;
    }

    let entryQ = 1.0;
    let hasQ = false;
    let entryMalformed = false;

    for (let i = 1; i < parts.length; i++) {
      const param = parts[i].trim();
      if (!param) continue;

      const eqIdx = param.indexOf('=');
      if (eqIdx === -1) {
        entryMalformed = true;
        break;
      }

      const paramName = param.slice(0, eqIdx).trim().toLowerCase();
      const paramVal = param.slice(eqIdx + 1).trim();

      if (paramName === 'q') {
        if (hasQ) {
          entryMalformed = true;
          break;
        }
        hasQ = true;

        if (!Q_REGEX.test(paramVal)) {
          entryMalformed = true;
          break;
        }

        entryQ = parseFloat(paramVal);
      }
    }

    if (entryMalformed) {
      continue;
    }

    if (mediaType === 'text/markdown') {
      if (markdownQ === null || entryQ > markdownQ) {
        markdownQ = entryQ;
      }
    } else if (mediaType === 'text/html') {
      if (htmlQ === null || entryQ > htmlQ) {
        htmlQ = entryQ;
      }
    }
  }

  // text/markdown must be explicitly listed with a valid positive quality value
  if (markdownQ === null || markdownQ <= 0) {
    return false;
  }

  // If text/html is not explicitly listed, treat its effective quality as 0
  const effectiveHtmlQ = htmlQ !== null ? htmlQ : 0;

  // text/markdown must be strictly greater than text/html
  return markdownQ > effectiveHtmlQ;
}

/**
 * Normalizes request paths by stripping query parameters and single or repeated trailing slashes.
 */
function normalizePath(rawPath) {
  if (typeof rawPath !== 'string') return null;
  const clean = rawPath.split(/[?#]/)[0];
  const stripped = clean.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

/**
 * Checks if a path is exactly /api or starts with /api/
 */
function isApiPath(pathname) {
  if (typeof pathname !== 'string') return false;
  const clean = pathname.split(/[?#]/)[0];
  return clean === '/api' || clean.startsWith('/api/');
}

/**
 * Safely adds 'Accept' to the Vary header, merging without duplicates.
 */
function addVaryAccept(res) {
  if (typeof res.vary === 'function') {
    res.vary('Accept');
  } else {
    const existing = res.getHeader('Vary');
    if (!existing) {
      res.setHeader('Vary', 'Accept');
    } else {
      const parts = String(existing)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.some((p) => p.toLowerCase() === 'accept')) {
        parts.push('Accept');
        res.setHeader('Vary', parts.join(', '));
      }
    }
  }
}

/**
 * Factory to create markdown negotiation middleware.
 */
function createMarkdownNegotiationMiddleware(options = {}) {
  const contentDir = options.contentDir || DEFAULT_MARKDOWN_DIR;
  const routeMap = options.routeMap || ROUTE_FILE_MAP;
  const cache = options.cache || new Map();

  // If cache is not pre-populated, load from disk once at startup
  if (cache.size === 0) {
    for (const [route, fileName] of Object.entries(routeMap)) {
      const filePath = path.join(contentDir, fileName);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        cache.set(route, content);
      } catch (err) {
        console.warn(
          `[markdownNegotiation] Warning: Content file "${fileName}" could not be loaded from ${filePath}: ${err.message}`
        );
      }
    }
  }

  return function markdownNegotiation(req, res, next) {
    // 1. Only handle GET and HEAD
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // 2. Never apply Markdown negotiation to /api or /api/* paths
    const reqPath = req.path || req.url || '';
    if (isApiPath(reqPath)) {
      return next();
    }

    // 3. Match against hard-coded whitelist
    const normalized = normalizePath(reqPath);
    if (!normalized || !Object.prototype.hasOwnProperty.call(routeMap, normalized)) {
      return next();
    }

    // Check if content is available in memory
    const content = cache.get(normalized);
    if (typeof content !== 'string') {
      // Content missing or unreadable at startup: add Vary: Accept and fall through to HTML handler
      addVaryAccept(res);
      return next();
    }

    // 4. Content negotiation check
    const acceptHeader = req.headers ? req.headers['accept'] : undefined;
    if (!isMarkdownPreferred(acceptHeader)) {
      // Whitelisted path falling through to normal handler: add Vary: Accept
      addVaryAccept(res);
      return next();
    }

    // 5. Serve Markdown
    res.status(200);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    addVaryAccept(res);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));
      return res.end();
    }

    return res.send(content);
  };
}

const defaultMiddleware = createMarkdownNegotiationMiddleware();
defaultMiddleware.createMarkdownNegotiationMiddleware = createMarkdownNegotiationMiddleware;
defaultMiddleware.isMarkdownPreferred = isMarkdownPreferred;
defaultMiddleware.normalizePath = normalizePath;
defaultMiddleware.isApiPath = isApiPath;
defaultMiddleware.ROUTE_FILE_MAP = ROUTE_FILE_MAP;

module.exports = defaultMiddleware;
