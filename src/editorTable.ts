import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Env } from './env';
import { isPathValid, isJson, getFileNameByVscodeUri } from './utility';
import { encode } from 'punycode';



export class Y3HelperDataProvider implements vscode.TreeDataProvider<FileNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined> = new vscode.EventEmitter<FileNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<FileNode | undefined> = this._onDidChangeTreeData.event;
  public readonly englishPathToChinese: { [key: string]: string };
  private editorTablePath: string = "";
  private zhlanguageJson: any = undefined;
  
  constructor(private env: Env) {
    this.englishPathToChinese = this.env.englishPathToChinese;
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("当前未打开工作目录");
      return;
    }

    this.editorTablePath = this.env.editorTablePath;

    // 载入中文名称
    this.zhlanguageJson = this.env.zhlanguageJson;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  
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
          label = this.englishPathToChinese[label];
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

/**
 * 提供物编数据对应的Json文件的SymbolProvider
 */
export class GoEditorTableSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(private editorTablePath: string = "",
    private zhlanguageJson: any = undefined,
    private englishPathToChinese: { [key: string]: string }
  ) {
    
  }
 
  private searchEditorTableItem(pathStr: string,query:string): vscode.SymbolInformation[] {
    let res: vscode.SymbolInformation[] = [];
    const files = fs.readdirSync(pathStr);
    files.forEach(file => {
      const filePath: string = path.join(pathStr, file);
      const stat = fs.statSync(filePath);
      
      if (isJson(filePath)) {
        let editorTableJsonData: any;
        let label = file;
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

        
        if (label.includes(query)) {
          let editorTableJsonName = label;
          let editorTableJsonKind = vscode.SymbolKind.File;

          let editorTableJsonUri: vscode.Uri = vscode.Uri.file(filePath);
          let editorTableJsonLocation: vscode.Location = new vscode.Location(editorTableJsonUri, new vscode.Position(0, 0));
          let containerName = '';
          let symbolInformation: vscode.SymbolInformation = new vscode.SymbolInformation(
            editorTableJsonName,
            editorTableJsonKind,
            containerName,
            editorTableJsonLocation
          );
          res.push(symbolInformation);
        }
      }
    });
      

    return res;
    
  }
  public  provideWorkspaceSymbols(
    query: string, token: vscode.CancellationToken):
    Thenable<vscode.SymbolInformation[]> {
    let res: vscode.SymbolInformation[] = [];
    if (token.isCancellationRequested||query.length===0) {
      return Promise.resolve(res);
    }

    //只搜索九个文件夹下对应的九类类物编数据，不递归搜索子文件夹
    for (let key in this.englishPathToChinese) {
      res=res.concat(this.searchEditorTableItem(path.join(this.editorTablePath, key), query));
    }
    
    

    return Promise.resolve(res);
  }
}



/**
 * 提供物编数据的Json文件内的中英文字段搜索的DocumentSymbolProvider
 */
export class GoEditorTableDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private englishKeyToChineseKey: any;
  constructor(private zhlanguageJson: any = undefined ) {
    let englishKeyToChineseKeyJsonPath = path.join(__dirname, "../config/englishKeyToChineseKey.json");
    if (isPathValid(englishKeyToChineseKeyJsonPath)) {
      try {
        this.englishKeyToChineseKey = JSON.parse(fs.readFileSync(englishKeyToChineseKeyJsonPath, 'utf8'));
      }
      catch (error) {
        vscode.window.showErrorMessage("读取和解析" + englishKeyToChineseKeyJsonPath + "时失败，错误为：" + error);
      }
    }
  }
  public provideDocumentSymbols(
    document: vscode.TextDocument, token: vscode.CancellationToken):
    Thenable<vscode.SymbolInformation[]> {
    let res: vscode.SymbolInformation[] = [];
    if (token.isCancellationRequested) {
      return Promise.resolve(res);
    }
    res=this.getEditorTableJsonSymbols(document);

    return Promise.resolve(res);
  }
  private getEditorTableJsonSymbols(document: vscode.TextDocument): vscode.SymbolInformation[] {
    let res: vscode.SymbolInformation[] = [];
    const keyToLine: { [key: string]: number } = {};
    let editorTableJsonData:any = JSON.parse(document.getText());
    for (let i = 0; i < document.lineCount; i++){
      let line = document.lineAt(i).text;
      const matches = line.match(/"\s*([^"]+)"\s*(?=:)/g);// 正则表达式匹配双引号内，且后继一个:的字符串，视为Json的键
      if (matches) {
        matches.forEach(match => {
          match = match.substring(1, match.length - 1);
          keyToLine[match] = i;
        });
      };
    }
    let fileName: string = getFileNameByVscodeUri(vscode.Uri.file(document.fileName));
    let chineseName = this.zhlanguageJson[editorTableJsonData['name']];
    let finalFileName = fileName;
    if (chineseName !== undefined && typeof chineseName === 'string') {
      finalFileName = chineseName + "(" + fileName.substring(0, fileName.length - 5) + ")";//这是一个单位(134219828)"的格式
    }
    for (let key in keyToLine) {
      let name = key;
      let kind: vscode.SymbolKind;
      
      if (typeof editorTableJsonData[key] === typeof []) {
        kind = vscode.SymbolKind.Array;
      }
      else if (typeof editorTableJsonData[key]===typeof {} ) {
        kind = vscode.SymbolKind.Module;
      }
      else if (typeof editorTableJsonData[key] === typeof true) {
        kind = vscode.SymbolKind.Boolean;
      }
      else if (!isNaN(editorTableJsonData[key])) {
        kind = vscode.SymbolKind.Number;
      }
      else if (typeof editorTableJsonData[key] === typeof "") {
        kind = vscode.SymbolKind.String;
      }
      else {
        kind = vscode.SymbolKind.Module;
      }

      let uri: vscode.Uri = document.uri;
      let location: vscode.Location = new vscode.Location(document.uri, new vscode.Position(keyToLine[key], 0));
      let containerName = finalFileName;
      if (key in this.englishKeyToChineseKey) {
        // todo:获得字段对应的中文名
        name = this.englishKeyToChineseKey[key] + '(' + key + ')';
        let symbolInformation: vscode.SymbolInformation = new vscode.SymbolInformation(
          name,
          kind,
          containerName,
          location
        );
        res.push(symbolInformation);
      }
      
    }
    
    return res;
  }
}


/**
 * @param editorTableJsonName 物编数据Json的文件名
 * @param editorTableJson 物编数据的Json对象
 * @param zhlanguageJson 
 */
function getChineseName(editorTableJsonName:string,editorTableJson: any, zhlanguageJson: any):string {
  let name;
  let res: string=editorTableJsonName;
  if (editorTableJson.hasOwnProperty('name')) {
    let nameKey: any = editorTableJson['name'];
    name = zhlanguageJson[nameKey];
  }
  if (name !== undefined && typeof name === "string") {
    res = name + "(" + editorTableJsonName.substring(0, editorTableJsonName.length - 5) + ")";//显示为"这是一个单位(134219828)"的格式
  }
  return res;
}
