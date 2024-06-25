tsc -d src\editorTable\EXCEL\index.ts --emitDeclarationOnly --outDir ./tmp/typings
dts-bundle --name y3helper --main tmp\typings\index.d.ts --out y3helper.d.ts
xcopy /y .tmp\typings\y3helper.d.ts .\template\excel\rules\y3helper.d.ts
pause
