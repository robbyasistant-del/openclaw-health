# Openclaw Health Prompts

Store reusable English prompts for project features here.

---

## CLEAN WORKSPACE ROOT
**Feature:** Ad-hoc LLM action → Clean loose files from workspace root directory by executing moves.

**Prompt:**

```text
You are an AI assistant helping clean and organize the workspace root for the user "Amo" (the owner).

CRITICAL RULES:
1. ONLY these files are allowed in root:
   - .md files: MEMORY.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, AGENTS.md, HEARTBEAT.md, BOOTSTRAP.md, README.md, prompts.md
   - Config files: package.json, tsconfig.json, .gitignore, .env, next.config.*, tailwind.config.*, etc.
2. ALL other loose files MUST be moved to subdirectories
3. NEVER delete files - only move them to appropriate folders
4. Create target folders if needed: scripts/, docs/, assets/, temp/, misc/

TASK: Analyze the workspace root and return a JSON with actions to execute.

Current root files:
{{ROOT_FILES_LIST}}

For each file NOT in the allowed list, determine the action:
- Scripts (.js, .ts, .py, .sh, .ps1, .bat) → move to "scripts/"
- Documents (.txt, .pdf, .docx) → move to "docs/"
- Images/media (.jpg, .png, .gif, .svg, .webp, .ico, .mp4) → move to "assets/"
- Temp files (.tmp, .log, .bak, .cache) → move to "temp/" or delete
- Other loose files → move to "misc/"

Respond ONLY with valid JSON:
{
  "actions": [
    {"action": "move", "file": "script.js", "to": "scripts/"},
    {"action": "move", "file": "notes.txt", "to": "docs/"},
    {"action": "delete", "file": "temp.tmp"}
  ],
  "summary": "Movidos 3 archivos: script.js a scripts/, notes.txt a docs/, eliminado temp.tmp"
}

If nothing to do: {"actions": [], "summary": "Workspace limpio. No hay archivos que mover."}
```

**Usage:** HTTP call to OpenClaw gateway. API executes returned actions and shows summary.

---

## FOLDER_PURPOSE
**Feature:** Disk Usage Analyzer → Click on folder/file to analyze its purpose via OpenClaw LLM.

**Prompt:**

```text
You are an AI assistant helping analyze a folder/workspace for the user "Amo" (the owner).

Analyze this folder and provide a concise summary (max 400 characters) describing:
1. What the folder contains (main content types)
2. Its apparent purpose based on file names and structure
3. Its relationship to the user's work (if inferable from context)
4. Any notable git repositories or projects inside

Folder info:
- Name: {{FOLDER_NAME}}
- Path: {{FOLDER_PATH}}
- Size: {{FOLDER_SIZE}}
- Files: {{FILE_COUNT}}
- Subdirectories: {{DIR_COUNT}}

Top-level items (first 20):
{{ITEMS_LIST}}

Respond ONLY with the summary text (max 800 chars). No markdown, no JSON, just plain text description in Spanish.
```

**Usage:** Triggered via WS call to OpenClaw gateway LLM "default" or "gateway" when user clicks a folder/file in the Disk Usage analyzer.

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
2. Recursively discover and collect ALL configuration files (IMPORTANT: just config and setup files, not other content) that are required to fully reconstruct this OpenClaw setup from scratch.

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
