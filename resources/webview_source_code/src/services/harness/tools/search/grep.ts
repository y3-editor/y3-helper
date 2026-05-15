export const GREP_TOOL_NAME = 'glob_search';



export const getGrepTool = () => {
  return (
    {
      type: 'function',
      function: {
        //   description: `Fast text-based regex search that finds exact pattern matches within files or directories, utilizing the ripgrep command for efficient searching.
        // Results will be formatted in the style of ripgrep and can be configured to include line numbers and content.
        // To avoid overwhelming output, the results are capped at 50 matches.
        // Use file_pattern to filter the search scope by file type or specific paths.

        // This is best for finding exact text matches or regex patterns.
        // More precise than semantic search for finding specific strings or patterns.
        // This is preferred over semantic search when we know the exact symbol/function name/etc. to search in some set of directories/file types.

        // The query MUST be a valid regex, so special characters must be escaped.
        // e.g. to search for a method call 'foo.bar(', you could use the query '\\\\bfoo\\\\.bar\\\\('.`,
        description: `A powerful search tool built on ripgrep

Usage:
- Prefer grep for exact symbol/string searches. Whenever possible, use this instead of terminal grep/rg. This tool is faster and respects .gitignore.
- Supports full regex syntax, e.g. \"log.*Error\", \"function\\s+\\w+\". Ensure you escape special chars to get exact matches, e.g. \"functionCall\\(\"
- Avoid overly broad glob patterns (e.g., '--glob *') as they bypass .gitignore rules and may be slow
- Only use 'file_pattern' when certain of the file type needed. Note: import paths may not match source file types (.js vs .ts)
- regex syntax: Uses ripgrep (not grep) - literal braces need escaping (e.g. use interface\\{\\} to find interface{} in Go code)
- To avoid overwhelming output, the results are capped at 50 matches.`,
        name: 'grep_search',
        parameters: {
          properties: {
            path: {
              description:
                'The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.',
              type: 'string',
            },
            file_pattern: {
              description:
                "Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*)",
              type: 'string',
            },
            regex: {
              description:
                'The regular expression pattern to search for. Uses Rust regex syntax',
              type: 'string',
            },
            case_sensitive: {
              description:
                'Whether the search should be case sensitive. Default is false.',
              type: 'boolean',
            },
          },
          required: ['path', 'regex'],
          type: 'object',
        },
      },
    }
  )
}