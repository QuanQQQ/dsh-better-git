/**
 * Better Git visual language. Every color is sourced from DSH semantic theme
 * tokens so the panel follows light/dark skins without owning a palette.
 */
export const GIT_VIEW_STYLES = `
.bgit-root {
  --bgit-row-height: 32px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container: better-git / inline-size;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}

.bgit-root *,
.bgit-root *::before,
.bgit-root *::after {
  box-sizing: border-box;
}

.bgit-toolbar {
  flex: none;
  display: grid;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}

.bgit-toolbar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.bgit-select-shell {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 30px;
  display: flex;
  align-items: center;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base);
  transition:
    border-color var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease),
    background var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease);
}

.bgit-select-shell:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.bgit-select-shell:focus-within {
  border-color: var(--dsw-alias-brand-primary);
}

.bgit-select-leading,
.bgit-select-trailing {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
  pointer-events: none;
}

.bgit-select-leading { left: 8px; }
.bgit-select-trailing { right: 8px; }

.bgit-select {
  width: 100%;
  min-width: 0;
  height: 100%;
  appearance: none;
  border: none;
  outline: none;
  padding: 0 28px 0 30px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xxs-strong-12, 600 12px/18px system-ui, sans-serif);
  text-overflow: ellipsis;
  cursor: pointer;
}

.bgit-select:disabled {
  opacity: 0.55;
  cursor: default;
}

.bgit-branch-row {
  min-height: 28px;
}

.bgit-branch-row .bgit-select-shell {
  height: 28px;
  border-color: transparent;
  background: transparent;
}

.bgit-branch-row .bgit-select-shell:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.bgit-branch-row .bgit-select {
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}

.bgit-change-summary {
  flex: none;
  max-width: 34%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-icon-button,
.bgit-row-action,
.bgit-dismiss {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.bgit-icon-button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.bgit-icon-button:hover:not(:disabled),
.bgit-row-action:hover:not(:disabled),
.bgit-dismiss:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.bgit-icon-button:disabled,
.bgit-row-action:disabled {
  opacity: 0.42;
  cursor: default;
}

.bgit-spin {
  animation: bgit-spin 850ms linear infinite;
}

@keyframes bgit-spin {
  to { transform: rotate(360deg); }
}

.bgit-notice {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}

.bgit-notice-error {
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
}

.bgit-notice-warning {
  color: var(--dsw-alias-state-warn-label);
  background: var(--dsw-alias-state-warn-tertiary);
}

.bgit-notice-copy {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.bgit-dismiss {
  width: 22px;
  height: 22px;
  border-radius: 5px;
}

.bgit-inline-action {
  border: none;
  border-radius: 5px;
  padding: 2px 7px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: inherit;
  font: var(--dsw-font-xxxs-strong-11, 600 11px/16px system-ui, sans-serif);
  cursor: pointer;
}

.bgit-inline-action:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active);
}

.bgit-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
}

.bgit-content[data-has-diff='true'] {
  grid-template-columns: minmax(0, 1fr) clamp(220px, 32%, 320px);
}

.bgit-controls {
  container: better-git-controls / inline-size;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bgit-content[data-has-diff='true'] .bgit-controls {
  border-left: 1px solid var(--dsw-alias-border-l1);
}

.bgit-changes-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.bgit-placeholder {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
}

.bgit-placeholder-icon {
  display: inline-flex;
  color: var(--dsw-alias-label-tertiary);
  opacity: 0.72;
}

.bgit-placeholder-title {
  color: var(--dsw-alias-label-secondary);
  font: var(--dsw-font-xxs-strong-12, 600 12px/18px system-ui, sans-serif);
}

.bgit-placeholder-copy {
  max-width: 280px;
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-progress {
  height: 2px;
  flex: none;
  overflow: hidden;
  background: transparent;
}

.bgit-progress::after {
  content: '';
  display: block;
  width: 38%;
  height: 100%;
  background: var(--dsw-alias-brand-primary);
  animation: bgit-progress 1s ease-in-out infinite;
}

@keyframes bgit-progress {
  from { transform: translateX(-110%); }
  to { transform: translateX(365%); }
}

.bgit-diff {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.bgit-diff-header {
  flex: none;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 6px 0 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}

.bgit-diff-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font: var(--dsw-font-xxxs-strong-11, 600 11px/16px system-ui, sans-serif);
}

.bgit-diff-loading,
.bgit-diff-empty,
.bgit-diff-error {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}

.bgit-diff-error {
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
}

.bgit-diff-renderer {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--dsw-alias-bg-base);
  scrollbar-gutter: stable;
}

.bgit-patch-files {
  display: grid;
  gap: 8px;
  padding: 8px;
  --diff-background-color: var(--dsw-alias-bg-base);
  --diff-text-color: var(--dsw-alias-label-primary);
  --diff-font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --diff-selection-background-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 25%, transparent);
  --diff-gutter-insert-background-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 17%, var(--dsw-alias-bg-base));
  --diff-gutter-delete-background-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 17%, var(--dsw-alias-bg-base));
  --diff-code-insert-background-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, var(--dsw-alias-bg-base));
  --diff-code-delete-background-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, var(--dsw-alias-bg-base));
  --diff-code-insert-edit-background-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 28%, transparent);
  --diff-code-delete-edit-background-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 28%, transparent);
  --diff-omit-gutter-line-color: var(--dsw-alias-brand-primary);
}

.bgit-patch-file {
  min-width: 0;
  overflow: clip;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 7px;
  background: var(--dsw-alias-bg-base);
}

.bgit-patch-file-header {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}

.bgit-patch-file-path {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xxxs-strong-11, 600 11px/16px system-ui, sans-serif);
}

.bgit-patch-file-kind {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-patch-file-kind-add { color: var(--dsw-alias-state-success-primary); }
.bgit-patch-file-kind-delete { color: var(--dsw-alias-state-error-primary); }
.bgit-patch-file-kind-modify { color: var(--dsw-alias-state-warn-label); }

.bgit-patch-file .diff {
  font-size: 11px;
}

.bgit-patch-file .diff-gutter-col {
  width: 38px;
}

.bgit-patch-file .diff-gutter {
  padding-inline: 7px;
  color: var(--dsw-alias-label-tertiary);
}

.bgit-patch-file .diff-code {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.bgit-patch-file .diff-decoration-gutter,
.bgit-patch-file .diff-decoration-content {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary);
}

.bgit-diff-hunk-label {
  font: var(--dsw-font-xxxs-11, 11px/16px var(--diff-font-family));
}

.bgit-composer {
  flex: none;
  margin: 8px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}

.bgit-composer-input {
  width: 100%;
  min-height: 58px;
  resize: vertical;
  border: none;
  outline: none;
  padding: 2px 3px 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}

.bgit-composer-input::placeholder {
  color: var(--dsw-alias-label-tertiary);
}

.bgit-composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.bgit-composer-hint {
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-primary-button {
  min-width: 84px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: none;
  border-radius: 6px;
  padding: 0 12px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-inverted);
  font: var(--dsw-font-xxs-strong-12, 600 12px/18px system-ui, sans-serif);
  cursor: pointer;
}

.bgit-primary-button:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover);
}

.bgit-primary-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.bgit-section {
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.bgit-section-header {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px 0 6px;
  color: var(--dsw-alias-label-tertiary);
}

.bgit-disclosure {
  min-width: 0;
  height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 5px;
  padding: 0 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.bgit-disclosure:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.bgit-disclosure-chevron {
  transition: transform var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease);
}

.bgit-disclosure-chevron[data-open='false'] {
  transform: rotate(-90deg);
}

.bgit-section-title {
  color: var(--dsw-alias-label-secondary);
  font: var(--dsw-font-xxxs-strong-11, 600 11px/16px system-ui, sans-serif);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.bgit-count {
  min-width: 19px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-section-spacer { flex: 1; }

.bgit-section-action {
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  border-radius: 5px;
  padding: 0 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
  cursor: pointer;
}

.bgit-section-action:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.bgit-section-action:disabled {
  opacity: 0.42;
  cursor: default;
}

.bgit-row {
  min-height: var(--bgit-row-height);
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 6px;
  padding: 0 5px 0 8px;
  border-radius: 7px;
}

.bgit-row:hover,
.bgit-row:focus-within {
  background: var(--dsw-alias-interactive-bg-hover);
}

.bgit-row-main {
  flex: 1;
  min-width: 0;
  height: var(--bgit-row-height);
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  padding: 0;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.bgit-row-main:disabled {
  cursor: default;
}

.bgit-file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}

.bgit-file-dir {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-status {
  flex: none;
  width: 20px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-strong-11, 600 11px/16px system-ui, sans-serif);
}

.bgit-status[data-tone='added'] { color: var(--dsw-alias-state-success-primary); }
.bgit-status[data-tone='modified'] { color: var(--dsw-alias-state-warn-label); }
.bgit-status[data-tone='deleted'] { color: var(--dsw-alias-state-error-primary); }
.bgit-status[data-tone='renamed'] { color: var(--dsw-alias-brand-primary); }
.bgit-status[data-tone='untracked'] { color: var(--dsw-alias-label-secondary); }

.bgit-row-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  transition: opacity var(--ds-transition-duration-fast, 120ms) var(--ds-ease-in-out, ease);
}

.bgit-row:hover .bgit-row-actions,
.bgit-row:focus-within .bgit-row-actions {
  opacity: 1;
}

.bgit-row-action {
  width: 25px;
  height: 25px;
  border-radius: 5px;
}

.bgit-row-action-danger:hover:not(:disabled) {
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
}

.bgit-empty-changes {
  margin: 12px;
  padding: 18px 12px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 8px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
}

.bgit-history-list {
  padding: 0 6px 6px;
}

.bgit-log-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'dot subject time'
    'rail meta meta';
  column-gap: 8px;
  row-gap: 2px;
  border: none;
  border-radius: 7px;
  padding: 6px 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.bgit-log-row:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.bgit-log-node {
  grid-area: dot;
  position: relative;
  width: 12px;
  align-self: stretch;
}

.bgit-log-node::before {
  content: '';
  position: absolute;
  left: 5px;
  top: -6px;
  bottom: -8px;
  width: 1px;
  background: var(--dsw-alias-border-l2);
}

.bgit-log-node::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 6px;
  width: 7px;
  height: 7px;
  border: 2px solid var(--dsw-alias-brand-primary);
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1);
}

.bgit-log-subject {
  grid-area: subject;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}

.bgit-log-time {
  grid-area: time;
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
  white-space: nowrap;
}

.bgit-log-meta {
  grid-area: meta;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font: var(--dsw-font-xxxs-11, 11px/16px system-ui, sans-serif);
}

.bgit-log-hash {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.bgit-log-author {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bgit-log-ref {
  flex: none;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  padding: 0 5px;
  color: var(--dsw-alias-brand-primary);
  font: var(--dsw-font-xxxs-strong-11, 600 11px/16px system-ui, sans-serif);
}

.bgit-load-more {
  width: calc(100% - 12px);
  min-height: 28px;
  margin: 4px 6px 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
  cursor: pointer;
}

.bgit-load-more:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.bgit-load-more:disabled {
  opacity: 0.5;
  cursor: default;
}

.bgit-icon-button:focus-visible,
.bgit-row-action:focus-visible,
.bgit-dismiss:focus-visible,
.bgit-inline-action:focus-visible,
.bgit-primary-button:focus-visible,
.bgit-section-action:focus-visible,
.bgit-disclosure:focus-visible,
.bgit-row-main:focus-visible,
.bgit-log-row:focus-visible,
.bgit-load-more:focus-visible,
.bgit-composer-input:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}

@container better-git (max-width: 599px) {
  .bgit-content[data-has-diff='true'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }

  .bgit-content[data-has-diff='true'] .bgit-controls {
    border-left: none;
    border-top: 1px solid var(--dsw-alias-border-l1);
  }
}

@container better-git-controls (max-width: 320px) {
  .bgit-file-dir,
  .bgit-section-action span {
    display: none;
  }

  .bgit-row-main {
    grid-template-columns: minmax(0, 1fr);
  }
}

@container better-git (max-width: 520px) {
  .bgit-file-dir,
  .bgit-change-summary,
  .bgit-composer-hint,
  .bgit-section-action span {
    display: none;
  }

  .bgit-row-main {
    grid-template-columns: minmax(0, 1fr);
  }

  .bgit-row-actions {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bgit-spin,
  .bgit-progress::after {
    animation-duration: 1ms;
    animation-iteration-count: 1;
  }
}
`
