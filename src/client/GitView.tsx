/**
 * The better-git source-control panel: multi-repository discovery + switcher,
 * status list (staged vs unstaged vs untracked), stage/unstage/discard,
 * commit, branch switch, commit history, and inline diff.
 *
 * This is a self-contained replacement for better-sidebar's built-in Git tab
 * that adds support for workspaces whose root is not a git repository but
 * contains multiple nested git repositories (and git submodules).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitLogEntry, GitRepositoryInfo, GitStatusEntry, GitStatusResult, SessionScope } from './api.js'
import { api } from './api.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function badgeOf(entry: GitStatusEntry): string {
  const index = entry.xy[0]
  const worktree = entry.xy[1]
  if (index !== undefined && index !== ' ' && index !== '?') return index
  if (worktree !== undefined && worktree !== ' ' && worktree !== '?') return worktree
  return '?'
}

function isStaged(entry: GitStatusEntry): boolean {
  const index = entry.xy[0]
  return index !== undefined && index !== ' ' && index !== '?'
}

function isUnstaged(entry: GitStatusEntry): boolean {
  if (entry.xy === '??') return true
  const worktree = entry.xy[1]
  return worktree !== undefined && worktree !== ' ' && worktree !== '?'
}

function isUntracked(entry: GitStatusEntry): boolean {
  return entry.xy === '??'
}

function baseName(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

const LOG_BATCH = 30

// ── Component ───────────────────────────────────────────────────────────────

export function GitView(props: { scope: SessionScope }) {
  const { scope } = props

  const [repositories, setRepositories] = useState<GitRepositoryInfo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>()
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [branchNames, setBranchNames] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [logEntries, setLogEntries] = useState<GitLogEntry[]>([])
  const [logEnded, setLogEnded] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [diffPath, setDiffPath] = useState<string | null>(null)
  const [diffStaged, setDiffStaged] = useState(false)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [logLoading, setLogLoading] = useState(false)

  const discoveryRequestGen = useRef(0)
  const repoStateRequestGen = useRef(0)
  const diffRequestGen = useRef(0)

  // ── Repository discovery ────────────────────────────────────────────────

  const loadRepositories = useCallback(async () => {
    const gen = ++discoveryRequestGen.current
    setLoading(true)
    setError(null)
    try {
      const repos = await api.repositories(scope)
      if (gen !== discoveryRequestGen.current) return
      setRepositories(repos)
      if (repos.length > 0) {
        const firstReady = repos.find(r => r.initialized) ?? repos[0]
        setSelectedRepo(prev => repos.some(repo => repo.path === prev) ? prev : firstReady!.path)
      } else {
        setSelectedRepo(undefined)
      }
    } catch (e) {
      if (gen !== discoveryRequestGen.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (gen === discoveryRequestGen.current) setLoading(false)
    }
  }, [scope])

  // ── Load status + branches + log for the selected repo ──────────────────

  const loadRepoState = useCallback(async (repo: string) => {
    const gen = ++repoStateRequestGen.current
    try {
      const [st, br] = await Promise.all([
        api.status(scope, repo),
        api.branch(scope, repo),
      ])
      if (gen !== repoStateRequestGen.current) return
      setStatus(st)
      setCurrentBranch(br.current)
      setBranchNames(br.names)
      setLogEntries([])
      setLogEnded(false)
      setDiffText(null)
      setDiffPath(null)
    } catch (e) {
      if (gen !== repoStateRequestGen.current) return
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [scope])

  useEffect(() => {
    void loadRepositories()
  }, [loadRepositories])

  useEffect(() => {
    const selected = repositories.find(repository => repository.path === selectedRepo)
    if (selected?.initialized === true) {
      void loadRepoState(selected.path)
      return
    }
    setStatus(null)
    setCurrentBranch('')
    setBranchNames([])
    setLogEntries([])
    setLogEnded(false)
    setDiffText(null)
    setDiffPath(null)
  }, [repositories, selectedRepo, loadRepoState])

  // ── Log paging ──────────────────────────────────────────────────────────

  const loadMoreLog = useCallback(async () => {
    if (selectedRepo === undefined || logEnded || logLoading) return
    const selected = repositories.find(repository => repository.path === selectedRepo)
    if (selected?.initialized !== true) return
    setLogLoading(true)
    try {
      const entries = await api.log(scope, selectedRepo, LOG_BATCH, logEntries.length)
      setLogEntries(prev => [...prev, ...entries])
      if (entries.length < LOG_BATCH) setLogEnded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLogLoading(false)
    }
  }, [scope, repositories, selectedRepo, logEntries.length, logEnded, logLoading])

  useEffect(() => {
    if (selectedRepo !== undefined && logEntries.length === 0 && !logEnded) {
      void loadMoreLog()
    }
  }, [selectedRepo, logEntries.length, logEnded, loadMoreLog])

  // ── Diff view ───────────────────────────────────────────────────────────

  const openDiff = useCallback(async (path: string, staged: boolean) => {
    if (selectedRepo === undefined) return
    const gen = ++diffRequestGen.current
    setDiffPath(path)
    setDiffStaged(staged)
    setDiffLoading(true)
    setDiffText(null)
    try {
      const { diff } = await api.diff(scope, selectedRepo, path, staged)
      if (gen === diffRequestGen.current) setDiffText(diff)
    } catch (e) {
      if (gen === diffRequestGen.current) setDiffText(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      if (gen === diffRequestGen.current) setDiffLoading(false)
    }
  }, [scope, selectedRepo])

  // ── Stage / unstage / discard ───────────────────────────────────────────

  const stage = useCallback(async (path?: string) => {
    if (selectedRepo === undefined) return
    setBusy(true)
    try {
      await api.stage(scope, selectedRepo, path)
      await loadRepoState(selectedRepo)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [scope, selectedRepo, loadRepoState])

  const unstage = useCallback(async (path?: string) => {
    if (selectedRepo === undefined) return
    setBusy(true)
    try {
      await api.unstage(scope, selectedRepo, path)
      await loadRepoState(selectedRepo)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [scope, selectedRepo, loadRepoState])

  const discard = useCallback(async (path: string) => {
    if (selectedRepo === undefined) return
    if (!confirm(`Discard changes to ${baseName(path)}?`)) return
    setBusy(true)
    try {
      await api.discard(scope, selectedRepo, path)
      await loadRepoState(selectedRepo)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [scope, selectedRepo, loadRepoState])

  // ── Commit ──────────────────────────────────────────────────────────────

  const commit = useCallback(async () => {
    if (selectedRepo === undefined || commitMsg.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      await api.commit(scope, selectedRepo, commitMsg)
      setCommitMsg('')
      await loadRepoState(selectedRepo)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [scope, selectedRepo, commitMsg, loadRepoState])

  // ── Branch switch ───────────────────────────────────────────────────────

  const switchBranch = useCallback(async (branch: string) => {
    if (selectedRepo === undefined || branch === currentBranch) return
    setBusy(true)
    try {
      await api.checkout(scope, selectedRepo, branch)
      await loadRepoState(selectedRepo)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [scope, selectedRepo, currentBranch, loadRepoState])

  // ── Submodule init ──────────────────────────────────────────────────────

  const initSubmodule = useCallback(async (repo: GitRepositoryInfo) => {
    setBusy(true)
    try {
      await api.submoduleInit(scope, repo.path)
      await loadRepositories()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [scope, loadRepositories])

  // ── Derived data ────────────────────────────────────────────────────────

  const selectedRepository = repositories.find(repository => repository.path === selectedRepo)
  const staged = status?.entries.filter(isStaged) ?? []
  const unstaged = status?.entries.filter(entry => isUnstaged(entry) && !isStaged(entry) && !isUntracked(entry)) ?? []
  const untracked = status?.entries.filter(isUntracked) ?? []

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      {/* Header: repo selector + branch */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border, #ddd)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedRepo ?? ''}
            onChange={e => setSelectedRepo(e.target.value || undefined)}
            style={{ flex: 1, padding: '4px 6px', fontSize: 12 }}
            disabled={repositories.length === 0}
          >
            {repositories.length === 0 && <option value="">No repositories found</option>}
            {repositories.map(r => (
              <option key={r.path} value={r.path}>
                {r.name} ({r.kind}{r.initialized ? '' : ', uninitialized'})
              </option>
            ))}
          </select>
          <button onClick={() => void loadRepositories()} disabled={busy} title="Refresh repositories">
            ↻
          </button>
        </div>
        {selectedRepository?.initialized === true && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={currentBranch}
              onChange={e => void switchBranch(e.target.value)}
              style={{ flex: 1, padding: '4px 6px', fontSize: 12 }}
              disabled={busy}
            >
              {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{status?.branch ?? ''}</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error !== null && (
        <div style={{ padding: '6px 12px', background: '#fee', color: '#c00', fontSize: 12 }}>{error}</div>
      )}

      {/* Loading */}
      {loading && <div style={{ padding: 12, opacity: 0.6 }}>Loading repositories…</div>}

      {/* No repo selected */}
      {selectedRepo === undefined && !loading && (
        <div style={{ padding: 12, opacity: 0.6 }}>
          {repositories.length === 0
            ? 'No git repositories found in this workspace.'
            : 'Select a repository above.'}
        </div>
      )}

      {/* Submodule init prompt */}
      {selectedRepository !== undefined && !selectedRepository.initialized && (
        <div style={{ padding: '8px 12px', background: '#fff8e1', fontSize: 12 }}>
          This submodule is not initialized.{' '}
          <button onClick={() => void initSubmodule(selectedRepository)} disabled={busy}>Initialize</button>
        </div>
      )}

      {/* Body: scrollable content */}
      {selectedRepository?.initialized === true && !loading && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Diff panel */}
          {diffPath !== null && (
            <div style={{ borderBottom: '1px solid var(--color-border, #ddd)' }}>
              <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary, #f5f5f5)' }}>
                <span style={{ fontWeight: 600 }}>
                  {diffStaged ? 'Staged' : 'Unstaged'}: {baseName(diffPath)}
                </span>
                <button onClick={() => { diffRequestGen.current += 1; setDiffPath(null); setDiffText(null); setDiffLoading(false) }}>✕</button>
              </div>
              <pre style={{ margin: 0, padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12, fontFamily: 'monospace', maxHeight: 300, overflow: 'auto' }}>
                {diffLoading ? 'Loading diff…' : diffText ?? '(no diff)'}
              </pre>
            </div>
          )}

          {/* Staged changes */}
          {staged.length > 0 && (
            <Section title={`Staged Changes (${staged.length})`}>
              {staged.map(e => (
                <FileRow
                  key={e.path}
                  entry={e}
                  onDiff={() => void openDiff(e.path, true)}
                  onUnstage={() => void unstage(e.path)}
                  stageLabel="Unstage"
                />
              ))}
            </Section>
          )}

          {/* Unstaged changes */}
          {unstaged.length > 0 && (
            <Section title={`Changes (${unstaged.length})`}>
              {unstaged.map(e => (
                <FileRow
                  key={e.path}
                  entry={e}
                  onDiff={() => void openDiff(e.path, false)}
                  onStage={() => void stage(e.path)}
                  onDiscard={() => void discard(e.path)}
                  stageLabel="Stage"
                />
              ))}
            </Section>
          )}

          {/* Untracked */}
          {untracked.length > 0 && (
            <Section title={`Untracked (${untracked.length})`}>
              {untracked.map(e => (
                <FileRow
                  key={e.path}
                  entry={e}
                  onDiff={() => {}}
                  onStage={() => void stage(e.path)}
                  stageLabel="Stage"
                />
              ))}
            </Section>
          )}

          {/* Commit box */}
          {(staged.length > 0 || unstaged.length > 0 || untracked.length > 0) && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border, #ddd)' }}>
              <textarea
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder="Commit message…"
                rows={2}
                style={{ width: '100%', padding: 6, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => void stage()} disabled={busy || unstaged.length === 0 && untracked.length === 0}>
                  Stage All
                </button>
                <button onClick={() => void commit()} disabled={busy || commitMsg.trim() === '' || staged.length === 0}>
                  Commit
                </button>
              </div>
            </div>
          )}

          {/* History */}
          <div style={{ borderTop: '1px solid var(--color-border, #ddd)', marginTop: 8 }}>
            <div style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12 }}>History</div>
            {logEntries.map(entry => (
              <div
                key={entry.hashFull}
                style={{ padding: '4px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border, #eee)' }}
                onClick={() => void openCommitDiff(entry.hashFull)}
                title="Click to view commit diff"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <code style={{ fontSize: 11, opacity: 0.7 }}>{entry.hash}</code> {entry.subject}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' }}>{relativeTime(entry.date)}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{entry.author}</div>
              </div>
            ))}
            {!logEnded && (
              <div style={{ padding: '8px 12px', textAlign: 'center' }}>
                <button onClick={() => void loadMoreLog()} disabled={logLoading}>
                  {logLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  async function openCommitDiff(hash: string): Promise<void> {
    if (selectedRepo === undefined) return
    const gen = ++diffRequestGen.current
    setDiffPath(hash)
    setDiffStaged(false)
    setDiffLoading(true)
    setDiffText(null)
    try {
      const { diff } = await api.commitDiff(scope, selectedRepo, hash)
      if (gen === diffRequestGen.current) setDiffText(diff)
    } catch (error) {
      if (gen === diffRequestGen.current) setDiffText(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      if (gen === diffRequestGen.current) setDiffLoading(false)
    }
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border, #ddd)' }}>
      <div style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12, background: 'var(--color-bg-secondary, #f5f5f5)' }}>
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

function FileRow(props: {
  entry: GitStatusEntry
  onDiff: () => void
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
  stageLabel: string
}) {
  const { entry, onDiff, onStage, onUnstage, onDiscard, stageLabel } = props
  return (
    <div style={{ padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        display: 'inline-block',
        width: 20,
        textAlign: 'center',
        fontWeight: 700,
        fontSize: 11,
        color: badgeColor(entry.xy),
      }}>
        {badgeOf(entry)}
      </span>
      <span
        style={{ flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onClick={onDiff}
        title={entry.path}
      >
        {entry.path}
      </span>
      {onStage !== undefined && (
        <button onClick={onStage} style={{ fontSize: 11, padding: '1px 6px' }}>{stageLabel}</button>
      )}
      {onUnstage !== undefined && (
        <button onClick={onUnstage} style={{ fontSize: 11, padding: '1px 6px' }}>{stageLabel}</button>
      )}
      {onDiscard !== undefined && (
        <button onClick={onDiscard} style={{ fontSize: 11, padding: '1px 6px', color: '#c00' }}>Discard</button>
      )}
    </div>
  )
}

function badgeColor(xy: string): string {
  if (xy[0] === 'A' || xy[0] === 'M') return '#2a7'
  if (xy[0] === 'D') return '#c33'
  if (xy === '??') return '#888'
  if (xy[1] === 'M') return '#da3'
  return '#666'
}
