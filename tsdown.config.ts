import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const reactDiffViewCss = readFileSync(require.resolve('react-diff-view/style/index.css'), 'utf8')
const clientStyleBootstrap = `
if (typeof document !== 'undefined') {
  const id = 'dsh-better-git/react-diff-view.css';
  let style = document.querySelector('style[data-plugin-css="' + id + '"]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.pluginCss = id;
    document.head.appendChild(style);
  }
  style.textContent = ${JSON.stringify(reactDiffViewCss)};
}
`

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
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    outDir: 'lib',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: ['@deepseek-ai/cordis', /^react(?:\/|$)/, /^react-dom(?:\/|$)/],
      alwaysBundle: (id: string) => id !== '@deepseek-ai/cordis' && !/^react(?:-dom)?(?:\/|$)/.test(id),
      onlyBundle: false,
    },
    outputOptions: {
      entryFileNames: 'client.js',
      exports: 'named',
      banner: `${clientStyleBootstrap}\nwindow.__ModuleLoader__.load({ id: "dsh-better-git", factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
