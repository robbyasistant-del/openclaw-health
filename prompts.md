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

Summarize in between one and three short English lines the reason each folder exists.
Return strict JSON with this exact shape:
{"folders":[{"name":"folder-name","summary":"purpose description"}]}

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
You are responsible for creating a COMPLETE backup of the entire OpenClaw installation.

Your task:
1. Locate the OpenClaw installation directory and workspace root. Look in the user's home for a directory commonly named `.openclaw` and identify all agents working workspaces.
2. Recursively discover and collect ALL configuration files that are required to fully reconstruct this OpenClaw setup from scratch.

### Categories of files you MUST back up
- **Global OpenClaw configuration**: Find and back up the main gateway configuration file (commonly named `openclaw.json`), any backup/variant versions of it (files with `.bak`, `.bak.*`, `-new`, or similar suffixes), execution approval rules, gateway launcher scripts, global environment files, and update check files.
- **Workspace identity and memory files**: Collect all top-level identity, personality, memory, and agent-instruction files (e.g., files named `SOUL.md`, `MEMORY.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `AGENTS.md`, and any playbook or subagent instruction files). This for each agent workspace.
- **Agent configurations**: For EVERY agent directory found under the agents path, collect each agent's authentication profiles, model bindings, and session index files. These are typically located inside an `agent/` subdirectory and a `sessions/` subdirectory within each agent folder.
- **Skills**: For every installed skill directory, collect the primary skill definition file (typically `SKILL.md`) and any critical configuration files the skill relies on.
- **Project prompts and documentation**: Collect the project's `prompts.md` and any other critical documentation or memory files stored in `docs/` or `memory/` directories.

### Pre-commit security requirements (MANDATORY)
1. Scan EVERY collected file for leaked secrets: API keys, tokens, passwords, credentials, bearer tokens, private URLs, SSH keys, JWTs, and any other sensitive strings.
2. Replace ANY found secret with a descriptive placeholder such as [OPENAI_API_KEY], [GITHUB_TOKEN], [BEARER_TOKEN], [DB_PASSWORD], [DISCORD_BOT_TOKEN], [COOLIFY_API_TOKEN], etc.
3. Ensure placeholders are self-describing so a human knows exactly what to fill in during restoration.

### Git operations (MANDATORY)
1. Add ALL collected files to the designated backup repository.
2. Commit with a descriptive message that includes: the current ISO date, the number of agent configurations backed up, and a brief summary of what changed since the last backup.
3. Push the commit to the configured remote repository's default branch.
4. If any file cannot be read or the push fails, report it as an error with exact details.

Send a concise confirmation when done, including counts of agents and skills backed up. If anything failed, report the exact error.
