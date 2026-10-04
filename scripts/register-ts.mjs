// Node 24 原生 TS 运行支持（替代 tsx/esbuild，避免 Windows 沙箱下 esbuild 子进程管道被拦截）。
// 用法：node --import ./scripts/register-ts.mjs server/index.ts
// - Node 24 默认剥离 .ts 类型注解（要求 erasableSyntaxOnly + verbatimModuleSyntax，见 tsconfig）。
// - 本 hook 负责：@shared/* 别名；无扩展名/.js 的相对导入解析到 .ts/.tsx/index.ts。
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exts = ['.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

function isFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

function tryResolveFile(base) {
  if (isFile(base)) return base;
  const noJs = base.replace(/\.(m?js)$/, '');
  for (const e of exts) {
    if (isFile(noJs + e)) return noJs + e;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;
    if (specifier.startsWith('@shared/')) {
      target = tryResolveFile(path.join(root, 'shared', specifier.slice('@shared/'.length)));
    } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const abs = path.resolve(parentDir, specifier);
      if (!existsSync(abs) || !isFile(abs)) target = tryResolveFile(abs);
    }
    if (target) return nextResolve(pathToFileURL(target).href, context);
    return nextResolve(specifier, context);
  },
});
