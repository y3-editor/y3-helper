/**
 * RTK Command Rewriter (Windows) — 对齐上游 src/utils/rtk/rtkCommandRewriter.ts
 *
 * Replace `rtk ` prefix with absolute RTK binary path.
 */
export function rewriteCommandWithRtk(command: string, rtkPath: string): string {
  const { segments, separators } = splitWithSeparators(command);

  const quotedPath = rtkPath.includes(' ') ? `"${rtkPath}"` : rtkPath;

  const rewritten = segments.map((seg) => {
    const trimmed = seg.trim();
    if (!trimmed) return seg;

    // Already uses the absolute RTK path — no change
    const normalizedPath = rtkPath.replace(/\\/g, '/');
    const normalizedCmd = trimmed.replace(/\\/g, '/');
    if (normalizedCmd.startsWith(normalizedPath) || normalizedCmd.startsWith(`"${normalizedPath}`)) {
      return seg;
    }

    // Strip `rtk` prefix from git diff segments
    if (trimmed.startsWith('rtk git diff')) {
      const leadingSpace = seg.match(/^\s*/)?.[0] || '';
      const rest = trimmed.slice(4);
      console.log(`[RTK] Windows strip rtk from git diff: "${trimmed}" → "${rest}"`);
      return `${leadingSpace}${rest}`;
    }

    // Replace `rtk ` prefix with quoted absolute path
    if (trimmed.startsWith('rtk ') || trimmed === 'rtk') {
      const leadingSpace = seg.match(/^\s*/)?.[0] || '';
      const rest = trimmed.slice(trimmed === 'rtk' ? 3 : 4);
      console.log(`[RTK] Windows path replace: "rtk ${rest}" → "${quotedPath} ${rest}"`);
      return `${leadingSpace}${quotedPath} ${rest}`;
    }

    return seg;
  });

  let result = rewritten[0];
  for (let i = 0; i < separators.length; i++) {
    result += separators[i] + rewritten[i + 1];
  }

  return result;
}

function splitWithSeparators(command: string): {
  segments: string[];
  separators: string[];
} {
  const segments: string[] = [];
  const separators: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === '\\' && i + 1 < command.length) {
      current += ch + command[i + 1];
      i++;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (
        (ch === '&' && command[i + 1] === '&') ||
        (ch === '|' && command[i + 1] === '|')
      ) {
        segments.push(current);
        separators.push(ch + command[i + 1]);
        current = '';
        i++;
        continue;
      }
      if (ch === '|' || ch === ';') {
        segments.push(current);
        separators.push(ch);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  segments.push(current);
  return { segments, separators };
}
