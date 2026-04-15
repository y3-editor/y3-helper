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
