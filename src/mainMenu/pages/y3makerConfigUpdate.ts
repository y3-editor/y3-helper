import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { TreeNode } from '../treeNode';
import { getCachedUpdateStatus } from '../../y3makerConfig';

export class Y3MakerConfigUpdate extends TreeNode {
    constructor() {
        super(l10n.t('Y3Maker 配置需要更新！'), {
            iconPath: new vscode.ThemeIcon('cloud-download'),
            command: {
                command: 'y3-helper.updateY3MakerConfig',
                title: l10n.t('更新 Y3Maker 配置'),
            },
            update: async (node) => {
                const status = getCachedUpdateStatus();
                if (status && status.hasUpdate) {
                    const localShort = status.localHash.substring(0, 7);
                    const remoteShort = status.remoteHash.substring(0, 7);
                    node.description = `${localShort} → ${remoteShort}`;
                    node.tooltip = l10n.t('点击更新 Y3Maker 配置到最新版本');
                }
            },
            show: async () => {
                const status = getCachedUpdateStatus();
                return status !== null && status.hasUpdate;
            },
        });
    }
}
