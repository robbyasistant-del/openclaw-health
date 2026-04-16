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
Execute the OpenClaw update to version <version> with the following REAL steps:

**⚠️ WARNING: This process will restart the OpenClaw Gateway, which will temporarily disconnect this agent session.**

**REAL Step 1: Pre-update Check**
- Run `openclaw --version` to confirm current version
- Run `openclaw gateway status` to check if gateway is running
- Verify internet connectivity to npm registry

**REAL Step 2: Stop Gateway (REQUIRED before update)**
- Identify the gateway process on port 18789
- Execute graceful shutdown: `openclaw gateway stop` (preferred) OR identify PID and terminate
- Verify port 18789 is free: `netstat -ano | findstr :18789`
- Wait 3 seconds for complete shutdown

**REAL Step 3: Update Package**
- Execute: `npm install -g openclaw@<version>`
- Wait for download and installation to complete
- Verify installation: `openclaw --version` (should show new version)

**REAL Step 4: Update Skills/Plugins**
- Run `openclaw skills update --all` (if this command exists)
- Or manually reinstall critical skills if needed
- List updated skills

**REAL Step 5: Restart Gateway (CRITICAL)**
- Start gateway in NEW PowerShell window: `cmd /c start powershell.exe -NoExit -Command "openclaw gateway start"`
- Wait 5 seconds for initialization
- Verify gateway is listening: `netstat -ano | findstr :18789`
- Test API endpoint: `curl http://localhost:18789/v1/models` or similar

**REAL Step 6: Post-update Verification**
- Confirm new version: `openclaw --version`
- Test gateway health: Check if port 18789 responds
- Verify critical skills are loaded
- Check gateway logs for any errors

**Step 7: Report Results**
Provide a complete summary:
```
🔄 OpenClaw Update Execution Report

Target Version: <version>
Previous Version: [old_version]
New Version: [new_version]
Gateway Restarted: ✅ Yes / ❌ No
Gateway Status: ✅ Running on port 18789 / ❌ Failed
Skills Updated: [count or list]

Execution Log:
[Step-by-step results with actual command outputs]

Errors (if any):
[Detailed error messages and suggested fixes]
```

**IMPORTANT SAFETY RULES:**
1. NEVER use `taskkill /F /IM node.exe` - this kills ALL node processes including the gateway
2. ALWAYS use `openclaw gateway stop` or identify the specific PID on port 18789
3. Gateway MUST restart in a NEW PowerShell window - never in the agent's session
4. If any step fails, STOP immediately and report the error - do not continue
5. The agent will be temporarily disconnected during gateway restart - this is expected

**Known Limitations:**
- The agent cannot automatically restart itself after gateway restart
- User may need to reconnect manually after the update completes
- Some skills may require manual reinstallation after major version changes

Show the complete execution log with actual command outputs and final status.

---
