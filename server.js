const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// 拡張MCPモジュールのインポート
const enhancedMcp = require('./enhanced-mcp');

// クロスプラットフォーム対応モジュールのインポート
const platformInfo = require('./platform-detect');
const crossPlatformPath = require('./cross-platform-path');
const configTransformer = require('./config-transform');
const CrossPlatformIntegration = require('./cross-platform-integration');

// Load configuration
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config;

try {
  // 設定ファイルを読み込み、クロスプラットフォーム対応のために変換
  const configFile = fs.readFileSync(CONFIG_PATH, 'utf8');
  const rawConfig = JSON.parse(configFile);

  // 設定を変換
  if (rawConfig.features && rawConfig.features.crossPlatform) {
    config = configTransformer.transformConfig(rawConfig);
    console.log('Configuration loaded and transformed successfully');
  } else {
    config = rawConfig;
    console.log('Configuration loaded successfully');
  }
} catch (error) {
  console.error('Error loading configuration:', error.message);
  config = {
    server: { name: "claude-mcp-server", version: "1.0.0", port: 3001 },
    features: { dadJokes: true, chat: true, fileOperations: true, desktopCommands: true },
    monitoring: {
      memoryCheck: true, memoryCheckInterval: 60000, errorLogging: true,
      logPath: "./logs", notifyAdmin: true, adminEmail: "admin@example.com"
    },
    security: {
      allowedCommands: ["dir", "type", "echo", "mkdir", "rmdir", "del", "copy", "move"],
      blockedCommands: ["format", "shutdown", "taskkill"],
      maxCommandLength: 1000
    },
    fileOperations: {
      allowedPaths: ["C:/Users/prelude/Desktop", "C:/Users/prelude/Documents"],
      maxFileSize: 10485760
    }
  };
}

// サーバーポートの設定
const PORT = config && config.server && config.server.port ? config.server.port : 3001;

// サーバー初期化前に拡張機能を初期化
const mcpTools = enhancedMcp.initEnhancedMCPServer();

// Create Express app
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// サーバー情報
const serverInfo = {
  name: config.server.name,
  version: config.server.version,
  status: "running",
  features: config.features
};

// クロスプラットフォーム対応機能の統合
let crossPlatformIntegration;
if (config.features.crossPlatform) {
  try {
    crossPlatformIntegration = new CrossPlatformIntegration(app, config);
    crossPlatformIntegration.integrate();
    console.log('クロスプラットフォーム対応機能が正常に統合されました');
  } catch (error) {
    console.error('クロスプラットフォーム対応機能の統合に失敗しました:', error);
  }
}

// HTTP エンドポイント
app.get("/info", (req, res) => {
  res.json({
    ...serverInfo,
    uptime: process.uptime()
  });
});

// Chat エンドポイント
if (config.features.chat) {
  app.post("/request", (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });
      res.json({
        query: query,
        response: "Echo: " + query,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });
}

// Dad jokes エンドポイント
if (config.features.dadJokes) {
  app.post("/generate-joke", (req, res) => {
    try {
      const { topic } = req.body;
      if (!topic) return res.status(400).json({ error: "Topic is required" });
      res.json({
        topic: topic,
        joke: `Why don't programmers like nature? It has too many bugs and no debugging tools. Sorry, that was just a ${topic} joke!`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating joke:", error);
      res.status(500).json({ error: "Failed to generate joke" });
    }
  });
}

// サーバー作成
const server = http.createServer(app);

// サーバー起動
server.listen(PORT, () => {
  console.log(`サーバーが ${PORT} ポートで起動しました`);
});
