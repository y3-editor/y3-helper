const t = `<rtk_awareness>\r
Your environment has RTK (Rust Token Killer) installed. Terminal command output may be filtered and compressed for token optimization.\r
\r
Important:\r
- Command output you see may have details omitted (e.g., only errors shown, verbose info removed).\r
- If output appears insufficient for your task, use \`rtk proxy <cmd>\` to get the complete unfiltered output.\r
- If output contains \`[full output: <path>]\`, you can read that file for the full unfiltered log.\r
\r
Available meta commands:\r
  rtk proxy <cmd>       # Run command without filtering (for debugging)\r
  rtk gain              # Show token savings statistics\r
</rtk_awareness>`;
export {
  t as default
};
