import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { create } from 'react-test-renderer'
import { GitPatchDiff, parseGitPatch } from '../src/client/GitPatchDiff.js'

const MULTI_FILE_PATCH = `diff --git a/src/first.ts b/src/first.ts
index 1111111..2222222 100644
--- a/src/first.ts
+++ b/src/first.ts
@@ -1 +1 @@
-export const value = 1
+export const value = 2
diff --git a/src/second.ts b/src/second.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/second.ts
@@ -0,0 +1 @@
+export const second = true
`

test('parses multi-file patches with react-diff-view', () => {
  const files = parseGitPatch(MULTI_FILE_PATCH)

  assert.equal(files.length, 2)
  assert.deepEqual(files.map(file => file.newPath), ['src/first.ts', 'src/second.ts'])
  assert.deepEqual(files.map(file => file.type), ['modify', 'add'])
  assert.deepEqual(files.map(file => file.hunks.length), [1, 1])
})

test('renders package-provided split diff tables instead of raw patch text', () => {
  const renderer = create(createElement(GitPatchDiff, { patch: MULTI_FILE_PATCH }))
  const hasClass = (className: string) => renderer.root.findAll(
    node => typeof node.props.className === 'string' && node.props.className.split(' ').includes(className)
  )

  assert.equal(renderer.root.findAllByType('pre').length, 0)
  assert.equal(renderer.root.findAllByProps({ className: 'diff diff-split' }).length, 2)
  assert.ok(hasClass('diff-code-delete').length > 0)
  assert.ok(hasClass('diff-code-insert').length > 0)
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /diff --git|index 1111111/)
})
