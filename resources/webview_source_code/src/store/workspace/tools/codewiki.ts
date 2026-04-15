

export const generateCodewikiStructure = (data: {
  language?: 'en' | 'zh'
}) => {
  const { language = 'en' } = data
  return {
    type: 'function',
    function: {
      name: 'generate_codewiki_structure',
      description: language === 'en'
        ? `When a user creates or modifies the .y3maker/codewiki/wiki.json file, use this tool to generate the codewiki directory. If user needs to generate codewiki structure, use this tool`
        : `当用户创建或修改 .y3maker/codewiki/wiki.json 文件时，使用此工具来生成 codewiki 目录。 如果用户需要生成 codewiki 结构，使用此工具`
      ,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  }
}

