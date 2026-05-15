import _ from 'lodash';

interface CodebaseQualityIssueAutofixData {
  sourceModule: string;
  issueDescription: string;
  filePath: string;
  lineNumber: number;
  language: string;
  project: string;
  codeScanExtra: {
    issueIds: string[];
    issueData: any;
  };
  teamReviewExtra: {
    issueData: any;
    reviewRequestData: any;
  };
  codeContext?: {
    beforeLines: string;
    issueLines: string;
    afterLines: string;
  };
}

/**
 * 生成代码质量问题修复的 Prompt
 * @param data 代码质量问题数据
 * @returns 格式化的修复 Prompt
 */
export function generateCodeQualityFixPrompt(
  data: CodebaseQualityIssueAutofixData,
): string {
  const {
    sourceModule,
    issueDescription,
    filePath,
    lineNumber,
    language,
    codeScanExtra,
    teamReviewExtra,
    codeContext,
  } = data;

  // 构建基础 Prompt
  let prompt = `你是一位资深的代码调试专家。

我遇到了一个代码问题，请根据以下诊断信息和相关代码，定位问题并直接修复此问题。

## 诊断信息

- **问题描述**: ${issueDescription}`;

  if (sourceModule === 'CodeScan') {
    const severity = _.get(codeScanExtra, 'issueData.severity', 0);
    if (severity) {
      prompt += `
- **严重程度**: ${severity}`;
    }

    const issueType = _.get(codeScanExtra, 'issueData.type', '');
    if (issueType) {
      prompt += `
- **问题类型**: ${issueType}`;
    }

    const ruleKey = _.get(codeScanExtra, 'issueData.ruleKey', '');
    if (ruleKey && !ruleKey.startsWith('custom')) {
      prompt += `
- **扫描规则**: ${ruleKey}`;
    }
  } else if (sourceModule === 'TeamReview') {
    const issueData = _.get(teamReviewExtra, 'issueData', {});
    const type = _.get(issueData, 'issue_type', '');
    if (type) {
      prompt += `
- **问题类型**: ${type}`;
    }

    const severity = _.get(issueData, 'severity', '');
    if (severity) {
      prompt += `
- **严重程度**: ${severity}`;
    }
  }

  prompt += `

## 相关代码

- **文件名**: \`${filePath}\``;

  if (lineNumber) {
    prompt += `
- **问题位置**: 第 ${lineNumber} 行附近`;
  }

  if (language && codeContext?.issueLines) {
    prompt += `
- **问题代码**:
\`\`\`${language}
${codeContext.issueLines}
\`\`\``;
  }

  // 添加代码上下文快照
  if (codeContext && codeContext.issueLines) {
    const codeLanguage = language || 'plaintext';

    let codeBlock = '';

    // 如果有前置代码，添加前置代码
    if (codeContext.beforeLines && codeContext.beforeLines.trim()) {
      codeBlock += codeContext.beforeLines;
      if (!codeBlock.endsWith('\n')) {
        codeBlock += '\n';
      }
    }

    // 添加问题代码
    codeBlock += codeContext.issueLines;
    if (!codeBlock.endsWith('\n')) {
      codeBlock += '\n';
    }

    // 如果有后置代码，添加后置代码
    if (codeContext.afterLines && codeContext.afterLines.trim()) {
      codeBlock += codeContext.afterLines;
    }

    prompt += `

**代码上下文快照**:
\`\`\`${codeLanguage}
${codeBlock.trim()}
\`\`\``;
  }

  // 添加修复要求
  prompt += `

## 修复要求

请仔细分析上述代码问题，并提供具体的修复建议：
1. 简洁清晰地说明问题的根本原因
2. 自动修复问题，并返回修复后的代码。如果无法自动修复，请简述原因，并提供修复方案
3. 修复完成后检查修复结果，确保修复后的代码没有问题

开始分析并修复这个问题。`;

  return prompt;
}

/**
 * 生成代码质量问题修复的上下文信息（不带 prompt 指令，仅作为 codeBlock 注入）
 */
export function generateCodeQualityContext(
  data: CodebaseQualityIssueAutofixData,
): string {
  const {
    sourceModule,
    issueDescription,
    filePath,
    lineNumber,
    language,
    codeScanExtra,
    teamReviewExtra,
    codeContext,
  } = data;

  let prompt = `### 问题描述\n\n${issueDescription}`;

  let additionalInfo = '';
  if (sourceModule === 'CodeScan') {
    const severity = _.get(codeScanExtra, 'issueData.severity', 0);
    if (severity) additionalInfo += `\n- **严重程度**: ${severity}`;
    const issueType = _.get(codeScanExtra, 'issueData.type', '');
    if (issueType) additionalInfo += `\n- **问题类型**: ${issueType}`;
    const ruleKey = _.get(codeScanExtra, 'issueData.ruleKey', '');
    if (ruleKey && !ruleKey.startsWith('custom')) {
      additionalInfo += `\n- **扫描规则**: ${ruleKey}`;
    }
  } else if (sourceModule === 'TeamReview') {
    const issueData = _.get(teamReviewExtra, 'issueData', {});
    const type = _.get(issueData, 'issue_type', '');
    if (type) additionalInfo += `\n- **问题类型**: ${type}`;
    const severity = _.get(issueData, 'severity', '');
    if (severity) additionalInfo += `\n- **严重程度**: ${severity}`;
  }

  if (additionalInfo) prompt += `\n### 附加信息\n${additionalInfo}`;

  prompt += `\n\n### 问题位置\n\n- **文件名**: \`${filePath}\``;
  if (lineNumber) prompt += `\n- **问题位置**: 第 ${lineNumber} 行附近`;

  if (language && codeContext?.issueLines) {
    prompt += `\n### 问题代码\n\n\`\`\`${language}\n${codeContext.issueLines}\n\`\`\``;
  }

  if (codeContext && codeContext.issueLines) {
    const codeLanguage = language || 'plaintext';
    let codeBlock = '';
    if (codeContext.beforeLines && codeContext.beforeLines.trim()) {
      codeBlock += codeContext.beforeLines;
      if (!codeBlock.endsWith('\n')) codeBlock += '\n';
    }
    codeBlock += codeContext.issueLines;
    if (!codeBlock.endsWith('\n')) codeBlock += '\n';
    if (codeContext.afterLines && codeContext.afterLines.trim()) {
      codeBlock += codeContext.afterLines;
    }
    prompt += `\n\n### 代码上下文快照\n\n\`\`\`${codeLanguage}\n${codeBlock.trim()}\n\`\`\``;
  }

  return prompt;
}

/**
 * 批量生成代码质量问题修复的上下文信息
 */
export function generateBatchCodeQualityContext(
  items: CodebaseQualityIssueAutofixData[],
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return generateCodeQualityContext(items[0]);

  const grouped = _.groupBy(items, 'filePath');
  const sections: string[] = [];
  let globalIdx = 0;

  for (const [filePath, issues] of Object.entries(grouped)) {
    const language = issues[0]?.language || 'plaintext';
    let section = `### 文件: \`${filePath}\`\n`;
    issues.forEach((issue) => {
      globalIdx++;
      section += `\n#### 问题 ${globalIdx}`;
      if (issue.lineNumber) section += `（第 ${issue.lineNumber} 行附近）`;
      section += `\n\n${issue.issueDescription}`;
      if (issue.codeContext?.issueLines) {
        section += `\n\n**问题代码：**\n\`\`\`${language}\n${issue.codeContext.issueLines}\n\`\`\``;
      }
    });

    // 合并同文件的代码上下文区间，避免重复展示
    const mergedContext = mergeCodeContexts(issues, language);
    if (mergedContext) {
      section += `\n\n#### 相关代码上下文\n\n\`\`\`${language}\n${mergedContext}\n\`\`\``;
    }

    sections.push(section);
  }

  return sections.join('\n\n---\n\n');
}

/**
 * 合并同文件多个问题的代码上下文
 * 如果行号相近（区间有重叠），合并为一个连续的代码块
 */
function mergeCodeContexts(
  issues: CodebaseQualityIssueAutofixData[],
  _language: string,
): string {
  const issuesWithContext = issues
    .filter((i) => i.lineNumber && i.codeContext)
    .sort((a, b) => a.lineNumber - b.lineNumber);

  if (issuesWithContext.length === 0) return '';

  const ranges: { start: number; end: number; ctx: NonNullable<CodebaseQualityIssueAutofixData['codeContext']> }[] = [];

  for (const issue of issuesWithContext) {
    const ctx = issue.codeContext!;
    const beforeCount = ctx.beforeLines ? ctx.beforeLines.split('\n').length : 0;
    const issueCount = ctx.issueLines ? ctx.issueLines.split('\n').length : 0;
    const afterCount = ctx.afterLines ? ctx.afterLines.split('\n').length : 0;
    const start = issue.lineNumber - beforeCount;
    const end = issue.lineNumber + issueCount - 1 + afterCount;

    const last = ranges.length > 0 ? ranges[ranges.length - 1] : null;
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
      if (end > last.end) {
        last.ctx = ctx;
      }
    } else {
      ranges.push({ start, end, ctx });
    }
  }

  if (ranges.length === 1) {
    const ctx = issuesWithContext[0].codeContext!;
    const parts: string[] = [];
    if (ctx.beforeLines?.trim()) parts.push(ctx.beforeLines);
    if (ctx.issueLines) parts.push(ctx.issueLines);
    if (ctx.afterLines?.trim()) parts.push(ctx.afterLines);

    if (issuesWithContext.length > 1) {
      const first = issuesWithContext[0];
      const last = issuesWithContext[issuesWithContext.length - 1];
      const firstCtx = first.codeContext!;
      const lastCtx = last.codeContext!;
      const merged: string[] = [];
      if (firstCtx.beforeLines?.trim()) merged.push(firstCtx.beforeLines);
      if (firstCtx.issueLines) merged.push(firstCtx.issueLines);
      if (firstCtx.afterLines?.trim()) merged.push(firstCtx.afterLines);
      if (lastCtx.afterLines?.trim() && last.lineNumber > first.lineNumber) {
        const lastEnd = lastCtx.afterLines;
        if (!merged.join('\n').includes(lastEnd)) {
          merged.push(lastEnd);
        }
      }
      return merged.join('\n').trim();
    }
    return parts.join('\n').trim();
  }

  const blocks: string[] = [];
  for (const range of ranges) {
    const matchingIssue = issuesWithContext.find(
      (i) => i.lineNumber >= range.start && i.lineNumber <= range.end,
    );
    if (matchingIssue?.codeContext) {
      const ctx = matchingIssue.codeContext;
      const parts: string[] = [];
      if (ctx.beforeLines?.trim()) parts.push(ctx.beforeLines);
      if (ctx.issueLines) parts.push(ctx.issueLines);
      if (ctx.afterLines?.trim()) parts.push(ctx.afterLines);
      blocks.push(parts.join('\n').trim());
    }
  }

  return blocks.join('\n\n// ...\n\n');
}
