# Development

## Isolation rule

Develop and verify `dsh-better-git` through DSH Plugin Dev Manager. Do not link the repository into the stable Web profile. The managed workspace owns a separate `DSH_HOME`, Web profile, port, Host process, and Client watcher.

## Managed workspace

The repository's `.dsh-dev.yml` composes:

- `dsh-better-git` as the local primary plugin;
- `dsh-better-sidebar@0.18.0` from npm as the typed service provider and runtime dependency for DSH `0.1.2-rc.1`.

Better Git requires the client-side `betterSidebar` service. Installing only Better Git leaves its client entry pending and fails Web boot. Use the workspace manifest, not a single-package `dsh_dev_create` call without explicit dependencies. Sidebar `0.13.1` cannot boot on DSH `0.1.2-rc.1` because it imports the removed `settingsNamespace` export.

Create and start the workspace with:

```text
dsh_dev_workspace_create({ workspacePath: "/absolute/path/to/dsh-better-git" })
dsh_dev_start({ id: "dsh-better-git" })
```

Use the id returned by the manager for subsequent calls. To repair an existing instance, stop that instance and pass its existing id to `dsh_dev_workspace_create`; this preserves its managed port while refreshing the plugin composition.

Client bundle changes are rebuilt by `dev:client`. Host changes require a controlled `dsh_dev_restart({ id: "dsh-better-git", confirm: true })` after saving work in the isolated instance.

## Verification

The package gate runs type checking, behavior tests, both Host and Client builds, and a packed-artifact load test:

```bash
pnpm check
```

The Git behavior tests create temporary local repositories and do not require network access. Run the same gate through the manager before packaging:

```text
dsh_dev_check({ id: "dsh-better-git" })
dsh_dev_validate({ id: "dsh-better-git" })
```

### Browser integration smoke check

Host health and component tests do not prove that client services activate. At the managed instance URL:

1. Authenticate and confirm the Web shell renders without `Failed to load plugins` or pending-entry errors.
2. Select a Git workspace, expand the sidebar, and open **Better Git** from **New tab**. An empty draft is sufficient; do not send an agent message just to test the panel.
3. Confirm repository discovery and history load. Open a changed file or history commit and check that a rendered diff appears without console errors.
4. At panel widths of at least 600px, confirm Diff is on the left and commit controls/history are on the right. Check independent scrolling and preservation of any commit draft when closing Diff. Below 600px, confirm the stacked panes remain usable.

## Extension boundary

The plugin may type-import Better Sidebar's public `client/service` export and depend on `registerTab()` behavior. It must not value-import Better Sidebar code or use its private React components. Git API routes must validate explicit repository paths against repositories discovered from the current session workspace before executing a command.
