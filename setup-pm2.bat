@echo off
echo Installing PM2 globally...
npm install -g pm2

echo Setting up MCP server with PM2...
cd /d %~dp0
pm2 start server.js --name "claude-mcp-server" --watch

echo Saving PM2 configuration...
pm2 save

echo PM2 process monitor is now available. You can use the following commands:
echo - pm2 list : Show all running processes
echo - pm2 logs : Display logs
echo - pm2 monit : Monitor processes in real-time
echo - pm2 stop claude-mcp-server : Stop the MCP server
echo - pm2 restart claude-mcp-server : Restart the MCP server
echo - pm2 delete claude-mcp-server : Remove the MCP server from PM2

echo Done.
