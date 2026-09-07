export default [
  {
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    outDir: 'lib',
    clean: false,
    dts: false,
    deps: { neverBundle: [/@deepseek-ai\//, '@deepseek-ai/cordis'] },
    outputOptions: {
      entryFileNames: 'host.mjs',
    },
  },
  {
    name: 'dsh-better-git/client',
    entry: { client: 'src/client/index.tsx' },
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    outDir: 'lib',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: ['@deepseek-ai/cordis', 'react', 'react/jsx-runtime'],
      alwaysBundle: (specifier: string) => !['@deepseek-ai/cordis', 'react', 'react/jsx-runtime'].includes(specifier),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      exports: 'named',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-better-git", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
