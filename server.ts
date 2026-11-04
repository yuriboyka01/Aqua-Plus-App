import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createApiMiddleware } from './src/server/apiMiddleware';
import { isAllowedOrigin } from './src/utils/apiUtils';

const app = express();
const port = Number(process.env.PORT || 8080);
const projectRoot = process.cwd();
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

// Baseline security headers. A Content-Security-Policy is intentionally not set yet:
// it needs to be tested against Firebase Auth popups and Google Fonts first.
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Firebase signInWithPopup needs the popup to keep a reference to the opener window.
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000');

  // Handle CORS for Capacitor / mobile and local dev clients
  const origin = request.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

// Structured API request log (Cloud Run parses JSON lines). Never logs headers, tokens or bodies.
app.use('/api', (request, response, next) => {
  const startedAt = Date.now();
  response.on('finish', () => {
    console.log(JSON.stringify({
      severity: response.statusCode >= 500 ? 'ERROR' : 'INFO',
      method: request.method,
      path: request.originalUrl.split('?')[0],
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});

app.use(createApiMiddleware());

// Direct download route for the newly compiled Android APK
app.get('/download/app.apk', (_req, res) => {
  const apkPath = path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  res.download(apkPath, 'AquaPlus-Service.apk');
});

app.use(express.static(path.join(projectRoot, 'dist'), {
  index: false,
  maxAge: '1h',
  setHeaders(response, filePath) {
    if (path.basename(filePath) === 'index.html') response.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('*', (request, response) => {
  // A missing file such as /assets/old-chunk.js must be a real 404, not the SPA shell.
  if (path.extname(request.path)) {
    response.status(404).type('text/plain').send('Not found');
    return;
  }
  response.sendFile(path.join(projectRoot, 'dist', 'index.html'));
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ severity: 'INFO', message: `AquaPlus Service listening on port ${port}` }));
});

function shutdown(signal: string): void {
  console.log(JSON.stringify({ severity: 'INFO', message: `${signal} received, shutting down` }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    severity: 'ERROR',
    message: 'Unhandled promise rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
  }));
});

