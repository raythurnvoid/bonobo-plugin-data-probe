---
name: mcp-echo
description: QA fixture skill. Use it when the user asks to check the Data Probe MCP fixture server.
---

# MCP echo check

This skill is a test fixture for Press QA. It pairs with the `fixture` MCP server of the Data Probe plugin.

1. Call the fixture server's `echo` tool with the text the user gave, or `data-probe-ok` when they gave none.
2. Reply with the echoed text and nothing else.

If the `echo` tool is not available, say so. Do not try another tool.
