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
You are performing a COMPLETE backup of the entire OpenClaw system configuration.

You MUST scan, collect, and back up EVERYTHING from the following locations:

### 1. Global OpenClaw configuration (~/.openclaw/)
- openclaw.json (main gateway config)
- openclaw.json.bak and openclaw.json.bak.* (backup versions of gateway config)
- openclaw-new.json
- exec-approvals.json (approval rules and permissions)
- gateway.cmd
- .env (global environment variables)
- update-check.json

### 2. Workspace root configuration files (~/.openclaw/workspace/)
- AGENTS.md
- SOUL.md
- MEMORY.md
- USER.md
- IDENTITY.md
- TOOLS.md
- HEARTBEAT.md
- BOOTSTRAP.md (if exists)
- PLAYBOOK_SUBAGENTS.md
- .env and .env.example
- next.config.mjs / next.config.ts / next.config.js
- package.json and package-lock.json
- tsconfig.json
- tailwind.config.ts / tailwind.config.js
- prisma.config.ts
- jest.config.js and jest.setup.js
- vercel.json
- components.json
- postcss.config.mjs
- middleware.ts
- .eslintrc.json
- .prettierrc and .prettierignore
- .lintstagedrc.json

### 3. ALL agent configurations (~/.openclaw/agents/*/)
For EVERY agent directory (main, codex, rob_android, rob_asogrowth, rob_market, rob_tester, rob_uxdesigner, rob_web, and any others), back up:
- agent/auth.json
- agent/auth-profiles.json
- agent/models.json
- sessions/sessions.json (session index file)

### 4. ALL installed skills (~/.openclaw/workspace/skills/*/)
- Every SKILL.md inside every skill subdirectory
- Any critical configuration files inside skill folders

### 5. Project-specific prompts and docs
- prompts.md (from the openclaw-health project)
- Any critical docs/ or memory/ files

### Pre-commit security requirements (MANDATORY):
1. Scan EVERY collected file for leaked secrets: API keys, tokens, passwords, credentials, bearer tokens, private URLs, SSH keys, JWTs.
2. Replace ANY found secret with a descriptive placeholder like [OPENAI_API_KEY], [GITHUB_TOKEN], [BEARER_TOKEN], [COOLIFY_API_TOKEN], [DISCORD_BOT_TOKEN], [DB_PASSWORD], etc.
3. Ensure placeholders are clear so restoration is possible without guessing.

### Git operations (MANDATORY):
1. Add ALL collected files to the backup repo.
2. Commit with a message that includes: the current ISO date, the number of agents backed up, and a brief summary of what changed.
3. Push to the private GitHub backup repository master branch.
4. If any file cannot be read or the push fails, report it as an error with details.

Send a concise confirmation when done, including how many agent configs and skill files were backed up. If anything failed, report the exact error.