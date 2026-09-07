import {
  Decoration,
  Diff,
  Hunk,
  parseDiff,
  type FileData,
  type HunkData,
} from 'react-diff-view'
import { useMemo } from 'react'

const TYPE_LABELS: Record<FileData['type'], string> = {
  add: 'Added',
  delete: 'Deleted',
  modify: 'Modified',
  rename: 'Renamed',
  copy: 'Copied',
}

/** Parse the raw unified patch using react-diff-view's gitdiff-parser adapter. */
export function parseGitPatch(patch: string): FileData[] {
  return parseDiff(patch, { nearbySequences: 'zip' })
}

function getFileLabel(file: FileData) {
  if (file.oldPath === '/dev/null') return file.newPath
  if (file.newPath === '/dev/null') return file.oldPath
  if (file.oldPath === file.newPath) return file.newPath
  return `${file.oldPath} → ${file.newPath}`
}

function renderHunks(hunks: HunkData[]) {
  return hunks.flatMap(hunk => {
    const key = `${hunk.oldStart},${hunk.oldLines}:${hunk.newStart},${hunk.newLines}`
    return [
      <Decoration key={`header:${key}`}>
        <span className="bgit-diff-hunk-label">{hunk.content}</span>
      </Decoration>,
      <Hunk key={`hunk:${key}`} hunk={hunk} />,
    ]
  })
}

function GitFileDiff(props: { file: FileData; index: number }) {
  const { file, index } = props
  const label = getFileLabel(file)
  return (
    <section className="bgit-patch-file" aria-label={`${TYPE_LABELS[file.type]} ${label}`}>
      <header className="bgit-patch-file-header">
        <span className="bgit-patch-file-path" title={label}>{label}</span>
        <span className={`bgit-patch-file-kind bgit-patch-file-kind-${file.type}`}>{TYPE_LABELS[file.type]}</span>
      </header>
      {file.hunks.length > 0 ? (
        <Diff
          key={`${file.oldRevision}:${file.newRevision}:${index}`}
          viewType="split"
          diffType={file.type}
          hunks={file.hunks}
          gutterType="default"
          optimizeSelection
        >
          {renderHunks}
        </Diff>
      ) : (
        <div className="bgit-diff-empty">{file.isBinary ? 'Binary file changed' : 'No textual changes'}</div>
      )}
    </section>
  )
}

export function GitPatchDiff(props: { patch: string }) {
  const parsed = useMemo(() => {
    try {
      return { files: parseGitPatch(props.patch), error: null }
    } catch (reason) {
      return { files: [], error: reason instanceof Error ? reason.message : String(reason) }
    }
  }, [props.patch])

  if (parsed.error !== null) {
    return <div className="bgit-diff-error" role="alert">Unable to render diff: {parsed.error}</div>
  }
  if (parsed.files.length === 0) {
    return <div className="bgit-diff-empty">No textual changes</div>
  }

  return (
    <div className="bgit-patch-files" aria-label={`${parsed.files.length} changed ${parsed.files.length === 1 ? 'file' : 'files'}`}>
      {parsed.files.map((file, index) => (
        <GitFileDiff key={`${file.oldPath}:${file.newPath}:${index}`} file={file} index={index} />
      ))}
    </div>
  )
}
