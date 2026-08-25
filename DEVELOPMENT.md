# Development

## Isolation rule

Develop and verify `dsh-better-git` through DSH Plugin Dev Manager. Do not link the repository into the stable Web profile. The managed workspace owns a separate `DSH_HOME`, Web profile, port, Host process, and Client watcher.

## Managed workspace

The repository's `.dsh-dev.yml` composes:

- `dsh-better-git` as the local primary plugin;
- `dsh-better-sidebar@0.13.1` as a packaged runtime dependency.

Create and start the workspace with:

```text
dsh_dev_workspace_create({ workspacePath: "/absolute/path/to/dsh-better-git" })
dsh_dev_start({ id: "dsh-better-git" })
```

Client bundle changes are rebuilt by `dev:client`. Host changes require a controlled `dsh_dev_restart({ id: "dsh-better-git", confirm: true })` after saving work in the isolated instance.

## Verification

The package gate runs type checking, tests, and both Host and Client builds:

```bash
pnpm check
```

The Git behavior tests create temporary local repositories and do not require network access. Run the same gate through the manager before packaging:

```text
dsh_dev_check({ id: "dsh-better-git" })
dsh_dev_validate({ id: "dsh-better-git" })
```

## Extension boundary

The plugin may depend on Better Sidebar's public service descriptors and `registerTab()` behavior. It must not import Better Sidebar source files or private React components. Git API routes must validate explicit repository paths against repositories discovered from the current session workspace before executing a command.
