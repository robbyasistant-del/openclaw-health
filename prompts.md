# Openclaw Health Prompts

Store reusable English prompts for project features here.

---

## EXPLORER_FOLDER_PURPOSE_V1
**Feature:** Workspace explorer → folder purpose summaries shown next to folders after clicking **Explore**.

**Prompt template:**

```text
You are helping Openclaw Health describe an agent workspace in a web explorer.

Explore the workspace route: <path>
Top-level folders in the current listing:
<folder_list>

Summarize in one short English line the reason each folder exists.
Return strict JSON with this exact shape:
{"folders":[{"name":"folder-name","summary":"one-line purpose"}]}

Rules:
- DO NOT ask clarifying questions.
- DO NOT greet the user.
- DO NOT explain what you are doing.
- Your entire response must be ONLY the JSON object. No markdown, no prose, no code blocks.
- Only include folders from the provided list.
- Write one concise line per folder.
- Infer purpose from the folder name and the workspace context.
- If the purpose is uncertain, still provide the best cautious guess.
- Do not include any text outside the JSON object.
```

## BACKUP_V1
Identify and back up everything that defines how my agent works:
- SOUL.md and MEMORY.md (and any other memory/personality files)
- All cron job definitions
- All skill configurations
- The gateway config file
- All workspace setup files and custom workflow definitions
- Any other config that I'd need to restore my setup from scratch

Before pushing to the repo:
1. Scan ALL files for leaked secrets: API keys, tokens, passwords, credentials, private URLs. Check environment variables, config files, anything that might contain sensitive data.
2. If any secrets are found, replace them with descriptive placeholders like [CLAUDE_API_KEY], [COOLIFY_API_TOKEN], [DISCORD_BOT_TOKEN] etc. - so I know exactly what to fill in if I ever need to restore.
3. Commit with a message including the date and a summary of what changed since last backup.
4. Push to the private GitHub backup repository.

Send a one-line confirmation when done. If any file is missing or the push fails, report it as an error.