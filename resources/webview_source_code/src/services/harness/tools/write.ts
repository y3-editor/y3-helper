/**
 * Claude write模式
 */

function getPreReadInstruction(): string {
  return `\n- If this is an existing file, you MUST use the read_file tool first to read the file's contents. This tool will fail if you did not read the file first.`
}

export const getWriteTool = () => {

  const description = `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.${getPreReadInstruction()}
- Prefer the Edit tool for modifying existing files \u2014 it only sends the diff. Only use this tool to create new files or for complete rewrites.
- NEVER create documentation files (*.md) or README files unless explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`


  return {
    type: 'function',
    function: {
      name: 'write',
      description: description,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description:
              'The absolute path to the file to write (must be absolute, not relative)',
          },
          content: {
            type: 'string',
            description:
              'The content to write to the file',
          },
        },
        required: ['file_path', 'content'],
      }
    },
  }
}


/**
 * Claude edit模式
 */
export const getEditTool = () => {

  const description = `Performs exact string replacements in files.

Usage:
- You must use your \`read_file\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`


  return {
    type: 'function',
    function: {
      name: 'edit',
      description: description,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to modify',
          },
          old_string: {
            type: 'string',
            description: 'The text to replace',
          },
          new_string: {
            type: 'string',
            description: 'The text to replace it with (must be different from old_string)',
          },
          replace_all: {
            type: 'boolean',
            description: 'Replace all occurrences of old_string (default false)',
          }
        },
        required: ['file_path', 'old_string', 'new_string'],
      }
    },
  }
}