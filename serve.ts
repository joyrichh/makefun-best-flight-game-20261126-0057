import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./game/', import.meta.url));
const root = resolve(directory);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const filename = resolve(root, '.' + relative);
    if (!filename.startsWith(root + sep)) {
      response.writeHead(403).end('This server only serves game/.');
      return;
    }
    const details = await stat(filename);
    if (!details.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Content-Length': details.size, 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filename).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found.');
  }
}).listen(8080, '127.0.0.1', () => console.log('Nusa Air Rally → http://localhost:8080'));
