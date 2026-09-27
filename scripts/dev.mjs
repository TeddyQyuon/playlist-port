import { spawn } from 'node:child_process';

// The supervised preview passes --port 4173. Keep both apps in one process group
// so Vite can proxy API calls to Express in the same network namespace.
const portIndex = process.argv.indexOf('--port');
const previewPort = portIndex >= 0 ? process.argv[portIndex + 1] : null;
const clientArgs = ['run', 'dev', '--workspace', 'client'];
if (previewPort) clientArgs.push('--', '--host', '0.0.0.0', '--port', previewPort, '--strictPort');

const children = [
  spawn('npm', ['run', 'dev', '--workspace', 'server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npm', clientArgs, { stdio: 'inherit', shell: process.platform === 'win32' })
];

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      for (const other of children) if (other !== child) other.kill();
      process.exitCode = code;
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
  });
}
