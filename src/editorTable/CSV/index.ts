import * as vscode from 'vscode';
import { env } from '../../env';
import { CSVeditor, CSVimporter, searchAllEditorTableItemInCSV, searchAllEditorTableItemInProject } from '..';
import { Table } from '../../constants';
import { TemplateGenerator } from './templateGenerator';

/**
 * 注册CSVeditor相关的命令
 */
function registerCommandOfCSVeditor() {
    // 在CSV表格中添加物编项目的命令
    let addNewDataInCSVcommand = vscode.commands.registerCommand('y3-helper.addNewDataInCSV', async () => {
        await env.mapReady(true);
        const editorTableTypes: vscode.QuickPickItem[] = [
            { label: '单位', description: 'unit' },
            { label: '装饰物', description: 'decoration' },
            { label: '物品', description: 'item' },
            { label: '技能', description: 'ability' },
            { label: '魔法效果', description: 'modifier' },
            { label: '投射物', description: 'projectile' },
            { label: '科技', description: 'technology' },
            { label: '可破坏物', description: 'destructible' },
            { label: '声音', description: 'sound' }
        ];
        vscode.window.showQuickPick(editorTableTypes, {
            placeHolder: '选择你要添加的物编数据类型(CSV)'
        }).then(selection => {
            
            if (!selection || !selection.description) {
                vscode.window.showInformationMessage('未选择');
                return;
                
            }
            else {
                vscode.window.showInformationMessage(`你选择了: ${selection.label}`);
            }
            
            const inputOptions: vscode.InputBoxOptions = {
                prompt: '名称',
                placeHolder: '字符串',
                validateInput: (text: string) => {
                    if (text.length === 0) {
                        return "输入的内容为空";
                    }
                    return null;
                }
            };
            
            vscode.window.showInputBox(inputOptions).then(value => {
                if (value) {
                    let csvEditor: CSVeditor = new CSVeditor();
                    if (!selection.description) {
                        vscode.window.showInformationMessage('未选择');
                        return;
                    }
                    csvEditor.addNewUIDandNameInCSVwithoutConflict(selection.description as Table.NameEN, value);
                }
            });
        });
    });

    // 把Y3工程项目中已有的物编数据的UID和名称添加到CSV表格以便填写和导入的命令
    let addUIDandNameToCSVfromProjectCommand = vscode.commands.registerCommand("y3-helper.addUIDandNameToCSVfromProject", async () => {
        await env.mapReady(true);
        const inputOptions: vscode.InputBoxOptions = {
            prompt: '搜索项目中已有的物编数据项目UID或名称或类型名',
            placeHolder: 'UID或名称或类型名',
            validateInput: (text: string) => {
                if (text.length === 0) {
                    return "输入的内容为空";
                }
                return null;
            }
        };

        vscode.window.showInputBox(inputOptions).then(value => {
            if (value) {

                let csvEditor: CSVeditor = new CSVeditor();
                let pickItems: vscode.QuickPickItem[] = searchAllEditorTableItemInProject(value);
                vscode.window.showQuickPick(pickItems, {
                    placeHolder: '选择你要添加的物编数据项目'
                }).then((selectedItem) => {
                    if (selectedItem) {
                        vscode.window.showInformationMessage(`你选择了: ${selectedItem.label}`);

                        csvEditor.addEditorTableItemFromProject(selectedItem);
                    }
                });
            }
        });

    });

    // 修改CSV表格中的物编项目的的名称的命令
    let modifyNameInCSVCommand = vscode.commands.registerCommand("y3-helper.modifyNameInCSV", async () => {
        await env.mapReady(true);
        const inputOptions: vscode.InputBoxOptions = {
            prompt: '搜索CSV表格中已有的物编数据项目',
            placeHolder: 'UID或名称或类型名',
            validateInput: (text: string) => {
                if (text.length === 0) {
                    return "输入的内容为空";
                }
                return null;
            }
        };


        // 查询要改的项目
        vscode.window.showInputBox(inputOptions).then(async(value) => {
            if (value) {

                // 列出查到的项目
                let pickItems: vscode.QuickPickItem[] = await searchAllEditorTableItemInCSV(value);
                vscode.window.showQuickPick(pickItems, {
                    placeHolder: '选择你要修改的物编数据项目'
                }).then((selectedItem) => {
                    if (selectedItem) {
                        vscode.window.showInformationMessage(`你选择了: ${selectedItem.label}`);
                        const newNameInputOptions: vscode.InputBoxOptions = {
                            prompt: '新名称',
                            placeHolder: '请输入新名称',
                            validateInput: (text: string) => {
                                if (text.length === 0) {
                                    return "输入的内容为空";
                                }
                                return null;
                            }
                        };
                        // 输入修改后的内容
                        vscode.window.showInputBox(newNameInputOptions).then(value => {
                            if (value && selectedItem.detail) {

                                let csvEditor: CSVeditor = new CSVeditor();

                                // detail里面装了uid
                                csvEditor.modifyName(Number(selectedItem.detail), value);
                                vscode.window.showInformationMessage(`${selectedItem.label} 被修改为: ${value}`);
                            }
                        });
                    }
                });
            }
        });
    });


    // 修改CSV表格中的物编项目的的uid的命令
    let modifyUIDInCSVCommand = vscode.commands.registerCommand("y3-helper.modifyUIDinCSV", async () => {
        await env.mapReady(true);
        const inputOptions: vscode.InputBoxOptions = {
            prompt: '搜索并选择CSV表格中已有的物编数据项目',
            placeHolder: 'UID或名称或类型名',
            validateInput: (text: string) => {
                if (text.length === 0) {
                    return "输入的内容为空";
                }
                return null;
            }
        };


        // 查询要改的项目
        vscode.window.showInputBox(inputOptions).then(async (value) => {
            if (value) {

                // 列出查到的项目
                let pickItems: vscode.QuickPickItem[] = await searchAllEditorTableItemInCSV(value);
                vscode.window.showQuickPick(pickItems, {
                    placeHolder: '选择你要修改的物编数据项目'
                }).then((selectedItem) => {
                    if (selectedItem) {
                        vscode.window.showInformationMessage(`你选择了: ${selectedItem.label}`);
                        const newUIDinputOptions: vscode.InputBoxOptions = {
                            prompt: '新UID',
                            placeHolder: '请输入新UID',
                            validateInput: (text: string) => {
                                if (text.length === 0) {
                                    return "输入的内容为空";
                                }
                                if (isNaN(Number(text))) {
                                    return "输入的内容不是数字UID";
                                }
                                if (!Number.isInteger(Number(text))) {
                                    return "输入的内容不是整数";
                                }
                                if (text.length !== 9){
                                    return "输入的内容必须为9位整数";
                                }
                                return null;
                            }
                        };
                        // 输入修改后的内容
                        vscode.window.showInputBox(newUIDinputOptions).then(value => {
                            if (value && selectedItem.detail) {

                                let csvEditor: CSVeditor = new CSVeditor();

                                // detail里面装了uid
                                csvEditor.modifyUID(Number(selectedItem.detail),Number(value));
                                vscode.window.showInformationMessage(`${selectedItem.label} 被修改为: ${value}`);
                            }
                        });
                    }
                });
            }
        });

    });
}

/**
 * 根据用户配置的路径 导入全部物编数据(CSV)
 */
function registerCommandOfImportEditorTableDataFromCSV() {
    vscode.commands.registerCommand('y3-helper.importEditorTableDataFromCSV', async () => {
        await env.mapReady(true);
        let projectUri = env.projectUri;
        let editorExeUri = env.editorExeUri;
        let scriptUri= env.scriptUri;
        if (!projectUri) {
            vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
            return false;
        }
        
        if (!scriptUri) {
            vscode.window.showErrorMessage("scriptUri不存在");
            return false;
        }
        await vscode.window.withProgress({
            title: '正在导入...',
            location: vscode.ProgressLocation.Window,
        }, async (progress) => {
            let csvImporter = new CSVimporter();
            await csvImporter.importCSVFromOrderFolder();

        });
    });
}

function registerCommandOfGenerateTemplates() {
    let templateGenerator = new TemplateGenerator();

    // 生成CSV
    vscode.commands.registerCommand('y3-helper.generateAllTemplateCSV', async () => {
        await env.mapReady(true);
        let projectUri = env.projectUri;
        if (!projectUri) {
            vscode.window.showErrorMessage("没有打开工作目录！，请先初始化");
            return false;
        }
        if (!env.csvTableUri) {
            vscode.window.showErrorMessage("未找到合适的位置生成CSV");
            return false;
        }
        let targetUri: vscode.Uri = env.csvTableUri;
        await templateGenerator.generateAllTemplateCSVtoTargetPath(targetUri);
    });
}

export function init() {
    registerCommandOfImportEditorTableDataFromCSV();
    registerCommandOfCSVeditor();
    registerCommandOfGenerateTemplates();
}
