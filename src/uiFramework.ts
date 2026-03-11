import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';

/**
 * UI 框架模板文件列表（相对于 template/ui_framework/ 目录）
 * 仅包含 game/ 目录下的框架文件，不包含 global_main.lua
 */
const UI_FRAMEWORK_FILES = [
    'game/init.lua',
    'game/ui/init.lua',
    'game/ui/UIManager.lua',
    'game/ui/UIConst.lua',
    'game/ui/base/init.lua',
    'game/ui/base/BasePanel.lua',
    'game/ui/base/BaseView.lua',
    'game/ui/base/BaseTips.lua',
    'game/ui/base/EventBus.lua',
];

/**
 * 获取模板文件的根目录 URI
 */
function getTemplateUri(context: vscode.ExtensionContext): vscode.Uri {
    return vscode.Uri.joinPath(context.extensionUri, 'template', 'ui_framework');
}

/**
 * 初始化 UI 框架到 global_script 目录
 * 
 * 注意：调用此函数前应已由调用方完成用户确认。
 * 此函数会 **强制覆盖** 所有同名文件。
 * 
 * @param context VS Code 扩展上下文
 * @param progress 进度报告器（可选）
 * @returns 是否成功
 */
export async function initUIFramework(
    context: vscode.ExtensionContext,
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<boolean> {
    const globalScriptUri = y3.env.globalScriptUri;
    if (!globalScriptUri) {
        y3.log.error(l10n.t("没有找到全局脚本目录，无法初始化 UI 框架"));
        return false;
    }

    const templateUri = getTemplateUri(context);

    // 检查模板目录是否存在
    if (!await y3.fs.isExists(templateUri)) {
        y3.log.error(l10n.t("UI 框架模板目录不存在"));
        return false;
    }

    progress?.report({ message: l10n.t('正在生成 UI 框架...') });

    let copiedCount = 0;

    // 逐文件复制模板（强制覆盖）
    for (const relativePath of UI_FRAMEWORK_FILES) {
        const sourceUri = vscode.Uri.joinPath(templateUri, relativePath);
        const targetUri = vscode.Uri.joinPath(globalScriptUri, relativePath);

        // 检查源文件是否存在
        if (!await y3.fs.isExists(sourceUri)) {
            y3.log.warn(l10n.t("模板文件不存在，跳过: {0}", relativePath));
            continue;
        }

        try {
            // 确保目标目录存在
            const targetDir = vscode.Uri.joinPath(targetUri, '..');
            await vscode.workspace.fs.createDirectory(targetDir);

            // 强制覆盖复制
            await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: true });
            copiedCount++;
        } catch (error) {
            y3.log.error(l10n.t("复制文件失败: {0}, 错误: {1}", relativePath, String(error)));
        }
    }

    y3.log.info(l10n.t("UI 框架生成完成: 共写入 {0} 个文件", String(copiedCount)));

    // 生成成功后提示用户需要在 global_main.lua 中引入
    if (copiedCount > 0) {
        const globalMainUri = vscode.Uri.joinPath(globalScriptUri, 'global_main.lua');
        const globalMainExists = await y3.fs.isExists(globalMainUri);

        let alreadyIncluded = false;
        if (globalMainExists) {
            try {
                const content = (await vscode.workspace.fs.readFile(globalMainUri)).toString();
                alreadyIncluded = /include\s+['"]game\.init['"]/.test(content);
            } catch {
                // 读取失败，忽略
            }
        }

        if (alreadyIncluded) {
            vscode.window.showInformationMessage(
                l10n.t('✅ UI 框架已更新（{0} 个文件）。global_main.lua 中已包含引用，无需额外操作。', String(copiedCount))
            );
        } else {
            const openFile = l10n.t('打开 global_main.lua');
            const result = await vscode.window.showInformationMessage(
                l10n.t('✅ UI 框架生成完成（{0} 个文件）。请在 global_main.lua 中添加以下代码以启用：\n\ninclude \'game.init\'', String(copiedCount)),
                { modal: true },
                openFile
            );
            if (result === openFile && globalMainExists) {
                const doc = await vscode.workspace.openTextDocument(globalMainUri);
                await vscode.window.showTextDocument(doc);
            }
        }
    }

    return copiedCount > 0;
}

/**
 * 检查 UI 框架是否已初始化
 */
export async function isUIFrameworkInitialized(): Promise<boolean> {
    const globalScriptUri = y3.env.globalScriptUri;
    if (!globalScriptUri) {
        return false;
    }

    // 检查关键文件是否存在
    const keyFiles = [
        'game/init.lua',
        'game/ui/UIManager.lua',
        'game/ui/base/BasePanel.lua',
    ];

    for (const file of keyFiles) {
        if (!await y3.fs.isExists(vscode.Uri.joinPath(globalScriptUri, file))) {
            return false;
        }
    }

    return true;
}