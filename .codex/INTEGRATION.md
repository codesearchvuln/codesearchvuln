# Codex + Claude Code Integration Setup

## Overview

This document describes the complete integration between Codex and Claude Code for the AuditTool project.

## Files Modified/Created

### 1. `.claude/settings.local.json`
Added hooks for automatic session capture:
- **SessionEnd**: Saves complete session to `.codex/docs/` as markdown
- **UserPromptSubmit**: Logs user prompts with timestamps to `.codex/session.log`

### 2. `.codex/` Directory Structure
```
.codex/
├── README.md           # User documentation
├── INTEGRATION.md      # This file - technical setup details
├── docs/               # Auto-generated session documentation
└── session.log         # Timestamped prompt log
```

### 3. `.gitignore`
Added exclusions for:
- `.codex/docs/` - Generated documentation
- `.codex/session.log` - Session logs

## Hook Configuration Details

### SessionEnd Hook
```json
{
  "type": "command",
  "command": "codex save --project AuditTool --output .codex/docs --format markdown",
  "statusMessage": "Saving session to Codex documentation",
  "async": true
}
```
- Runs asynchronously (non-blocking)
- Saves to project-local `.codex/docs/`
- Uses markdown format for easy reading

### UserPromptSubmit Hook
```json
{
  "type": "command",
  "command": "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] User: $ARGUMENTS\" >> .codex/session.log",
  "async": true
}
```
- Appends to session log with timestamp
- Captures user input for audit trail
- Runs asynchronously

## Codex Configuration

Global config at `~/.codex/config.toml`:
- Model provider: yunyi (custom)
- Endpoint: http://127.0.0.1:15721/v1
- Model: gpt-5.4 with xhigh reasoning effort
- Context window: 1M tokens
- Fast mode enabled

## Usage Workflow

1. **During Development**: Work normally with Claude Code
2. **On Session End**: Hooks automatically save documentation
3. **Review**: Check `.codex/docs/` for generated markdown
4. **Process**: Use `codex` CLI to organize/export documentation

## Manual Commands

```bash
# Save current session manually
codex save --project AuditTool --output .codex/docs

# View session log
tail -f .codex/session.log

# List all saved sessions
codex list

# Export documentation
codex export --format html
codex export --format pdf
```

## Benefits

1. **Automatic Documentation**: No manual effort required
2. **Audit Trail**: Complete log of user interactions
3. **Knowledge Base**: Searchable markdown documentation
4. **Team Collaboration**: Share session insights with team
5. **Non-Intrusive**: Async hooks don't slow down development

## Troubleshooting

### Hook Not Running
- Check permissions in `.claude/settings.local.json`
- Verify `codex` is in PATH
- Check hook logs with `claude --verbose`

### Missing Documentation
- Ensure `.codex/docs/` directory exists
- Check `codex` CLI is properly configured
- Verify write permissions

### Session Log Issues
- Check `.codex/session.log` permissions
- Ensure directory is not in `.gitignore` (only contents are)

## Next Steps

1. Test the integration by starting a new Claude Code session
2. Verify hooks execute by checking `.codex/session.log`
3. Review generated documentation in `.codex/docs/`
4. Customize hook commands if needed for your workflow
