tsc -d src\y3-helper.ts --emitDeclarationOnly --outDir ./tmp/typings
dts-bundle --name y3-helper --main tmp\typings\y3-helper.d.ts --out binded.d.ts
xcopy /y /e .\tmp\typings\binded.d.ts .\template\excel\rule\y3-helper.d.ts
pause
