# Y3开发助手

## 初始化项目（给新建的地图使用，老地图勿用！）：

1. 按 `F1` 打开命令列表，使用命令 `Y3:初始化开发环境`
2. 选择地图路径
3. 完成！

# 修改并导入物编

初始化后，你的项目中会生成 `resource\editor_table` 文件夹，你可以修改这些CSV文件来生成物编。

之后使用命令 `Y3:导入物编数据（CSV）` 即可将这些物编写入地图。

> 如果是老地图，请使用命令 `Y3:生成物编模板（CSV）` 来生成模板文件

> 推荐和[Edit csv](https://marketplace.visualstudio.com/items?itemName=janisdd.vscode-edit-csv)插件配合使用，以便在Visual Code内编辑CSV表格，无需打开新的窗口

> 你可以通过 `Y3-Helper.CSVPath` 设置修改这些CSV文件的路径
