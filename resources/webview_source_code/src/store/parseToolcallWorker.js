self.onmessage = function (event) {
  const {
    argumentStr,
    toolcallParsedIndex,
    parsedArgumentStr,
    parsedTargetFile,
    parsedCodeEdit,
    parsedDiff,
    inTargetFile,
    inIsCreateFile,
    inCodeEdit,
    inDiff
  } = event.data;
  try {
    const output = parseArgumentStr({
      argumentStr,
      toolcallParsedIndex,
      parsedArgumentStr,
      parsedTargetFile,
      parsedCodeEdit,
      parsedDiff,
      inTargetFile,
      inIsCreateFile,
      inCodeEdit,
      inDiff
    });
    self.postMessage(output);
  } catch (error) {
    // 错误处理
    console.log('解析错误:', error);
  }
};


function parseArgumentStr(input) {
  let {
    argumentStr,
    toolcallParsedIndex,
    parsedArgumentStr,
    parsedTargetFile,
    parsedCodeEdit,
    parsedDiff,
    inTargetFile,
    inIsCreateFile,
    inCodeEdit,
    inDiff
  } = input;
  for (let i = toolcallParsedIndex; i < argumentStr.length; i++) {
    parsedArgumentStr += argumentStr[i];
    toolcallParsedIndex++;
    if (parsedArgumentStr.endsWith('"target_file": "')) {
      inTargetFile = true;
    } else if (inTargetFile) {
      parsedTargetFile += argumentStr[i];
      if (parsedArgumentStr.endsWith('", "is_create_file"')) {
        inTargetFile = false;
        inIsCreateFile = true;
        parsedTargetFile = parsedTargetFile.slice(0, -19);
      } else if (parsedArgumentStr.endsWith(', "code_edit": "')) {
        inTargetFile = false;
        inCodeEdit = true;
        parsedTargetFile = parsedTargetFile.slice(0, -15);
      } else if (parsedArgumentStr.endsWith(', "diff": "')) {
        inTargetFile = false;
        inDiff = true;
        parsedTargetFile = parsedTargetFile.slice(0, -10);
      }
    } else if (inIsCreateFile) {
      if (parsedArgumentStr.endsWith(', "code_edit": "')) {
        inIsCreateFile = false;
        inCodeEdit = true;
      } else if (parsedArgumentStr.endsWith(', "diff": "')) {
        inIsCreateFile = false;
        inDiff = true;
      }
    } else if (inCodeEdit) {
      parsedCodeEdit += argumentStr[i];
    } else if (inDiff) {
      parsedDiff += argumentStr[i];
    }
  }
  // console.log(argumentStr)
  let codeContent = '';
  if (parsedTargetFile && parsedCodeEdit) {
    // const language = filePath.split('.').slice(-1)[0];
    codeContent = `\n\n\`\`\`\n${parsedCodeEdit}\n\`\`\``;
  }
  if (parsedTargetFile && parsedDiff) {
    // const language = filePath.split('.').slice(-1)[0];
    codeContent = `\n\n\`\`\`\n${parsedDiff}\n\`\`\``;
  }
  return {
    argumentStr,
    toolcallParsedIndex,
    parsedArgumentStr,
    parsedTargetFile,
    parsedCodeEdit,
    parsedDiff,
    inTargetFile,
    inIsCreateFile,
    inCodeEdit,
    inDiff,
    codeContent
  }
}

