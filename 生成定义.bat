tsc -d --emitDeclarationOnly --outDir ./tmp/types
dts-bundle --name y3-helper --main tmp\types\y3-helper.d.ts --out binded.d.ts
xcopy /y /e .\tmp\types\binded.d.ts .\template\excel\rule\y3-helper.d.ts
pause
