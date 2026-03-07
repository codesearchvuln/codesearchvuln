# Codex + Claude Code Integration

This directory contains the integration setup for using Codex with Claude Code to automatically document development sessions.

## What is Codex?

Codex is a CLI tool that helps capture and organize AI-assisted development conversations into structured markdown documentation.

## How It Works

The integration uses Claude Code hooks to automatically:

1. **Session Logging** - Captures user prompts with timestamps to `.codex/session.log`
2. **Session Documentation** - Saves complete session context to `.codex/docs/` when sessions end
3. **Markdown Generation** - Converts conversations into structured documentation

## Configuration

The integration is configured in [.claude/settings.local.json](../.claude/settings.local.json):

- `SessionEnd` hook: Runs `codex save` to export session documentation
- `UserPromptSubmit` hook: Logs user prompts with timestamps

## Directory Structure

```
.codex/
├── README.md           # This file
├── docs/               # Generated markdown documentation
└── session.log         # Timestamped user prompt log
```

## Usage

The hooks run automatically - no manual intervention needed. After each Claude Code session:

1. Session context is saved to `.codex/docs/`
2. User prompts are logged to `.codex/session.log`
3. Use `codex` CLI to process and organize the documentation

## Codex Commands

```bash
# Save current session manually
codex save --project AuditTool --output .codex/docs

# List saved sessions
codex list

# Export to different formats
codex export --format html
codex export --format pdf
```

## Configuration in ~/.codex/config.toml

Your global Codex configuration is at `~/.codex/config.toml` with:
- Custom model provider (yunyi)
- Local endpoint at http://127.0.0.1:15721/v1
- Fast mode enabled
- Request compression enabled

## Notes

- Documentation is generated asynchronously (doesn't block Claude Code)
- Session logs are append-only for audit trail
- All generated docs are in `.codex/docs/` (add to `.gitignore` if needed)
