const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Ensure history file exists
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Ensure config file exists
if (!fs.existsSync(CONFIG_FILE)) {
  const defaultDir = path.join(process.env.USERPROFILE || 'C:\\', 'Documents', 'ScannedPDFs');
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ defaultDir, historyDirs: [defaultDir] }, null, 2), 'utf8');
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving history:', e);
  }
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return { defaultDir: '', historyDirs: [] };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname);
    return;
  }

  // Static file serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Security check to prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA if not found
      filePath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(filePath, (fallbackErr, content) => {
        if (fallbackErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

function handleApi(req, res, pathname) {
  if (pathname === '/api/status' && req.method === 'GET') {
    const config = loadConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      version: '1.0.0',
      config,
      history: loadHistory().slice(-10).reverse()
    }));
    return;
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    readJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const config = loadConfig();
      if (body.defaultDir) {
        config.defaultDir = body.defaultDir;
        if (!config.historyDirs) config.historyDirs = [];
        if (!config.historyDirs.includes(body.defaultDir)) {
          config.historyDirs.unshift(body.defaultDir);
          config.historyDirs = config.historyDirs.slice(0, 20);
        }
      }
      saveConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, config }));
    });
    return;
  }

  if (pathname === '/api/save-pdf' && req.method === 'POST') {
    readJsonBody(req, (err, body) => {
      if (err || !body || !body.pdfBase64 || !body.fileName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields (pdfBase64, fileName)' }));
        return;
      }

      const config = loadConfig();
      let targetDir = body.folderPath || config.defaultDir;
      if (!targetDir) {
        targetDir = path.join(process.env.USERPROFILE || 'C:\\', 'Documents', 'ScannedPDFs');
      }

      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const safeFileName = body.fileName.replace(/[<>:"/\\|?*]/g, '_');
        const fullPath = path.join(targetDir, safeFileName);
        const buffer = Buffer.from(body.pdfBase64, 'base64');
        fs.writeFileSync(fullPath, buffer);

        const stats = fs.statSync(fullPath);

        // Update history
        const history = loadHistory();
        const historyItem = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          fileName: safeFileName,
          folderPath: targetDir,
          fullPath: fullPath,
          fileSize: stats.size,
          totalPages: body.totalPages || 1,
          startPage: body.startPage || 1,
          endPage: body.endPage || 1,
          documentTitle: body.documentTitle || ''
        };
        history.push(historyItem);
        saveHistory(history);

        // Update config directory history
        if (!config.historyDirs) config.historyDirs = [];
        if (!config.historyDirs.includes(targetDir)) {
          config.historyDirs.unshift(targetDir);
          config.historyDirs = config.historyDirs.slice(0, 20);
        }
        config.defaultDir = targetDir;
        saveConfig(config);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          fullPath,
          fileName: safeFileName,
          folderPath: targetDir,
          fileSize: stats.size,
          historyItem
        }));
      } catch (saveErr) {
        console.error('Error saving PDF:', saveErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: saveErr.message }));
      }
    });
    return;
  }

  if (pathname === '/api/open-folder' && req.method === 'POST') {
    readJsonBody(req, (err, body) => {
      const targetPath = body && (body.fullPath || body.folderPath);
      if (!targetPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing path' }));
        return;
      }

      try {
        if (body.fullPath && fs.existsSync(body.fullPath)) {
          // Open Explorer with file selected
          exec(`explorer.exe /select,"${body.fullPath.replace(/\//g, '\\')}"`);
        } else if (body.folderPath && fs.existsSync(body.folderPath)) {
          exec(`explorer.exe "${body.folderPath.replace(/\//g, '\\')}"`);
        } else {
          exec(`explorer.exe "${path.dirname(targetPath).replace(/\//g, '\\')}"`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (execErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: execErr.message }));
      }
    });
    return;
  }

  if (pathname === '/api/history' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ history: loadHistory().reverse() }));
    return;
  }

  if (pathname === '/api/history/clear' && req.method === 'POST') {
    saveHistory([]);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

function readJsonBody(req, callback) {
  let body = '';
  // Limit to 100MB for large multi-page scans
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 100 * 1024 * 1024) {
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      callback(null, parsed);
    } catch (e) {
      callback(e, null);
    }
  });
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CAM SCAN TO PDF SERVER RUNNING`);
  console.log(`📍 Web App URL: http://localhost:${PORT}`);
  console.log(`📂 Web root: ${PUBLIC_DIR}`);
  console.log(`====================================================`);
  
  // Auto open browser
  const url = `http://localhost:${PORT}`;
  const startCmd = process.platform === 'win32' ? `start ${url}` : (process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`);
  exec(startCmd, (err) => {
    if (err) console.log('Notice: Could not auto-launch browser:', err.message);
  });
});
