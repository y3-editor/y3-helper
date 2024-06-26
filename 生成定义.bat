tsc -d src\y3helper.ts --emitDeclarationOnly --outDir ./tmp/typings
dts-bundle --name y3helper --main tmp\typings\y3helper.d.ts --out binded.d.ts
xcopy /y .\tmp\typings\binded.d.ts .\template\excel\rule\y3helper.d.ts
pause
