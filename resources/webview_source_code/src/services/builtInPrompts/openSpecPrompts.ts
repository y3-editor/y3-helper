import { BuiltInPrompt } from ".";

export const OPEN_SPEC_APPLY_PROMPT: BuiltInPrompt = {
  name: 'openspec-apply',
  description: '实现已批准的 OpenSpec 变更并保持任务同步',
  prompt: `<!-- OPENSPEC:START -->
**Guardrails**
- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Refer to \`openspec/AGENTS.md\` (located inside the \`openspec/\` directory—run \`ls openspec\` or \`openspec update\` if you don't see it) if you need additional OpenSpec conventions or clarifications.

**Steps**
Track these steps as TODOs and complete them one by one.
1. Read \`changes/<id>/proposal.md\`, \`design.md\` (if present), and \`tasks.md\` to confirm scope and acceptance criteria.
2. Work through tasks sequentially, keeping edits minimal and focused on the requested change.
3. Confirm completion before updating statuses—make sure every item in \`tasks.md\` is finished.
4. Update the checklist after all work is done so each task is marked \`- [x]\` and reflects reality.
5. Reference \`openspec list\` or \`openspec show <item>\` when additional context is required.

**Reference**
- Use \`openspec show <id> --json --deltas-only\` if you need additional context from the proposal while implementing.
<!-- OPENSPEC:END -->
`,
};

export const OPEN_SPEC_ARCHIVE_PROMPT: BuiltInPrompt = {
  name: 'openspec-archive',
  description: '归档已部署的 OpenSpec 变更并更新规范',
  prompt: `<!-- OPENSPEC:START -->
**Guardrails**
- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Refer to \`openspec/AGENTS.md\` (located inside the \`openspec/\` directory—run \`ls openspec\` or \`openspec update\` if you don't see it) if you need additional OpenSpec conventions or clarifications.

**Steps**
1. Determine the change ID to archive:
   - If this prompt already includes a specific change ID (for example inside a \`<ChangeId>\` block populated by slash-command arguments), use that value after trimming whitespace.
   - If the conversation references a change loosely (for example by title or summary), run \`openspec list\` to surface likely IDs, share the relevant candidates, and confirm which one the user intends.
   - Otherwise, review the conversation, run \`openspec list\`, and ask the user which change to archive; wait for a confirmed change ID before proceeding.
   - If you still cannot identify a single change ID, stop and tell the user you cannot archive anything yet.
2. Validate the change ID by running \`openspec list\` (or \`openspec show <id>\`) and stop if the change is missing, already archived, or otherwise not ready to archive.
3. Run \`openspec archive <id> --yes\` so the CLI moves the change and applies spec updates without prompts (use \`--skip-specs\` only for tooling-only work).
4. Review the command output to confirm the target specs were updated and the change landed in \`changes/archive/\`.
5. Validate with \`openspec validate --strict\` and inspect with \`openspec show <id>\` if anything looks off.

**Reference**
- Use \`openspec list\` to confirm change IDs before archiving.
- Inspect refreshed specs with \`openspec list --specs\` and address any validation issues before handing off.
<!-- OPENSPEC:END -->
`,
};

export const OPEN_SPEC_PROPOSAL_PROMPT: BuiltInPrompt = {
  name: 'openspec-proposal',
  description: '创建新的 OpenSpec 变更并严格验证',
  prompt: `<!-- OPENSPEC:START -->
**Guardrails**
- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Refer to \`openspec/AGENTS.md\` (located inside the \`openspec/\` directory—run \`ls openspec\` or \`openspec update\` if you don't see it) if you need additional OpenSpec conventions or clarifications.
- Identify any vague or ambiguous details and ask the necessary follow-up questions before editing files.
- Do not write any code during the proposal stage. Only create design documents (proposal.md, tasks.md, design.md, and spec deltas). Implementation happens in the apply stage after approval.

**Steps**
1. Review \`openspec/project.md\`, run \`openspec list\` and \`openspec list --specs\`, and inspect related code or docs (e.g., via \`rg\`/\`ls\`) to ground the proposal in current behaviour; note any gaps that require clarification.
2. Choose a unique verb-led \`change-id\` and scaffold \`proposal.md\`, \`tasks.md\`, and \`design.md\` (when needed) under \`openspec/changes/<id>/\`.
3. Map the change into concrete capabilities or requirements, breaking multi-scope efforts into distinct spec deltas with clear relationships and sequencing.
4. Capture architectural reasoning in \`design.md\` when the solution spans multiple systems, introduces new patterns, or demands trade-off discussion before committing to specs.
5. Draft spec deltas in \`changes/<id>/specs/<capability>/spec.md\` (one folder per capability) using \`## ADDED|MODIFIED|REMOVED Requirements\` with at least one \`#### Scenario:\` per requirement and cross-reference related capabilities when relevant.
6. Draft \`tasks.md\` as an ordered list of small, verifiable work items that deliver user-visible progress, include validation (tests, tooling), and highlight dependencies or parallelizable work.
7. Validate with \`openspec validate <id> --strict\` and resolve every issue before sharing the proposal.

**Reference**
- Use \`openspec show <id> --json --deltas-only\` or \`openspec show <spec> --type spec\` to inspect details when validation fails.
- Search existing requirements with \`rg -n "Requirement:|Scenario:" openspec/specs\` before writing new ones.
- Explore the codebase with \`rg <keyword>\`, \`ls\`, or direct file reads so proposals align with current implementation realities.
<!-- OPENSPEC:END -->
`,
};

export const OPEN_SPEC_UPGDATE_PROMPT: BuiltInPrompt = {
  name: 'openspec-update',
  description: '将openspec 升级为1.x版本，[点击查看详细测评](https://km.netease.com/v4/detail/blog/258353)',
  prompt: `Upgrade OpenSpec from version 0.23 to 1.x.

This skill helps users migrate from the legacy OpenSpec 0.23 to the new 1.x version with its enhanced workflow capabilities (11 commands instead of 3).

**What this upgrade does:**
1. Upgrades the CLI from 0.23 to 1.x
2. Migrates the document structure (removes AGENTS.md, etc.)

---

## Steps

### Step 1: Pre-flight Check

Output: "## 步骤 1: 检测版本"

Check if the project is using OpenSpec 0.23:

\`\`\`bash
ls openspec/AGENTS.md 2>/dev/null && echo "VERSION_023" || echo "NOT_023"
\`\`\`

**If \`NOT_023\`:**
- Check if \`openspec/\` directory exists at all
- If no openspec directory: "OpenSpec 未初始化。请在侧边栏使用初始化功能来设置 OpenSpec 1.x。"
- If openspec exists but no AGENTS.md: "此项目已经在使用 OpenSpec 1.x，无需升级！"
- STOP

**If \`VERSION_023\`:**
- Output: "检测到 OpenSpec 0.23，开始升级..."
- Continue to Step 2

### Step 2: Upgrade CLI

Output: "## 步骤 2: 升级 CLI"
Output: "正在安装 OpenSpec 1.x..."

Run:
\`\`\`bash
npm install -g @fission-ai/openspec@^1
\`\`\`

Then verify:
\`\`\`bash
openspec --version
\`\`\`

**If installation fails:**
- Output error message
- Suggest: "请尝试手动运行 \`npm install -g @fission-ai/openspec@^1\` 并检查权限问题。"
- STOP

**If success:**
- Output: "CLI 已升级到 [version]"
- Continue to Step 3

**IMPORTANT: Do NOT output "步骤 2" header again after verification. Only one header per step.**

### Step 3: Migrate Document Structure

Output: "## 步骤 3: 迁移文档结构"
Output: "正在迁移文档..."

Run:
\`\`\`bash
openspec update --force
\`\`\`

This command:
- Removes \`openspec/AGENTS.md\` (legacy file)
- Cleans up OpenSpec markers from root \`AGENTS.md\` if present
- Preserves \`openspec/project.md\` for manual review

**If success:**
- Output: "文档结构迁移完成"
- Continue to final summary

### Step 4: Final Summary

Output the final summary (in Chinese):

\`\`\`
## 升级完成

**OpenSpec 已从 0.23 升级到 1.x**

### 已完成:
- CLI 已升级到 [version]
- 文档结构已迁移
- 新的 OPSX 命令已可用

### 新命令:
| 命令 | 说明 |
|------|------|
| \`/opsx:new\` | 创建新变更 |
| \`/opsx:ff\` | 快速创建所有工件 |
| \`/opsx:continue\` | 继续处理变更 |
| \`/opsx:apply\` | 实现任务 |
| \`/opsx:explore\` | 探索模式 |
| \`/opsx:verify\` | 验证实现 |
| \`/opsx:archive\` | 归档变更 |
| \`/opsx:sync\` | 同步规范 |
| \`/opsx:bulk-archive\` | 批量归档 |
| \`/opsx:onboard\` | 引导教程 |

### 待处理:
如果存在 \`openspec/project.md\`，请将有用内容迁移到 \`openspec/config.yaml\` 的 \`context:\` 部分，然后删除该文件。

### 下一步:
尝试使用 \`/opsx:new\` 来创建您的第一个使用新工作流程的变更！

### 注意:
如果命令面板中没有显示新命令，请重启 IDE 或重新打开项目。
\`\`\`

---

## Output Guidelines

**IMPORTANT:**
- Each step header (步骤 1, 步骤 2, 步骤 3) should appear ONLY ONCE
- Do NOT repeat the same step header after running commands
- Explain what each step does BEFORE running commands
- Show results AFTER commands complete
- Do NOT mention "file watcher" or any internal implementation details
- Tell user to restart IDE to see new commands

---

## Guardrails
- Always check for 0.23 version before upgrading
- Do not proceed if already on 1.x
- Use \`--force\` flag to ensure non-interactive migration`,
};