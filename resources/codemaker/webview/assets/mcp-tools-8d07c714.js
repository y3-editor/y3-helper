const e = `<mcp_tool_call>\r
The Model Context Protocol (MCP) enables communication between the system and locally running MCP servers, which provide additional tools and resources to extend your capabilities.\r
You can use the server's tools via the use_mcp_tool tool and access the server's resources through the access_mcp_resource tool.\r
<available_servers>\r
\`\`\`\r
{{serversContent}}\r
\`\`\`\r
</available_servers>\r
</mcp_tool_call>`;
export {
  e as default
};
