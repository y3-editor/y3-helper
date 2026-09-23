import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { TreeNode } from '../treeNode';
import { env } from '../../env';
import { getCloneY3MakerPreference, getY3MakerDirState } from '../../y3makerConfig';

/**
 * `.y3maker` 还需要用户动手时的手动入口：
 * - partial：目录存在但没纳入 git 管理，需要用户选“合并 / 备份并替换”
 * - missing：目录不存在且后台不会自动 clone（偏好不是 always）
 * 偏好为 always 且目录只是缺失时，后台会自动补上，所以那种情况不显示。
 */
export class Y3MakerConfigInit extends TreeNode {
    constructor() {
        super(l10n.t('Y3Maker 配置未初始化（点击拉取）'), {
            iconPath: new vscode.ThemeIcon('cloud-download'),
            command: {
                command: 'y3-helper.cloneY3MakerConfig',
                title: l10n.t('拉取 Y3Maker 配置'),
            },
            update: async (node) => {
                const projectUri = env.projectUri;
                if (!projectUri) {
                    return;
                }
                if (await getY3MakerDirState(projectUri) === 'partial') {
                    node.label = l10n.t('Y3Maker 配置待处理（点击）');
                    node.tooltip = l10n.t('点击可选合并或备份并替换');
                } else {
                    node.label = l10n.t('Y3Maker 配置未初始化（点击拉取）');
                    node.tooltip = l10n.t('点击把 Y3Maker 配置拉到项目里');
                }
            },
            show: async () => {
                const projectUri = env.projectUri;
                const y3Uri = env.y3RepoUri;
                if (!projectUri || !y3Uri) {
                    return false;
                }
                // 只有初始化过 Y3 库的项目才提示，避免对新建项目误显示
                try {
                    if ((await vscode.workspace.fs.stat(vscode.Uri.joinPath(y3Uri, '.git'))).type !== vscode.FileType.Directory) {
                        return false;
                    }
                } catch {
                    return false;
                }

                const state = await getY3MakerDirState(projectUri);
                // partial 需要用户决策，所以任何偏好下都要露出入口
                if (state === 'partial') {
                    return true;
                }
                // 目录只是缺失时，偏好为 always 的用户由后台自动补上，不需要这个节点
                return state === 'missing' && getCloneY3MakerPreference() !== 'always';
            },
        });
    }
}
