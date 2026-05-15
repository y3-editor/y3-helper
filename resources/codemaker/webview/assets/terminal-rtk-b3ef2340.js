const t = `<rtk_token_optimization>\r
# RTK (Rust Token Killer) - Token-Optimized Commands\r
\r
Your environment has RTK installed. You MUST prefix commands with \`rtk\` to reduce token consumption.\r
RTK filters command output to show only essential information (60-90% token savings).\r
\r
**Important**: The output you see from rtk-prefixed commands is filtered/compressed, not raw output.\r
If you need complete unfiltered output for debugging, use \`rtk proxy <cmd>\` instead.\r
If output contains \`[full output: <path>]\`, you can read that file for the full log.\r
\r
## Golden Rule\r
\r
Always prefix commands with \`rtk\`. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged \u2014 so it is always safe to add the prefix.\r
\r
For command chains (&&), prefix EACH segment independently:\r
  rtk git add . && rtk git commit -m "msg" && rtk git push\r
\r
## Commands by Category\r
\r
### Build & Compile (80-90% savings)\r
  rtk cargo build / rtk cargo check / rtk cargo clippy\r
  rtk tsc                 # TypeScript errors grouped by file/code (83%)\r
  rtk lint                # ESLint/Biome violations grouped (84%)\r
  rtk prettier --check    # Files needing format only (70%)\r
  rtk next build          # Next.js build with route metrics (87%)\r
\r
### Test (90-99% savings)\r
  rtk cargo test          # Cargo test failures only (90%)\r
  rtk vitest run          # Vitest failures only (99.5%)\r
  rtk playwright test     # Playwright failures only (94%)\r
  rtk test <cmd>          # Generic test wrapper - failures only\r
\r
### Git (59-80% savings)\r
  rtk git status / rtk git log / rtk git show\r
  rtk git add / rtk git commit / rtk git push / rtk git pull\r
  rtk git branch / rtk git fetch / rtk git stash\r
\r
### GitHub (26-87% savings)\r
  rtk gh pr view <num>    # Compact PR view (87%)\r
  rtk gh pr checks        # Compact PR checks (79%)\r
  rtk gh run list         # Compact workflow runs (82%)\r
  rtk gh issue list       # Compact issue list (80%)\r
\r
### JavaScript/TypeScript Tooling (70-90% savings)\r
  rtk pnpm list / rtk pnpm outdated / rtk pnpm install\r
  rtk npm run <script> / rtk npx <cmd>\r
  rtk prisma              # Prisma without ASCII art (88%)\r
\r
### Infrastructure (85% savings)\r
  rtk docker ps / rtk docker images / rtk docker logs <c>\r
\r
### Network (65-70% savings)\r
  rtk curl <url>          # Compact HTTP responses (70%)\r
  rtk wget <url>          # Compact download output (65%)\r
\r
## Meta Commands\r
  rtk gain              # View token savings statistics\r
  rtk gain --history    # View command history with savings\r
  rtk proxy <cmd>       # Run command WITHOUT filtering (for debugging)\r
</rtk_token_optimization>`;
export {
  t as default
};
