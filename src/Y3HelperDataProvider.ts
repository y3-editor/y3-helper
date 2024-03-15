import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Env } from './env';
import { isPathValid, isJson } from './utility';
import { encode } from 'punycode';



export class Y3HelperDataProvider implements vscode.TreeDataProvider<FileNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined> = new vscode.EventEmitter<FileNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined> = this._onDidChangeTreeData.event;
  private englishPathToChinese: { [key: string]: string } = {
    "editorunit": "单位",
    "soundall": "声音",
    "abilityall": "技能",
    "editordecoration": "装饰物",
    "editordestructible": "可破坏物",
    "editoritem": "物品",
    "modifierall": "魔法效果",
    "projectileall": "投射物",
    "technologyall": "科技"
  };
  private zhlanguageJson: any = undefined;
  constructor(private env: Env) {

    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("当前未打开工作目录");
      return;
    }

    this.editorTablePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "../editor_table");


    if (!isPathValid(this.editorTablePath)) {
      this.editorTablePath = "";
    }

    // 载入中文名称
    let zhlanguagePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "../zhlanguage.json");
    if (isPathValid(zhlanguagePath)) {
      try {
        this.zhlanguageJson = JSON.parse(fs.readFileSync(zhlanguagePath, 'utf8'));
      }
      catch (error) {
        vscode.window.showErrorMessage("读取和解析" + zhlanguagePath + "时失败，错误为：" + error);
      }
    }
    else {
      return;
    }
  }

  private editorTablePath: string = "";
  getTreeItem(element: FileNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileNode): Thenable<FileNode[]> {
    if (!this.editorTablePath || this.editorTablePath === "") {
      vscode.window.showInformationMessage("未找到物编数据,请检查是否初始化开发环境");
      return Promise.resolve([]);
    }

    const files = fs.readdirSync(element ? element.resourceUri.fsPath : this.editorTablePath);
    const fileNodes: FileNode[] = [];

    files.forEach(file => {
      const filePath = path.join(element ? element.resourceUri.fsPath : this.editorTablePath, file);
      const stat = fs.statSync(filePath);

      // 如果这个是物编数据的Json文件 那么它的label就需要加上其名称
      let label: string = file;
      if (isJson(filePath)) {
        let editorTableJsonData: any;
        try {
          editorTableJsonData = fs.readFileSync(filePath, 'utf8');
        }
        catch (error) {
          vscode.window.showErrorMessage("读取" + filePath + "时出错");
        }

        let editorTableJson: any = undefined;
        try {
          editorTableJson = JSON.parse(editorTableJsonData);

        }
        catch (error) {
          vscode.window.showErrorMessage("读取" + filePath + "时失败，错误为：" + error);
        }
        let name;
        if (editorTableJson.hasOwnProperty('name')) {
          let nameKey: any = editorTableJson['name'];
          name = this.zhlanguageJson[nameKey];
        }
        if (name !== undefined && typeof name === "string") {
          label = name + "(" + label.substring(0, label.length - 5) + ")";//显示为"这是一个单位(134219828)"的格式
        }
      }
      else if (stat.isDirectory()) {
        if (label in this.englishPathToChinese) {
          label = this.englishPathToChinese[label] + '(' + label + ')';
        }
        else {
          return Promise.resolve(fileNodes);
        }
      }
      const fileNode = new FileNode(
        label,
        stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        stat.isDirectory() ? vscode.Uri.file(filePath) : vscode.Uri.file(filePath),
        stat.isDirectory()
      );
      fileNodes.push(fileNode);
    });

    return Promise.resolve(fileNodes);
  }
}

class FileNode extends vscode.TreeItem {
  constructor(
    public label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri: vscode.Uri,
    public readonly isDirectory: boolean
  ) {
    super(label, collapsibleState);
    this.resourceUri = resourceUri;
    this.isDirectory = isDirectory;
    this.command = isDirectory ? undefined : {
      command: 'y3-helper.openFile',
      title: '打开文件',
      arguments: [resourceUri]
    };
  }
}