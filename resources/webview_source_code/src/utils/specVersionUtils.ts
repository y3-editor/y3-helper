/**
 * OpenSpec 版本相关工具函数
 * 专门用于 OpenSpec 初始化时的版本能力检测和提示
 */

import { IDE } from '../store/extension';

/**
 * Spec 初始化功能的最低 Extension 版本要求（SpecKit 和 OpenSpec 通用）
 */
const MIN_VERSIONS_SPEC_INIT = {
  VSCODE: '3.0.0-beta.6',
  JETBRAINS: '2.5.1',
} as const;

/*
 * OpenSpec 版本选择功能的最低 Extension 版本要求
 */
const MIN_VERSIONS_OPENSPEC_VERSION_SELECTION = {
  VSCODE: '3.0.0-beta.8',
  JETBRAINS: '2.5.3',
} as const;

/**
 * OpenSpec CLI 升级功能的最低 Extension 版本要求
 */
const MIN_VERSIONS_OPENSPEC_CLI_UPGRADE = {
  VSCODE: '3.0.0-beta.9',
  JETBRAINS: '2.5.4',
} as const;

/**
 * JetBrains 版本号格式正则
 */
const JETBRAINS_VERSION_REGEX = /^(\d+)-([\d.]+.*)/;

/**
 * 从 JetBrains 版本号中提取实际的扩展版本
 * @param version - JetBrains 完整版本号（格式: 兼容编号-版本号）
 * @returns 提取的版本号，提取失败返回 null
 */
function extractJetBrainsVersion(version: string): string | null {
  const match = version.match(JETBRAINS_VERSION_REGEX);
  return match ? match[2] : null;
}

/**
 * 通用版本检查函数
 *
 * @param codeMakerVersion - Extension 版本号
 * @param ide - IDE 类型
 * @param minVersions - 最低版本要求配置
 * @returns 是否满足最低版本要求
 */
function checkVersionSupport(
  codeMakerVersion: string | null,
  ide: string | null,
  minVersions: { VSCODE: string; JETBRAINS: string }
): boolean {
  if (!codeMakerVersion || !ide) return false;

  if (ide === IDE.VisualStudioCode) {
    return compareVersion(codeMakerVersion, minVersions.VSCODE) >= 0;
  }

  if (ide === IDE.JetBrains) {
    const extensionVersion = extractJetBrainsVersion(codeMakerVersion);
    if (!extensionVersion) return false;
    return compareVersion(extensionVersion, minVersions.JETBRAINS) >= 0;
  }

  return false;
}

/**
 * 检查当前 Extension 版本是否支持 Spec 初始化功能（SpecKit 和 OpenSpec 通用）
 */
export const supportsSpecInit = (codeMakerVersion: string | null, ide: string | null) =>
  checkVersionSupport(codeMakerVersion, ide, MIN_VERSIONS_SPEC_INIT);

/**
 * 检查当前 Extension 版本是否支持 OpenSpec 版本选择功能
 */
export const supportsOpenSpecVersionSelection = (codeMakerVersion: string | null, ide: string | null) =>
  checkVersionSupport(codeMakerVersion, ide, MIN_VERSIONS_OPENSPEC_VERSION_SELECTION);

/**
 * 检查当前 Extension 版本是否支持 OpenSpec CLI 升级功能
 */
export const supportsOpenSpecCliUpgrade = (codeMakerVersion: string | null, ide: string | null) =>
  checkVersionSupport(codeMakerVersion, ide, MIN_VERSIONS_OPENSPEC_CLI_UPGRADE);

/**
 * 获取 Spec 初始化功能的最低版本提示文本（SpecKit 和 OpenSpec 通用）
 *
 * @param ide - IDE 类型
 * @returns 升级提示文本
 */
export function getSpecInitMinVersionHint(ide: string | null): string {
  if (ide === IDE.VisualStudioCode || ide === 'Visual Studio Code') {
    return `需要 CodeMaker Extension ${MIN_VERSIONS_SPEC_INIT.VSCODE} 或更高版本`;
  }
  if (ide === IDE.JetBrains) {
    return `需要 CodeMaker Plugin ${MIN_VERSIONS_SPEC_INIT.JETBRAINS} 或更高版本`;
  }
  return '需要更新 CodeMaker 版本';
}


/**
 * 比较两个版本号
 * 提取所有数字按顺序比较，忽略其他字符
 *
 * @param v1 - 版本号1
 * @param v2 - 版本号2
 * @returns 负数: v1 < v2, 0: v1 = v2, 正数: v1 > v2
 *
 * @example
 * compareVersion('3.0.0', '2.5.1') // 正数
 * compareVersion('3.0.0-beta.6', '3.0.0-beta.5') // 正数
 * compareVersion('3.0.0-beta-test.7', '3.0.0-beta.5') // 正数
 * compareVersion('3.0.0-test-review.3', '3.0.0-beta.5') // 负数
 */
export function compareVersion(v1: string, v2: string): number {
  // 提取所有数字
  const nums1 = (v1.match(/\d+/g) || []).map(Number);
  const nums2 = (v2.match(/\d+/g) || []).map(Number);
  const len = Math.max(nums1.length, nums2.length);

  for (let i = 0; i < len; i++) {
    const n1 = nums1[i] || 0;
    const n2 = nums2[i] || 0;
    if (n1 !== n2) {
      return n1 - n2;
    }
  }
  return 0;
}