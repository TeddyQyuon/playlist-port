import fs from 'node:fs';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import app from '../server/src/app.cjs';

const execFileAsync = promisify(execFile);
const prefix = process.argv[2] || 'current';
const outDir = path.resolve('screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer(app).listen(3099, '127.0.0.1', async () => {
  console.log('Server started on 3099');
  const viewports = [
    { name: `${prefix}_mobile_375px.png`, width: 375, height: 812, dark: false },
    { name: `${prefix}_mobile_375px_dark.png`, width: 375, height: 812, dark: true },
    { name: `${prefix}_fullpage_375px.png`, width: 375, height: 2600, dark: false },
    { name: `${prefix}_tablet_768px.png`, width: 768, height: 1024, dark: false },
    { name: `${prefix}_desktop_1280px.png`, width: 1280, height: 800, dark: false },
    { name: `${prefix}_desktop_1280px_dark.png`, width: 1280, height: 800, dark: true },
    { name: `${prefix}_fullpage_1280px.png`, width: 1280, height: 2200, dark: false },
    { name: `${prefix}_fullpage_1280px_dark.png`, width: 1280, height: 2200, dark: true }
  ];

  for (const vp of viewports) {
    const tmpDir = path.join(os.tmpdir(), `edge-${Math.random().toString(36).slice(2)}`);
    const outFile = path.join(outDir, vp.name);
    console.log(`Capturing ${vp.name}...`);
    try {
      const args = [
        '--headless=new',
        `--user-data-dir=${tmpDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        `--window-size=${vp.width},${vp.height}`,
        `--screenshot=${outFile}`
      ];
      if (vp.dark) args.push('--force-dark-mode');
      args.push('http://127.0.0.1:3099/');

      await execFileAsync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args, { timeout: 20000 });
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
