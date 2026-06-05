'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT     = process.env.PORT || 3000;
const API_BASE = 'https://mybookings.penrith.city/bookingportal/';

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'));

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // Proxy: /proxy?path=api/assets/invoke?...
  if (parsed.pathname === '/proxy') {
    const apiPath = parsed.query.path;
    if (!apiPath || !apiPath.startsWith('api/')) {
      res.writeHead(400); res.end('Bad path'); return;
    }
    const target = API_BASE + apiPath;
    console.log('Proxy ->', target.substring(0, 120));
    https.get(target, {
      headers: {
        'Accept':        'application/json',
        'Content-Type':  'application/json',
        'Token':         '',
        'Language':      'en'
      }
    }, (apiRes) => {
      let body = '';
      apiRes.on('data', chunk => { body += chunk; });
      apiRes.on('end', () => {
        console.log('Proxy <-', apiRes.statusCode, apiPath.substring(0, 60));
        res.writeHead(apiRes.statusCode, {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control':               'no-store'
        });
        res.end(body);
      });
    }).on('error', err => {
      console.error('Proxy error:', err.message);
      res.writeHead(502); res.end('Proxy error: ' + err.message);
    });
    return;
  }

  // Serve index.html for everything else
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log('Jamison Park calendar listening on port ' + PORT);
});
