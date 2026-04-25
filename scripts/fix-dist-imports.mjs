import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.node']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function normalizeRelativeSpecifier(specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return specifier;
  if (specifier.endsWith('/')) return specifier;
  if (JS_EXTENSIONS.has(path.extname(specifier))) return specifier;
  return `${specifier}.js`;
}

function rewriteImports(source) {
  const staticImportRegex = /((?:import|export)\s+[\s\S]*?\sfrom\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;
  const dynamicImportRegex = /((?:import)\s*\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g;

  return source
    .replace(staticImportRegex, (_match, prefix, specifier, suffix) => {
      return `${prefix}${normalizeRelativeSpecifier(specifier)}${suffix}`;
    })
    .replace(dynamicImportRegex, (_match, prefix, specifier, suffix) => {
      return `${prefix}${normalizeRelativeSpecifier(specifier)}${suffix}`;
    });
}

for (const filePath of walk(DIST_DIR)) {
  if (!filePath.endsWith('.js')) continue;

  const original = fs.readFileSync(filePath, 'utf8');
  const updated = rewriteImports(original);

  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
  }
}
