import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url), output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const item of ['index.html', 'assets', 'src', 'data']) await cp(new URL(item, root), new URL(item, output), { recursive: true });
await writeFile(new URL('.nojekyll', output), '');
console.log('Static site built in dist/. All assets use relative URLs.');
