import fs from 'node:fs';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import app from '../server/src/app.cjs';

const prefix = process.argv[2] || 'current';
const outDir = path.resolve('screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer(app).listen(3099, '127.0.0.1', async () => {
  console.log('Server started on 3099');
  const viewports = [
    { name: `${prefix}_mobile_375px.png`, width: 375, height: 812 },
    { name: `${prefix}_tablet_768px.png`, width: 768, height: 1024 },
    { name: `${prefix}_desktop_1280px.png`, width: 1280, height: 800 }
  ];

  for (const vp of viewports) {
    const tmpDir = path.join(os.tmpdir(), `edge-${Math.random().toString(36).slice(2)}`);
    const outFile = path.join(outDir, vp.name);
    console.log(`Capturing ${vp.name}...`);
    try {
      execFileSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        `--user-data-dir=${tmpDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        `--window-size=${vp.width},${vp.height}`,
        `--screenshot=${outFile}`,
        'http://127.0.0.1:3099/'
      ], { timeout: 20000, stdio: 'ignore' });
      const stat = fs.existsSync(outFile) ? fs.statSync(outFile) : null;
      console.log(`Saved ${vp.name} (${stat ? stat.size + ' bytes' : 'FAILED'})`);
    } catch (e) {
      console.error(`Error capturing ${vp.name}:`, e.message);
    }
  }

  server.close(() => {
    console.log('Done capturing screenshots.');
    process.exit(0);
  });
});
