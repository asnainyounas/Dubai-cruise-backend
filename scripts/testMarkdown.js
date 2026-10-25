// scripts/testMarkdown.js
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const express = require('express');

const markdownNegotiation = require('../src/middleware/markdownNegotiation');
const {
  createMarkdownNegotiationMiddleware,
  isMarkdownPreferred,
  normalizePath,
  isApiPath,
  ROUTE_FILE_MAP,
} = markdownNegotiation;

function makeRequest(server, options, bodyData) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const reqOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      method: options.method || 'GET',
      path: options.path || '/',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('MARKDOWN CONTENT NEGOTIATION HTTP TEST SUITE');
  console.log('====================================================\n');

  // Build bare test Express app
  const app = express();

  // Middleware to simulate existing Vary headers when requested by a test
  app.use((req, res, next) => {
    if (req.headers['x-test-initial-vary']) {
      res.setHeader('Vary', req.headers['x-test-initial-vary']);
    }
    next();
  });

  // Mount Markdown negotiation middleware
  app.use(markdownNegotiation);

  // Dedicated test route for simulated missing-file test
  const missingFileMiddleware = createMarkdownNegotiationMiddleware({
    routeMap: { '/simulated-missing': 'non-existent-file.md' },
    cache: new Map(), // empty cache simulates unreadable/missing file
  });
  app.use(missingFileMiddleware);

  // HTML fallback handler
  app.use((req, res) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.status(200).send('API FALLBACK');
    } else {
      res.status(200).send('HTML FALLBACK');
    }
  });

  const server = http.createServer(app);

  let allPassed = true;

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    console.log(`Ephemeral test server running on 127.0.0.1:${port}\n`);

    // --- TEST A: Markdown request for homepage ---
    try {
      console.log('Test A: Markdown request for homepage (GET / with Accept: text/markdown)');
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Vary: ${res.headers['vary']}`);
      console.log(`Cache-Control: ${res.headers['cache-control']}`);
      console.log(`Body snippet: ${res.body.slice(0, 60).replace(/\n/g, ' ')}...`);

      assert(res.statusCode === 200, 'Status must be 200');
      assert(
        res.headers['content-type'] === 'text/markdown; charset=utf-8',
        'Content-Type must be text/markdown; charset=utf-8'
      );
      assert(res.body.length > 0, 'Body must be non-empty');
      assert(
        res.headers['vary'] && res.headers['vary'].includes('Accept'),
        'Vary header must include Accept'
      );
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST B: Explicit HTML request ---
    try {
      console.log('Test B: Explicit HTML request (GET / with Accept: text/html)');
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/html' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(res.body === 'HTML FALLBACK', 'Body must be HTML FALLBACK');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST C: Missing Accept header ---
    try {
      console.log('Test C: Missing Accept header (GET /)');
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(res.body === 'HTML FALLBACK', 'Body must be HTML FALLBACK');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST D: Wildcard Accept header ---
    try {
      console.log('Test D: Wildcard Accept header (GET / with Accept: */*)');
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: '*/*' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(res.body === 'HTML FALLBACK', 'Body must be HTML FALLBACK');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST E: Markdown preferred by quality ---
    try {
      console.log(
        'Test E: Markdown preferred by quality (GET / with Accept: text/markdown, text/html;q=0.8)'
      );
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/markdown, text/html;q=0.8' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(
        res.headers['content-type'] === 'text/markdown; charset=utf-8',
        'Content-Type must be text/markdown'
      );
      assert(res.body !== 'HTML FALLBACK', 'Must serve Markdown, not HTML');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST F: HTML preferred by quality ---
    try {
      console.log(
        'Test F: HTML preferred by quality (GET / with Accept: text/html, text/markdown;q=0.8)'
      );
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/html, text/markdown;q=0.8' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(res.body === 'HTML FALLBACK', 'Body must be HTML FALLBACK');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST G: Equal quality values ---
    try {
      console.log(
        'Test G: Equal quality values (GET / with Accept: text/markdown, text/html)'
      );
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/markdown, text/html' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(res.body === 'HTML FALLBACK', 'Tie must result in HTML FALLBACK');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST H: Unknown path ---
    try {
      console.log(
        'Test H: Unknown path (GET /unknown-page with Accept: text/markdown)'
      );
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/unknown-page',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.statusCode === 200, 'Status must be 200');
      assert(res.body === 'HTML FALLBACK', 'Must fall through to HTML fallback');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST I: Path traversal attempts ---
    try {
      console.log('Test I: Path traversal attempts');
      const res1 = await makeRequest(server, {
        method: 'GET',
        path: '/cruises/../../.env',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`  Path /cruises/../../.env -> Status: ${res1.statusCode}, Body: ${res1.body}`);
      assert(res1.body === 'HTML FALLBACK', 'Traversal attempt must fall through to HTML');

      const res2 = await makeRequest(server, {
        method: 'GET',
        path: '/..%2f..%2f.env',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`  Path /..%2f..%2f.env -> Status: ${res2.statusCode}, Body: ${res2.body}`);
      assert(res2.body === 'HTML FALLBACK', 'Encoded traversal attempt must fall through to HTML');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST J: POST request ---
    try {
      console.log('Test J: POST request (POST / with Accept: text/markdown)');
      const res = await makeRequest(server, {
        method: 'POST',
        path: '/',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.body === 'HTML FALLBACK', 'POST must fall through to fallback');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST K: API path exclusion ---
    try {
      console.log('Test K: API path exclusion (GET /api/anything with Accept: text/markdown)');
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/api/anything',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      console.log(`Vary header: ${res.headers['vary'] || '(none)'}`);
      assert(res.body === 'API FALLBACK', 'Must fall through to API fallback');
      assert(!res.headers['vary'], 'API path must not have headers altered by markdown middleware');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST L: Vary header ---
    try {
      console.log('Test L: Vary header checks');
      // 1. Markdown response for / has Vary: Accept
      const resMd = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`  Markdown response Vary: ${resMd.headers['vary']}`);
      assert(
        resMd.headers['vary'] && resMd.headers['vary'].includes('Accept'),
        'Markdown response must have Vary: Accept'
      );

      // 2. HTML fallback response for / has Vary: Accept
      const resHtml = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/html' },
      });
      console.log(`  HTML fallback Vary: ${resHtml.headers['vary']}`);
      assert(
        resHtml.headers['vary'] && resHtml.headers['vary'].includes('Accept'),
        'HTML fallback response must have Vary: Accept'
      );

      // 3. Existing Vary value (Origin) preservation
      const resPreserve = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: {
          Accept: 'text/markdown',
          'x-test-initial-vary': 'Origin',
        },
      });
      console.log(`  Preserved Vary header: ${resPreserve.headers['vary']}`);
      const varyTokens = resPreserve.headers['vary'].split(',').map((s) => s.trim());
      assert(varyTokens.includes('Origin'), 'Must preserve Origin');
      assert(varyTokens.includes('Accept'), 'Must include Accept');
      assert(
        varyTokens.filter((t) => t.toLowerCase() === 'accept').length === 1,
        'Accept must not be duplicated'
      );
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST M: Markdown content scan ---
    try {
      console.log('Test M: Markdown content scan');
      const markdownDir = path.resolve(__dirname, '../content/markdown');
      const files = ['home.md', 'dubai-marina-cruise.md', 'creek-cruise.md', 'contact.md'];

      for (const file of files) {
        const filePath = path.join(markdownDir, file);
        assert(fs.existsSync(filePath), `File ${file} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        assert(lines.length <= 25, `${file} must not exceed 25 lines (actual: ${lines.length})`);
        assert(!/http/i.test(content), `${file} must not contain 'http' (case-insensitive)`);
        assert(!content.includes('!['), `${file} must not contain '!['`);
        assert(!content.includes(']('), `${file} must not contain ']('`);
        assert(!content.includes('<'), `${file} must not contain '<'`);
        assert(!/<[a-z][\s\S]*>/i.test(content), `${file} must not contain HTML tags`);

        console.log(`\n  File: ${file} (lines: ${lines.length})`);
        console.log('  Facts stated for manual check:');
        lines
          .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('#'))
          .forEach((l) => console.log(`    ${l}`));
      }
      console.log('\nResult: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- TEST N: JavaScript syntax checks ---
    try {
      console.log('Test N: JavaScript syntax checks');
      const jsFiles = [
        'src/middleware/markdownNegotiation.js',
        'src/app.js',
        'scripts/testMarkdown.js',
      ];

      for (const jsFile of jsFiles) {
        const cmd = `node --check "${jsFile}"`;
        console.log(`  Executing: ${cmd}`);
        execSync(cmd, { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
        console.log(`  Exit Status: 0 (OK)`);
      }
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // --- ADDITIONAL TESTS (user requested keeping these 4) ---
    console.log('--- Additional Tests (Selected 4 High-Value Tests) ---\n');

    // 1. HEAD request
    try {
      console.log('Additional 1: HEAD request (HEAD / with Accept: text/markdown)');
      const res = await makeRequest(server, {
        method: 'HEAD',
        path: '/',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Content-Length: ${res.headers['content-length']}`);
      console.log(`Body length: ${res.body.length}`);
      assert(res.statusCode === 200, 'HEAD status must be 200');
      assert(
        res.headers['content-type'] === 'text/markdown; charset=utf-8',
        'Content-Type must match GET'
      );
      assert(res.body.length === 0, 'HEAD response body must be empty');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // 2. q=0 case
    try {
      console.log(
        'Additional 2: Quality value 0 (GET / with Accept: text/markdown;q=0, text/html;q=1)'
      );
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/markdown;q=0, text/html;q=1' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.body === 'HTML FALLBACK', 'q=0 must not serve markdown');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // 3. text/markdown;q=0.8, text/html;q=0.8 (tie)
    try {
      console.log(
        'Additional 3: Equal non-1 quality tie (GET / with Accept: text/markdown;q=0.8, text/html;q=0.8)'
      );
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/',
        headers: { Accept: 'text/markdown;q=0.8, text/html;q=0.8' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      assert(res.body === 'HTML FALLBACK', 'Tie quality values must fall through to HTML');
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // 4. Missing-file simulation
    try {
      console.log('Additional 4: Missing file simulation (/simulated-missing with Accept: text/markdown)');
      const res = await makeRequest(server, {
        method: 'GET',
        path: '/simulated-missing',
        headers: { Accept: 'text/markdown' },
      });
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${res.body}`);
      console.log(`Vary header: ${res.headers['vary']}`);
      assert(res.body === 'HTML FALLBACK', 'Missing file must fall through to HTML');
      assert(
        res.headers['vary'] && res.headers['vary'].includes('Accept'),
        'Vary: Accept must still be added on whitelisted missing file'
      );
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }

    // Also quick check of all whitelisted routes:
    try {
      console.log('Additional 5: Whitelisted routes with trailing slashes & queries');
      const routes = [
        { path: '/cruises/dubai-marina-cruise/', expectedTitle: 'Dubai Marina Cruise' },
        { path: '/cruises/creek-cruise?source=test', expectedTitle: 'Creek Cruise' },
        { path: '/contact///', expectedTitle: 'Contact Us' },
      ];
      for (const r of routes) {
        const res = await makeRequest(server, {
          method: 'GET',
          path: r.path,
          headers: { Accept: 'text/markdown' },
        });
        console.log(`  Path ${r.path} -> Status: ${res.statusCode}, First line: ${res.body.split('\n')[0]}`);
        assert(res.statusCode === 200, `Status 200 for ${r.path}`);
        assert(res.body.includes(r.expectedTitle), `Body contains ${r.expectedTitle}`);
      }
      console.log('Result: PASS\n');
    } catch (err) {
      allPassed = false;
      console.error(`Result: FAIL - ${err.message}\n`);
    }
  } finally {
    server.close();
  }

  if (!allPassed) {
    console.error('FAILED: One or more tests failed.');
    process.exit(1);
  } else {
    console.log('====================================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY');
    console.log('====================================================');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
