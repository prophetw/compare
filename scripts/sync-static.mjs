import { cp, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(new URL('..', import.meta.url)));
const frontendDist = path.join(rootDir, 'apps', 'frontend', 'dist');
const serverPublic = path.join(rootDir, 'apps', 'server', 'public');

async function ensureDistExists() {
  try {
    await access(frontendDist);
  } catch {
    throw new Error(`未找到前端构建产物：${frontendDist}\n请先运行 pnpm --filter frontend build`);
  }
}

async function copyDist() {
  await rm(serverPublic, { recursive: true, force: true });
  await mkdir(serverPublic, { recursive: true });
  await cp(frontendDist, serverPublic, { recursive: true });
}

async function main() {
  await ensureDistExists();
  await copyDist();
  console.log(`静态资源已同步到 ${serverPublic}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
