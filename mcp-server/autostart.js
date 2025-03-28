const { spawn } = require('child_process');
const path = require('path');

// Path to the MCP server directory
const serverDir = path.join(process.env.LOCALAPPDATA, 'AnthropicClaude', 'app-0.9.0', 'mcp-server');

// Start the MCP server
console.log('Starting MCP server...');
const server = spawn('node', ['server.js'], {
  cwd: serverDir,
  detached: true,
  stdio: 'ignore'
});

// Detach the process so it runs independently
server.unref();

console.log('MCP server started in background.');
