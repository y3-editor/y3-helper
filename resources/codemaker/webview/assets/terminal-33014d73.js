const e = `<run_terminal_cmd>\r
When executing terminal commands, please follow these rules:\r
  a. Commands are available and compatible with the {{shell|bash}} Shell of the {{osName|Unknown}} OS.\r
  b. The actual command will NOT execute until the user approves it. The user may not approve it immediately. Do NOT assume the command has started running.\r
</run_terminal_cmd>`;
export {
  e as default
};
