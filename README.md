# dsh-better-git

An independent DSH bundle plugin that contributes a **Better Git** tab to [DSH Better Sidebar](https://github.com/omdsh-dev/DSH-better-sidebar).

## Purpose

Better Sidebar's built-in Git panel targets the active session working directory as one repository. `dsh-better-git` supports workspaces where the session root is not a Git repository and contains several independent repositories. It also discovers declared Git submodules and can initialize an uninitialized submodule explicitly.

The plugin does not patch or fork Better Sidebar. It uses the public `ctx.betterSidebar.registerTab()` service and owns its Host API, repository discovery, Git operations, and React UI.

## Features

- Discover the repository containing the session cwd.
- Scan a non-repository workspace for nested repositories.
- Enumerate recursive Git submodules with ready, uninitialized, out-of-sync, and conflicted states.
- Switch repositories and local branches.
- View staged, unstaged, and untracked changes.
- Stage, unstage, discard, and commit changes.
- View paged commit history and inline patches.
- Initialize declared submodules.
- Restrict Git operations to repositories discovered from the current session workspace.

Repository scans are bounded to four directory levels and 2,000 visited directories. Common generated directories such as `node_modules`, `dist`, and `build` are skipped.

## Requirements

- DeepSeek Harness Web compatible with the `0.1.0-rc.7` client packages.
- `dsh-better-sidebar` 0.13.x, which provides the `betterSidebar` client service.
- Git available on the Host PATH.

## Usage

1. Install `dsh-better-sidebar` and `dsh-better-git` in the same Web profile.
2. Open **Settings → Side card** and disable the built-in **Git** tab.
3. Open the sidebar `+` menu and select **Better Git**.

The built-in tab must be disabled manually because Better Sidebar does not expose an API that unregisters or replaces a built-in descriptor. `dsh-better-git` therefore registers the distinct tab id `better-git`.

## Development

Use Plugin Dev Manager so Host or Client failures stay inside an isolated DSH instance:

```text
dsh_dev_workspace_create({ workspacePath: "/absolute/path/to/dsh-better-git" })
dsh_dev_start({ id: "dsh-better-git" })
dsh_dev_check({ id: "dsh-better-git" })
```

The `.dsh-dev.yml` workspace installs Better Sidebar 0.13.1 as a packaged dependency and links this repository as the primary plugin. It does not alter the stable DSH profile.

Local verification:

```bash
pnpm install
pnpm check
```

## Scope

The initial release intentionally omits remote operations such as fetch, pull, push, and credential management. It also renders diffs inside the Better Git tab rather than reusing Better Sidebar's private `diff` tab implementation.
