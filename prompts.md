# OpenClaw Health Prompts

## CLEAN WORKSPACE ROOT
**Feature:** Workspace Cleanup

```text
Analyze the workspace root folder and identify all files and folders that don't belong to the core system. For each item found, provide:
1. Name and location
2. Estimated size
3. Last modified date
4. Recommendation: Keep or Remove
5. Reason for recommendation

Be thorough and check all common locations including hidden folders.
```

---

## FOLDER_PURPOSE
**Feature:** Folder Analysis

```text
Analyze the specified folder and provide:
1. What the folder appears to be used for
2. Whether it's part of a standard project structure
3. If it can be safely moved to a subdirectory
4. Recommendations for organization
```

---

## EXPLORER_FOLDER_PURPOSE_V1
**Feature:** Intelligent Folder Explorer

```text
Explore and analyze folder structure to understand:
1. Project type and purpose
2. Key files and their roles
3. Dependencies and relationships
4. Potential issues or improvements
```

---

## BACKUP_V1
**Feature:** Backup Strategy

```text
Create a comprehensive backup strategy including:
1. Critical files to backup
2. Backup frequency recommendations
3. Storage location suggestions
4. Restoration procedures
```

---

## UPDATE OPENCLAW
**Feature:** Version Analysis and Update Recommendation

```text
Analyze OpenClaw versions between installed version <actual_version> and latest version <last_version> from https://github.com/openclaw/openclaw/releases

Research online sources including:
- Reddit discussions (r/openclaw, r/selfhosted, etc.)
- GitHub issues and discussions
- Official OpenClaw documentation (docs.openclaw.ai)
- Community forums and Discord
- Twitter/X posts about OpenClaw

Create a detailed comparison table in HTML format:

<table>
<thead>
<tr>
<th>Version</th>
<th>Type</th>
<th>Description</th>
<th>Impact</th>
</tr>
</thead>
<tbody>
<tr><td colspan="4"><strong>Version XXXX.XX.XX</strong></td></tr>
<tr><td></td><td>🔧 Fix</td><td>[Description of bug fix]</td><td>[High/Medium/Low]</td></tr>
<tr><td></td><td>✨ New Feature</td><td>[Description of new feature]</td><td>[High/Medium/Low]</td></tr>
<tr><td></td><td>🔄 Change</td><td>[Description of change/modification]</td><td>[High/Medium/Low]</td></tr>
<tr><td colspan="4"><strong>Version XXXX.XX.XX</strong></td></tr>
<tr><td></td><td>🔧 Fix</td><td>[Description]</td><td>[Impact]</td></tr>
<tr><td></td><td>✨ New Feature</td><td>[Description]</td><td>[Impact]</td></tr>
</tbody>
</table>

Then provide a stability analysis section:

### Stability Analysis

| Metric | Details |
|--------|---------|
| **Most Stable Version** | XXXX.XX.XX |
| **Reasoning** | [Based on community feedback, bug reports, release notes] |
| **Known Issues in Latest** | [Any critical bugs reported] |
| **Community Sentiment** | [Positive/Negative/Mixed - with sources] |

### Recommendation

**Recommended update to: XXXX.XX.XX**

**Justification:**
- [Key reason 1]
- [Key reason 2]
- [Key reason 3]

**Caution Notes:**
- [Any warnings or considerations]

**Upgrade Path:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

Include source citations for all information gathered from Reddit, GitHub, documentation, and other sources.
```

---

## EXECUTE UPDATE OPENCLAW
**Feature:** Execute OpenClaw Update to Specific Version

```text
Execute the OpenClaw update to version <version> with the following steps:

1. **Pre-update Check:**
   - Verify current OpenClaw version installed
   - Check if gateway is running (port 18789)
   - Verify internet connectivity to GitHub/npm

2. **Run Update Command:**
   - Execute: `openclaw update --version <version>` or `npm install -g openclaw@<version>`
   - Wait for package download and installation
   - Update all installed skills/plugins with `openclaw skills update --all`

3. **Restart Gateway Service:**
   - Stop the gateway if running: identify PID on port 18789 and terminate gracefully
   - Start the gateway: `openclaw gateway start` (in new PowerShell window, NEVER in current session)
   - Verify gateway is listening on port 18789
   - Wait 5 seconds for full initialization

4. **Post-update Verification:**
   - Check new version: `openclaw --version`
   - Verify gateway responds to API calls (GET /v1/models or similar health check)
   - Check all critical skills are loaded

5. **Report Results to Telegram (channel: webchat or configured default):**
   Message format:
   ```
   🔄 OpenClaw Update Complete
   
   Previous Version: [old_version]
   New Version: <version>
   Gateway Status: ✅ Running / ❌ Failed
   Skills Updated: [count] plugins updated
   
   Details:
   [Success/Failure message]
   ```

6. **Error Handling:**
   - If update command fails: Capture exact error message, suggest fix (permissions, network, etc.)
   - If gateway fails to start: Check logs, report specific error, suggest rollback
   - If skills fail to load: List which ones, suggest manual reinstall
   - NEVER silently continue on errors - always report what failed and why

**Important:** 
- The gateway restart MUST be done in a NEW PowerShell window (never use taskkill on the gateway process in the agent's session)
- If something fails, stop immediately and report the error with context
- Include exact command output in the report

Show final result message confirming update status and current running version.
```

---
