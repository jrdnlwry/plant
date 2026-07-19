import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'apps/extension/src/generated/plantRenderer.global.js');
const header = `// Generated from packages/plant-renderer.\n// Do not edit directly.\n// Run: npm run build:extension-renderer\n`;
const entryIds = {
  renderer: 'packages/plant-renderer/src/index.ts',
  core: 'packages/plant-core/src/index.ts',
};
const packageEntries = { '@plant/plant-core': entryIds.core, '@plant/plant-renderer': entryIds.renderer };
const productionRoots = ['packages/plant-renderer/src/', 'packages/plant-core/src/'];

function assertProductionModule(id) {
  if (!productionRoots.some((directory) => id.startsWith(directory))) {
    throw new Error(`Renderer build dependency is outside its browser-safe source roots: ${id}`);
  }
  if (/(^|\/)(?:testing|test|tests|fixtures?)(\/|$)|\.(?:test|spec|fixture)\.[cm]?[jt]sx?$/.test(id)) {
    throw new Error(`Renderer production graph must not include a test or fixture: ${id}`);
  }
}

export function resolveModule(fromId, specifier) {
  if (packageEntries[specifier]) return packageEntries[specifier];
  if (!specifier.startsWith('.')) throw new Error(`Unsupported renderer build import: ${specifier}`);

  const unresolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), specifier));
  const candidates = path.posix.extname(unresolved)
    ? [unresolved]
    : [`${unresolved}.ts`, `${unresolved}.tsx`, path.posix.join(unresolved, 'index.ts'), path.posix.join(unresolved, 'index.tsx')];
  const resolved = candidates.find((candidate) => existsSync(path.join(root, candidate)));
  if (!resolved) throw new Error(`Cannot resolve renderer build import "${specifier}" from ${fromId}`);
  assertProductionModule(resolved);
  return resolved;
}

/** Compile one module and derive its runtime edges from TypeScript's emitted require calls. */
export function compileModule(source, id, resolver = resolveModule) {
  const result = ts.transpileModule(source.replace(/\r\n?/g, '\n'), {
    fileName: id,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      newLine: ts.NewLineKind.LineFeed,
    },
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    throw new Error(`Cannot compile ${id}: ${errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('; ')}`);
  }

  const emitted = ts.createSourceFile(`${id}.js`, result.outputText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const dependencies = new Set();
  const transformer = (context) => {
    const visit = (node) => {
      if (ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'require'
        && node.arguments.length === 1
        && ts.isStringLiteralLike(node.arguments[0])) {
        const dependency = resolver(id, node.arguments[0].text);
        dependencies.add(dependency);
        return context.factory.updateCallExpression(
          node,
          node.expression,
          node.typeArguments,
          [context.factory.createStringLiteral(dependency)],
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  };
  const transformed = ts.transform(emitted, [transformer]);
  try {
    const code = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
    return { code, dependencies: [...dependencies].sort() };
  } finally {
    transformed.dispose();
  }
}

async function collect(id, modules = new Map()) {
  assertProductionModule(id);
  if (modules.has(id)) return modules;
  const source = await readFile(path.join(root, id), 'utf8');
  const compiled = compileModule(source, id);
  modules.set(id, compiled.code);
  for (const dependency of compiled.dependencies) await collect(dependency, modules);
  return modules;
}

export async function generate() {
  const modules = await collect(entryIds.renderer);
  const ordered = [...modules].sort(([a], [b]) => a.localeCompare(b, 'en'));
  const factories = ordered.map(([id, source]) => `${JSON.stringify(id)}: function(module, exports, require) {\n${source}\n}`).join(',\n');
  return `${header}(() => {\n  const modules = {\n${factories}\n  };\n  const cache = {};\n  function require(id) {\n    if (cache[id]) return cache[id].exports;\n    const factory = modules[id];\n    if (!factory) throw new Error(\`Unknown renderer module: \${id}\`);\n    const module = { exports: {} };\n    cache[id] = module;\n    factory(module, module.exports, require);\n    return module.exports;\n  }\n  const renderer = require(${JSON.stringify(entryIds.renderer)});\n  const core = require(${JSON.stringify(entryIds.core)});\n  globalThis.PlantCompanionRenderer = {\n    checkRenderCompatibility: renderer.checkRenderCompatibility,\n    createPlantRenderModel: renderer.createPlantRenderModel,\n    renderPlantSvg: renderer.renderPlantSvg,\n    isPlantStateSnapshot: core.isPlantStateSnapshot,\n    normalizePlantStateSnapshot: core.normalizePlantStateSnapshot,\n    plantStateVersion: core.plantStateVersion,\n    rendererVersion: core.rendererVersion\n  };\n})();\n`;
}

async function main() {
  const expected = await generate();
  if (process.argv.includes('--verify')) {
    let actual;
    try { actual = await readFile(outputPath, 'utf8'); } catch { throw new Error(`Generated renderer is missing: ${path.relative(root, outputPath)}. Run npm run build:extension-renderer.`); }
    if (actual !== expected) throw new Error('Generated extension renderer is stale. Run npm run build:extension-renderer and commit the result.');
    console.log('Generated extension renderer is current.');
  } else {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, expected);
    console.log(`Generated ${path.relative(root, outputPath)}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
