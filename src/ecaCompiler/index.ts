import { Compiler } from './compiler';
import { Formatter } from './formatter';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

function testConfig(formatter: Formatter) {
    formatter.setValueRule(100006, 'y3.unit.get_by_res_id({})');

    formatter.setCallRule('UNIT_ENTITY_POINT', '{}:get_point()');
    formatter.setCallRule('ALL_PLAYER', 'y3.player_group.get_all_players()');
    formatter.setCallRule('CREATE_HARM_TEXT_NEW', 'y3.ui.create_floating_text2({point}, {type}, {str}, {jump_word_track}, {player_group})', ['point', 'type', 'str', 'player_group', 'jump_word_track']);
}

export function init() {
    const formatter = new Formatter();

    testConfig(formatter);

    vscode.commands.registerCommand('y3-helper.compileECA', async () => {
        if (!y3.env.scriptUri) {
            vscode.window.showErrorMessage('请先打开地图');
            return;
        }
        let outTriggerDir = y3.uri(y3.env.scriptUri, 'y3-trigger');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '编译中...',
            cancellable: true,
        }, async (progress, token) => {
            progress.report({
                message: '正在搜索触发器文件...',
            });
            let compiler = new Compiler();
            let inTriggerDir = y3.uri(y3.env.mapUri!, 'global_trigger/trigger');
            let scanResult = await y3.fs.scan(inTriggerDir, undefined, () => {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
            });
            let fileNames = scanResult
                . filter((file) => file[1] === vscode.FileType.File && file[0].endsWith('.json'))
                . map((file) => file[0]);
                
            if (fileNames.length === 0) {
                return;
            }
            for (let i = 0; i < fileNames.length; i++) {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
                progress.report({
                    message: `正在编译触发器文件(${i}/${fileNames.length})...`,
                });

                let inUri = y3.uri(inTriggerDir, fileNames[i]);
                let outUri = y3.uri(outTriggerDir, fileNames[i].replace('.json', '.lua'));
                let eca = await compiler.compile(inUri);
                let content = eca.make(formatter);
                await y3.fs.writeFile(outUri, content);
            }
        });
        vscode.window.showInformationMessage('编译完成');
    });
}
