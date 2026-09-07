/**
 * Multi-repository source-control panel registered through Better Sidebar.
 * The UI follows DSH's token-driven workbench language: compact toolbars,
 * grouped changes, row-hover actions, an early commit composer, and history.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GitLogEntry, GitRepositoryInfo, GitStatusEntry, GitStatusResult, SessionScope } from './api.js'
import { api } from './api.js'
import { GitPatchDiff } from './GitPatchDiff.js'
import { GIT_VIEW_STYLES } from './GitView.styles.js'

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

function directoryName(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at <= 0 ? '' : path.slice(0, at)
}

function statusTone(entry: GitStatusEntry): 'added' | 'deleted' | 'modified' | 'renamed' | 'untracked' | 'neutral' {
  if (entry.xy === '??') return 'untracked'
  const badge = badgeOf(entry)
  if (badge === 'A') return 'added'
  if (badge === 'D') return 'deleted'
  if (badge === 'R' || badge === 'C') return 'renamed'
  if (badge === 'M' || badge === 'U') return 'modified'
  return 'neutral'
}

function statusDescription(entry: GitStatusEntry): string {
  if (entry.xy === '??') return 'Untracked'
  switch (badgeOf(entry)) {
    case 'A': return 'Added'
    case 'D': return 'Deleted'
    case 'M': return 'Modified'
    case 'R': return 'Renamed'
    case 'C': return 'Copied'
    case 'U': return 'Unmerged'
    default: return `Git status ${entry.xy.trim() || entry.xy}`
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Math.max(0, Date.now() - then)
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

function refNames(refs: string): string[] {
  return [...new Set(refs
    .split(',')
    .map(ref => ref.trim())
    .filter(Boolean)
    .map(ref => ref.includes(' -> ') ? ref.slice(ref.indexOf(' -> ') + 4) : ref)
    .map(ref => ref.startsWith('tag: ') ? ref.slice(5) : ref))]
}

function repositoryLabel(repository: GitRepositoryInfo): string {
  const state = repository.initialized ? repository.kind : `${repository.kind}, uninitialized`
  return `${repository.name} (${state})`
}

const LOG_BATCH = 30

export function GitView(props: { scope: SessionScope }) {
  const { scope } = props
  // Better Sidebar recreates this prop object during focus/layout updates.
  // Stabilise it by value so equivalent parent renders never restart discovery.
  const stableScope = useMemo<SessionScope>(() => (
    scope.cwd === undefined
      ? { sessionId: scope.sessionId }
      : { sessionId: scope.sessionId, cwd: scope.cwd }
  ), [scope.sessionId, scope.cwd])

  const [repositories, setRepositories] = useState<GitRepositoryInfo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>()
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [branchNames, setBranchNames] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState('')
  const [pendingBranch, setPendingBranch] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<GitLogEntry[]>([])
  const [logEnded, setLogEnded] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [discovering, setDiscovering] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [repoLoading, setRepoLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [diffPath, setDiffPath] = useState<string | null>(null)
  const [diffLabel, setDiffLabel] = useState('')
  const [diffStaged, setDiffStaged] = useState(false)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [logLoading, setLogLoading] = useState(false)

  const discoveryRequestGen = useRef(0)
  const repoStateRequestGen = useRef(0)
  const logRequestGen = useRef(0)
  const diffRequestGen = useRef(0)
  const discoveredRef = useRef(false)
  const selectedRepoRef = useRef<string | undefined>(undefined)

  const selectedRepository = useMemo(
    () => repositories.find(repository => repository.path === selectedRepo),
    [repositories, selectedRepo],
  )

  useEffect(() => {
    selectedRepoRef.current = selectedRepo
  }, [selectedRepo])

  const loadRepositories = useCallback(async () => {
    const gen = ++discoveryRequestGen.current
    const initial = !discoveredRef.current
    if (initial) setDiscovering(true)
    else setRefreshing(true)
    setError(null)
    try {
      const repos = await api.repositories(stableScope)
      if (gen !== discoveryRequestGen.current) return
      setRepositories(repos)
      if (repos.length === 0) {
        setSelectedRepo(undefined)
      } else {
        const firstReady = repos.find(repository => repository.initialized) ?? repos[0]
        setSelectedRepo(previous => repos.some(repository => repository.path === previous) ? previous : firstReady?.path)
      }
    } catch (reason) {
      if (gen === discoveryRequestGen.current) setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (gen === discoveryRequestGen.current) {
        discoveredRef.current = true
        setDiscovering(false)
        setRefreshing(false)
      }
    }
  }, [stableScope])

  const loadRepoState = useCallback(async (repo: string) => {
    const gen = ++repoStateRequestGen.current
    setRepoLoading(true)
    setError(null)
    try {
      const [nextStatus, branches] = await Promise.all([
        api.status(stableScope, repo),
        api.branch(stableScope, repo),
      ])
      if (gen !== repoStateRequestGen.current || selectedRepoRef.current !== repo) return
      setStatus(nextStatus)
      setCurrentBranch(branches.current)
      setBranchNames(branches.names)
      setPendingBranch(null)
      logRequestGen.current += 1
      setLogEntries([])
      setLogEnded(false)
      setLogLoading(false)
      diffRequestGen.current += 1
      setDiffText(null)
      setDiffPath(null)
      setDiffLabel('')
      setDiffLoading(false)
    } catch (reason) {
      if (gen === repoStateRequestGen.current) setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (gen === repoStateRequestGen.current) setRepoLoading(false)
    }
  }, [stableScope])

  useEffect(() => {
    void loadRepositories()
  }, [loadRepositories])

  useEffect(() => {
    if (selectedRepository?.initialized === true) {
      void loadRepoState(selectedRepository.path)
      return
    }
    repoStateRequestGen.current += 1
    logRequestGen.current += 1
    diffRequestGen.current += 1
    setRepoLoading(false)
    setStatus(null)
    setCurrentBranch('')
    setPendingBranch(null)
    setBranchNames([])
    setLogEntries([])
    setLogEnded(false)
    setLogLoading(false)
    setDiffText(null)
    setDiffPath(null)
    setDiffLabel('')
    setDiffLoading(false)
  }, [selectedRepository?.path, selectedRepository?.initialized, loadRepoState])

  const loadMoreLog = useCallback(async () => {
    if (selectedRepo === undefined || selectedRepository?.initialized !== true || logEnded || logLoading || repoLoading) return
    const repo = selectedRepo
    const gen = logRequestGen.current
    setLogLoading(true)
    try {
      const entries = await api.log(stableScope, repo, LOG_BATCH, logEntries.length)
      if (gen !== logRequestGen.current || selectedRepoRef.current !== repo) return
      setLogEntries(previous => [...previous, ...entries])
      if (entries.length < LOG_BATCH) setLogEnded(true)
    } catch (reason) {
      if (gen === logRequestGen.current) setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (gen === logRequestGen.current) setLogLoading(false)
    }
  }, [stableScope, selectedRepo, selectedRepository?.initialized, logEntries.length, logEnded, logLoading, repoLoading])

  useEffect(() => {
    if (selectedRepo !== undefined && logEntries.length === 0 && !logEnded && !repoLoading) void loadMoreLog()
  }, [selectedRepo, logEntries.length, logEnded, repoLoading, loadMoreLog])

  const selectRepository = useCallback((repo: string | undefined) => {
    if (repo === selectedRepo) return
    repoStateRequestGen.current += 1
    logRequestGen.current += 1
    diffRequestGen.current += 1
    selectedRepoRef.current = repo
    setSelectedRepo(repo)
    setStatus(null)
    setCurrentBranch('')
    setPendingBranch(null)
    setBranchNames([])
    setLogEntries([])
    setLogEnded(false)
    setLogLoading(false)
    setCommitMsg('')
    setDiffPath(null)
    setDiffLabel('')
    setDiffText(null)
    setDiffLoading(false)
    setRepoLoading(repo !== undefined)
    setError(null)
  }, [selectedRepo])

  const openDiff = useCallback(async (path: string, staged: boolean) => {
    if (selectedRepo === undefined) return
    const gen = ++diffRequestGen.current
    setDiffPath(path)
    setDiffLabel(`${staged ? 'Staged' : 'Changes'} · ${baseName(path)}`)
    setDiffStaged(staged)
    setDiffLoading(true)
    setDiffText(null)
    try {
      const result = await api.diff(stableScope, selectedRepo, path, staged)
      if (gen === diffRequestGen.current) setDiffText(result.diff)
    } catch (reason) {
      if (gen === diffRequestGen.current) setDiffText(`Error: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      if (gen === diffRequestGen.current) setDiffLoading(false)
    }
  }, [stableScope, selectedRepo])

  const openCommitDiff = useCallback(async (entry: GitLogEntry) => {
    if (selectedRepo === undefined) return
    const gen = ++diffRequestGen.current
    setDiffPath(entry.hashFull)
    setDiffLabel(`Commit · ${entry.hash}`)
    setDiffStaged(false)
    setDiffLoading(true)
    setDiffText(null)
    try {
      const result = await api.commitDiff(stableScope, selectedRepo, entry.hashFull)
      if (gen === diffRequestGen.current) setDiffText(result.diff)
    } catch (reason) {
      if (gen === diffRequestGen.current) setDiffText(`Error: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      if (gen === diffRequestGen.current) setDiffLoading(false)
    }
  }, [stableScope, selectedRepo])

  const closeDiff = useCallback(() => {
    diffRequestGen.current += 1
    setDiffPath(null)
    setDiffLabel('')
    setDiffText(null)
    setDiffLoading(false)
  }, [])

  const stage = useCallback(async (path?: string) => {
    if (selectedRepo === undefined) return
    setBusy(true)
    setError(null)
    try {
      await api.stage(stableScope, selectedRepo, path)
      await loadRepoState(selectedRepo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [stableScope, selectedRepo, loadRepoState])

  const unstage = useCallback(async (path?: string) => {
    if (selectedRepo === undefined) return
    setBusy(true)
    setError(null)
    try {
      await api.unstage(stableScope, selectedRepo, path)
      await loadRepoState(selectedRepo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [stableScope, selectedRepo, loadRepoState])

  const discard = useCallback(async (path: string) => {
    if (selectedRepo === undefined || !window.confirm(`Discard changes to ${baseName(path)}?`)) return
    setBusy(true)
    setError(null)
    try {
      await api.discard(stableScope, selectedRepo, path)
      await loadRepoState(selectedRepo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [stableScope, selectedRepo, loadRepoState])

  const commit = useCallback(async () => {
    const message = commitMsg.trim()
    if (selectedRepo === undefined || message === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.commit(stableScope, selectedRepo, message)
      setCommitMsg('')
      await loadRepoState(selectedRepo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [stableScope, selectedRepo, commitMsg, busy, loadRepoState])

  const switchBranch = useCallback(async (branch: string) => {
    if (selectedRepo === undefined || branch === currentBranch || busy) return
    setBusy(true)
    setPendingBranch(branch)
    setError(null)
    try {
      await api.checkout(stableScope, selectedRepo, branch)
      await loadRepoState(selectedRepo)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setPendingBranch(null)
      setBusy(false)
    }
  }, [stableScope, selectedRepo, currentBranch, busy, loadRepoState])

  const initSubmodule = useCallback(async (repository: GitRepositoryInfo) => {
    setBusy(true)
    setError(null)
    try {
      await api.submoduleInit(stableScope, repository.path)
      await loadRepositories()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }, [stableScope, loadRepositories])

  const refreshAll = useCallback(async () => {
    const tasks: Promise<unknown>[] = [loadRepositories()]
    if (selectedRepository?.initialized === true) tasks.push(loadRepoState(selectedRepository.path))
    await Promise.all(tasks)
  }, [loadRepositories, loadRepoState, selectedRepository?.path, selectedRepository?.initialized])

  const staged = status?.entries.filter(isStaged) ?? []
  // A partially staged file (for example MM) belongs in both sections.
  const unstaged = status?.entries.filter(entry => isUnstaged(entry) && !isUntracked(entry)) ?? []
  const untracked = status?.entries.filter(isUntracked) ?? []
  const changeCount = status?.entries.length ?? 0
  const toolbarLoading = discovering || refreshing || repoLoading
  const branchValue = pendingBranch ?? currentBranch
  const renderedBranches = currentBranch !== '' && !branchNames.includes(currentBranch)
    ? [currentBranch, ...branchNames]
    : branchNames

  return (
    <>
      <style>{GIT_VIEW_STYLES}</style>
      <div className="bgit-root" aria-busy={toolbarLoading || busy}>
        <header className="bgit-toolbar">
          <div className="bgit-toolbar-row">
            <label className="bgit-select-shell" title={selectedRepository?.path}>
              <span className="bgit-select-leading"><Icon name="repository" /></span>
              <select
                aria-label="Repository"
                className="bgit-select"
                value={selectedRepo ?? ''}
                onChange={event => selectRepository(event.target.value || undefined)}
                disabled={discovering || repositories.length === 0}
              >
                {repositories.length === 0
                  ? <option value="">No repositories found</option>
                  : <option value="" disabled>Select repository</option>}
                {repositories.map(repository => (
                  <option key={repository.path} value={repository.path}>{repositoryLabel(repository)}</option>
                ))}
              </select>
              <span className="bgit-select-trailing"><Icon name="chevron" size={14} /></span>
            </label>
            <button
              type="button"
              className="bgit-icon-button"
              aria-label="Refresh source control"
              title="Refresh source control"
              disabled={refreshing || busy}
              onClick={() => { void refreshAll() }}
            >
              <Icon name="refresh" {...(toolbarLoading ? { className: 'bgit-spin' } : {})} />
            </button>
          </div>

          {selectedRepository?.initialized === true && (
            <div className="bgit-toolbar-row bgit-branch-row">
              <label className="bgit-select-shell" title={branchValue || 'Branch'}>
                <span className="bgit-select-leading"><Icon name="branch" /></span>
                <select
                  aria-label="Branch"
                  className="bgit-select"
                  value={branchValue}
                  onChange={event => { void switchBranch(event.target.value) }}
                  disabled={busy || repoLoading || renderedBranches.length === 0}
                >
                  {renderedBranches.length === 0 && <option value="">Loading branches…</option>}
                  {renderedBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}
                </select>
                <span className="bgit-select-trailing"><Icon name="chevron" size={14} /></span>
              </label>
              <span className="bgit-change-summary">
                {repoLoading ? 'Updating…' : `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}`}
              </span>
            </div>
          )}
        </header>

        {toolbarLoading && <div className="bgit-progress" aria-hidden="true" />}

        {error !== null && (
          <div className="bgit-notice bgit-notice-error" role="alert">
            <Icon name="warning" />
            <span className="bgit-notice-copy">{error}</span>
            <button type="button" className="bgit-dismiss" aria-label="Dismiss error" onClick={() => setError(null)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {selectedRepository !== undefined && !selectedRepository.initialized && (
          <div className="bgit-notice bgit-notice-warning">
            <Icon name="warning" />
            <span className="bgit-notice-copy">This submodule is not initialized.</span>
            <button
              type="button"
              className="bgit-inline-action"
              disabled={busy}
              onClick={() => { void initSubmodule(selectedRepository) }}
            >
              Initialize
            </button>
          </div>
        )}

        {discovering && repositories.length === 0 && (
          <Placeholder icon="repository" title="Finding repositories…" copy="Scanning this workspace for Git repositories and submodules." />
        )}

        {!discovering && selectedRepo === undefined && (
          <Placeholder
            icon="repository"
            title={repositories.length === 0 ? 'No repositories found' : 'Select a repository'}
            copy={repositories.length === 0
              ? 'Open a workspace containing a Git repository or initialize one first.'
              : 'Choose a repository from the toolbar to inspect its changes.'}
          />
        )}

        {selectedRepository?.initialized === true && !discovering && (
          <main className="bgit-content">
            {repoLoading && status === null ? (
              <Placeholder icon="branch" title="Loading repository…" copy="Reading branches, changes, and history." />
            ) : (
              <>
                {diffPath !== null && (
                  <section className="bgit-diff" aria-label={diffLabel}>
                    <div className="bgit-diff-header">
                      <Icon name="diff" />
                      <span className="bgit-diff-title">{diffLabel}</span>
                      <button type="button" className="bgit-dismiss" aria-label="Close diff" title="Close diff" onClick={closeDiff}>
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    {diffLoading ? (
                      <div className="bgit-diff-loading" role="status">Loading diff…</div>
                    ) : diffText?.startsWith('Error:') === true ? (
                      <div className="bgit-diff-error" role="alert">{diffText}</div>
                    ) : diffText?.trim() === '' || diffText === null ? (
                      <div className="bgit-diff-empty">No textual changes</div>
                    ) : (
                      <div className="bgit-diff-renderer">
                        <GitPatchDiff patch={diffText} />
                      </div>
                    )}
                  </section>
                )}

                {changeCount > 0 && (
                  <section className="bgit-composer" aria-label="Commit changes">
                    <textarea
                      aria-label="Commit message"
                      className="bgit-composer-input"
                      value={commitMsg}
                      onChange={event => setCommitMsg(event.target.value)}
                      onKeyDown={event => {
                        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void commit()
                      }}
                      placeholder={staged.length === 0 ? 'Stage changes before committing…' : 'Commit message…'}
                      rows={2}
                      disabled={busy}
                    />
                    <div className="bgit-composer-actions">
                      <span className="bgit-composer-hint">⌘↵ to commit</span>
                      <button
                        type="button"
                        className="bgit-primary-button"
                        disabled={busy || commitMsg.trim() === '' || staged.length === 0}
                        onClick={() => { void commit() }}
                      >
                        <Icon name="check" size={14} />
                        Commit
                      </button>
                    </div>
                  </section>
                )}

                {staged.length > 0 && (
                  <Section
                    title="Staged changes"
                    count={staged.length}
                    action={(
                      <SectionAction icon="minus" label="Unstage all" disabled={busy} onClick={() => { void unstage() }} />
                    )}
                  >
                    {staged.map(entry => (
                      <FileRow
                        key={entry.path}
                        entry={entry}
                        disabled={busy}
                        onDiff={() => { void openDiff(entry.path, true) }}
                        onUnstage={() => { void unstage(entry.path) }}
                      />
                    ))}
                  </Section>
                )}

                {unstaged.length > 0 && (
                  <Section
                    title="Changes"
                    count={unstaged.length}
                    action={(
                      <SectionAction icon="plus" label="Stage all" disabled={busy} onClick={() => { void stage() }} />
                    )}
                  >
                    {unstaged.map(entry => (
                      <FileRow
                        key={entry.path}
                        entry={entry}
                        disabled={busy}
                        onDiff={() => { void openDiff(entry.path, false) }}
                        onStage={() => { void stage(entry.path) }}
                        onDiscard={() => { void discard(entry.path) }}
                      />
                    ))}
                  </Section>
                )}

                {untracked.length > 0 && (
                  <Section
                    title="Untracked"
                    count={untracked.length}
                    action={(
                      <SectionAction icon="plus" label="Stage all" disabled={busy} onClick={() => { void stage() }} />
                    )}
                  >
                    {untracked.map(entry => (
                      <FileRow
                        key={entry.path}
                        entry={entry}
                        disabled={busy}
                        onStage={() => { void stage(entry.path) }}
                      />
                    ))}
                  </Section>
                )}

                {changeCount === 0 && !repoLoading && (
                  <div className="bgit-empty-changes">Working tree clean</div>
                )}

                <Section title="History" count={logEntries.length} defaultOpen={changeCount === 0}>
                  <div className="bgit-history-list">
                    {logEntries.map(entry => (
                      <button
                        key={entry.hashFull}
                        type="button"
                        className="bgit-log-row"
                        title={`${entry.hashFull}\n${entry.author} · ${entry.date}`}
                        onClick={() => { void openCommitDiff(entry) }}
                      >
                        <span className="bgit-log-node" aria-hidden="true" />
                        <span className="bgit-log-subject">{entry.subject}</span>
                        <span className="bgit-log-time">{relativeTime(entry.date)}</span>
                        <span className="bgit-log-meta">
                          <span className="bgit-log-hash">{entry.hash}</span>
                          {refNames(entry.refs).slice(0, 2).map(ref => <span key={ref} className="bgit-log-ref">{ref}</span>)}
                          <span className="bgit-log-author">{entry.author}</span>
                        </span>
                      </button>
                    ))}
                    {logEntries.length === 0 && !logLoading && (
                      <div className="bgit-placeholder-copy">No commits to show.</div>
                    )}
                    {!logEnded && (
                      <button
                        type="button"
                        className="bgit-load-more"
                        disabled={logLoading || repoLoading}
                        onClick={() => { void loadMoreLog() }}
                      >
                        {logLoading ? 'Loading history…' : 'Load more'}
                      </button>
                    )}
                  </div>
                </Section>
              </>
            )}
          </main>
        )}
      </div>
    </>
  )
}

function Placeholder(props: { icon: IconName; title: string; copy: string }) {
  return (
    <div className="bgit-placeholder" role="status">
      <span className="bgit-placeholder-icon"><Icon name={props.icon} size={22} /></span>
      <span className="bgit-placeholder-title">{props.title}</span>
      <span className="bgit-placeholder-copy">{props.copy}</span>
    </div>
  )
}

function Section(props: { title: string; count: number; action?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true)
  const regionId = useId()
  return (
    <section className="bgit-section">
      <div className="bgit-section-header">
        <button
          type="button"
          className="bgit-disclosure"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen(previous => !previous)}
        >
          <span className="bgit-disclosure-chevron" data-open={open}><Icon name="chevron" size={13} /></span>
          <span className="bgit-section-title">{props.title}</span>
          <span className="bgit-count">{props.count}</span>
        </button>
        <span className="bgit-section-spacer" />
        {props.action}
      </div>
      {open && <div id={regionId}>{props.children}</div>}
    </section>
  )
}

function SectionAction(props: { icon: IconName; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bgit-section-action"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <Icon name={props.icon} size={14} />
      <span>{props.label}</span>
    </button>
  )
}

function FileRow(props: {
  entry: GitStatusEntry
  disabled: boolean
  onDiff?: () => void
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
}) {
  const { entry, disabled, onDiff, onStage, onUnstage, onDiscard } = props
  const directory = directoryName(entry.path)
  return (
    <div className="bgit-row">
      <button
        type="button"
        className="bgit-row-main"
        title={entry.path}
        disabled={onDiff === undefined}
        onClick={onDiff}
      >
        <span className="bgit-file-name">{baseName(entry.path)}</span>
        {directory !== '' && <span className="bgit-file-dir">{directory}</span>}
      </button>
      <span
        className="bgit-status"
        data-tone={statusTone(entry)}
        title={`${statusDescription(entry)} (${entry.xy})`}
        aria-label={statusDescription(entry)}
      >
        {badgeOf(entry)}
      </span>
      <span className="bgit-row-actions">
        {onStage !== undefined && (
          <button type="button" className="bgit-row-action" title="Stage" aria-label={`Stage ${entry.path}`} disabled={disabled} onClick={onStage}>
            <Icon name="plus" size={14} />
          </button>
        )}
        {onUnstage !== undefined && (
          <button type="button" className="bgit-row-action" title="Unstage" aria-label={`Unstage ${entry.path}`} disabled={disabled} onClick={onUnstage}>
            <Icon name="minus" size={14} />
          </button>
        )}
        {onDiscard !== undefined && (
          <button type="button" className="bgit-row-action bgit-row-action-danger" title="Discard changes" aria-label={`Discard changes to ${entry.path}`} disabled={disabled} onClick={onDiscard}>
            <Icon name="trash" size={14} />
          </button>
        )}
      </span>
    </div>
  )
}

type IconName = 'branch' | 'check' | 'chevron' | 'close' | 'diff' | 'minus' | 'plus' | 'refresh' | 'repository' | 'trash' | 'warning'

function Icon(props: { name: IconName; size?: number; className?: string }) {
  const size = props.size ?? 16
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: props.className,
  }
  switch (props.name) {
    case 'repository':
      return <svg {...common}><path d="M2.5 4.5h4l1.2 1.4h5.8v6.6h-11z" /><path d="M2.5 4.5V3h4.2l1.1 1.2" /></svg>
    case 'branch':
      return <svg {...common}><circle cx="4" cy="3.5" r="1.5" /><circle cx="11.5" cy="4.5" r="1.5" /><circle cx="4" cy="12.5" r="1.5" /><path d="M4 5v6M5.5 8h2.1a4 4 0 0 0 4-2" /></svg>
    case 'refresh':
      return <svg {...common}><path d="M13 4.5V1.8l-1.2 1.1A5.5 5.5 0 1 0 13.2 9" /><path d="M13 1.8h-2.7" /></svg>
    case 'chevron':
      return <svg {...common}><path d="m4.5 6 3.5 3.5L11.5 6" /></svg>
    case 'plus':
      return <svg {...common}><path d="M8 3.2v9.6M3.2 8h9.6" /></svg>
    case 'minus':
      return <svg {...common}><path d="M3.2 8h9.6" /></svg>
    case 'trash':
      return <svg {...common}><path d="M3.5 4.7h9M6 2.8h4M5 4.7l.5 8h5l.5-8M6.8 6.7v4M9.2 6.7v4" /></svg>
    case 'close':
      return <svg {...common}><path d="m4 4 8 8M12 4l-8 8" /></svg>
    case 'check':
      return <svg {...common}><path d="m3.2 8.2 3 3 6.6-6.5" /></svg>
    case 'warning':
      return <svg {...common}><path d="M8 2.2 14 13H2z" /><path d="M8 5.7v3.5M8 11.4h.01" /></svg>
    case 'diff':
      return <svg {...common}><circle cx="4" cy="3" r="1.3" /><circle cx="4" cy="13" r="1.3" /><circle cx="12" cy="5" r="1.3" /><path d="M4 4.3v7.4M5.3 8h2.2a4.5 4.5 0 0 0 4.5-1.7" /></svg>
  }
}
