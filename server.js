'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = process.env.PORT || 3000;
const API_BASE = 'https://mybookings.penrith.city/bookingportal/';
const HTML     = fs.readFileSync(path.join(__dirname, 'index.html'));

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');

  // Proxy: /proxy?path=api/assets/invoke?...
  if (reqUrl.pathname === '/proxy') {
    const apiPath = reqUrl.searchParams.get('path');
    if (!apiPath || !apiPath.startsWith('api/')) {
      res.writeHead(400); res.end('Bad request'); return;
    }
    const target = API_BASE + apiPath;
    console.log('->', target.substring(0, 120));
    try {
      const apiRes = await fetch(target, {
        headers: {
          'Accept':       'application/json',
          'Content-Type': 'application/json',
          'Token':        '',
          'Language':     'en'
        }
      });
      const body = await apiRes.text();
      console.log('<-', apiRes.status, apiPath.substring(0, 80));
      res.writeHead(apiRes.status, {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'no-store'
      });
      res.end(body);
    } catch (err) {
      console.error('Proxy error:', err.message);
      res.writeHead(502); res.end('Proxy error: ' + err.message);
    }
    return;
  }

  // Serve index.html for everything else
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log('Jamison Park calendar listening on port ' + PORT);
});
