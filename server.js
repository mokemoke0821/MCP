// Enhanced MCP Server for Claude (第3フェーズ対応版)
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// 拡張MCPモジュールのインポート
const enhancedMcp = require('../../Desktop/enhanced-mcp');

// サーバー初期化前に拡張機能を初期化
const mcpTools = enhancedMcp.initEnhancedMCPServer();

// Load configuration
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config;

try {
  const configFile = fs.readFileSync(CONFIG_PATH, 'utf8');
  config = JSON.parse(configFile);
  console.log('Configuration loaded successfully');
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

// Setup logging
const logDir = path.resolve(config.monitoring.logPath || "./logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFilePath = path.join(logDir, `server-${new Date().toISOString().split('T')[0]}.log`);
const errorFilePath = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
const errorStream = fs.createWriteStream(errorFilePath, { flags: 'a' });

// Custom logger
const logger = {
  info: (message) => {
    const logEntry = `[${new Date().toISOString()}] INFO: ${message}\n`;
    console.log(message); logStream.write(logEntry);
  },
  error: (message, error) => {
    const errorDetail = error ? `\n${error.stack || error}` : '';
    const logEntry = `[${new Date().toISOString()}] ERROR: ${message}${errorDetail}\n`;
    console.error(message); errorStream.write(logEntry); logStream.write(logEntry);
  }
};

// Helper functions for file operations
const fileHelpers = {
  isPathAllowed: (filePath) => {
    const normalizedPath = path.normalize(filePath);
    return config.fileOperations.allowedPaths.some(allowedPath => 
      normalizedPath.startsWith(path.normalize(allowedPath)));
  },
  validateFilePath: (filePath) => {
    if (!fileHelpers.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath} is not in an allowed directory`);
    }
    return path.normalize(filePath);
  }
};

// Helper functions for command execution
const commandHelpers = {
  isCommandAllowed: (command) => {
    const baseCommand = command.trim().split(/\s+/)[0].toLowerCase();
    if (config.security.blockedCommands.includes(baseCommand)) return false;
    return config.security.allowedCommands.includes(baseCommand) || 
           config.security.allowedCommands.includes('*');
  },
  
  sanitizeCommand: (command) => {
    // 第3フェーズ修正: パイプ文字(|)とセミコロン(;)を許可
    if (command.length > config.security.maxCommandLength) {
      throw new Error(`Command exceeds maximum allowed length`);
    }
    return command.replace(/[`$]/g, '');
  },
  
  // 第3フェーズ対応PowerShell コマンド実行関数
  executePowerShellCommand: (command) => {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Executing PowerShell command: ${command}`);
        
        // UTF-16LEとUTF-8エンコーディングを正しく処理
        const encodedCommand = `
        # エンコーディング設定
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
        [Console]::InputEncoding = [System.Text.Encoding]::UTF8;
        $OutputEncoding = [System.Text.Encoding]::UTF8;
        
        # PowerShell 5.1と7.xの両方に対応
        try {
          if ($PSVersionTable.PSVersion.Major -ge 7) {
            $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8NoBOM';
            $PSDefaultParameterValues['*:Encoding'] = 'utf8NoBOM';
          } else {
            $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8';
            $PSDefaultParameterValues['*:Encoding'] = 'utf8';
          }
        } catch {
          $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8';
        }
        
        # ロケール設定
        try {
          [System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::GetCultureInfo('ja-JP');
          [System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::GetCultureInfo('ja-JP');
        } catch {}
        
        # コマンド実行
        ${command}
        `.trim();
        
        // Base64エンコード - UTF-16LEで処理
        const encodedCommandBuffer = Buffer.from(encodedCommand, 'utf16le');
        const base64Command = encodedCommandBuffer.toString('base64');
        
        // 環境変数とオプション設定
        const options = { 
          encoding: 'utf8', shell: 'cmd.exe',
          env: { 
            ...process.env, 
            LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8', LC_CTYPE: 'ja_JP.UTF-8',
            POWERSHELL_TELEMETRY_OPTOUT: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1'
          },
          maxBuffer: 20 * 1024 * 1024 // 20MB
        };
        
        // コードページ変更を含めてコマンド実行
        const psCommand = `chcp 65001 >nul && powershell.exe -NoProfile -NonInteractive -NoLogo -ExecutionPolicy Bypass -EncodedCommand ${base64Command}`;
        
        // コマンド実行
        exec(psCommand, options, (error, stdout, stderr) => {
          if (error) {
            logger.error(`PowerShell execution error: ${error.message}`);
            reject(error);
            return;
          }
          
          // 結果処理 - BOMがあれば除去
          const processOutput = (output) => {
            if (!output) return '';
            
            // BOMの検出と除去
            if (output.charCodeAt(0) === 0xFEFF) {
              return output.slice(1);
            } else if (output.length >= 2 && output.charCodeAt(0) === 0xFF && output.charCodeAt(1) === 0xFE) {
              return output.slice(2);
            } else if (output.length >= 3 && 
                      output.charCodeAt(0) === 0xEF && 
                      output.charCodeAt(1) === 0xBB && 
                      output.charCodeAt(2) === 0xBF) {
              return output.slice(3);
            }
            
            return output;
          };
          
          resolve({ 
            stdout: processOutput(stdout), 
            stderr: processOutput(stderr) 
          });
        });
      } catch (error) {
        logger.error(`PowerShell command preparation error`, error);
        reject(error);
      }
    });
  },
  
  executeCommand: (command) => {
    return new Promise((resolve, reject) => {
      if (!commandHelpers.isCommandAllowed(command)) {
        reject(new Error(`Command not allowed: ${command}`));
        return;
      }
      
      try {
        const sanitizedCommand = commandHelpers.sanitizeCommand(command);
        logger.info(`Executing command: ${sanitizedCommand}`);
        
        // シェルタイプの検出（第3フェーズ対応）
        const isPowerShell = sanitizedCommand.toLowerCase().match(/^(powershell|pwsh|invoke-|get-|set-|new-|test-|format-|out-|import-|export-|convert-|update-|select-|where-|write-|read-|add-|remove-|foreach-|start-|stop-|suspend-|resume-|wait-)/);
        const isGitBash = sanitizedCommand.toLowerCase().match(/^(bash|sh|git\s+bash|\.\/|source\s+|\.sh)/);
        
        if (isPowerShell) {
          // PowerShell 専用実行関数を使用
          return commandHelpers.executePowerShellCommand(sanitizedCommand)
            .then(resolve)
            .catch(reject);
        } else if (isGitBash) {
          // Git Bash / bash コマンド専用処理（第3フェーズ追加）
          const options = { 
            shell: 'cmd.exe',
            env: { 
              ...process.env, 
              LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8', LC_CTYPE: 'ja_JP.UTF-8',
              PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', TERM: 'xterm-256color',
              MSYS: 'winsymlinks:nativestrict', MSYSTEM: 'MINGW64'
            },
            maxBuffer: 20 * 1024 * 1024
          };
          
          // Git Bash用のコマンド構築
          const gitBashPath = process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Git\\bin\\bash.exe` : 'C:\\Program Files\\Git\\bin\\bash.exe';
          exec(`${gitBashPath} -c "${sanitizedCommand.replace(/"/g, '\\"')}"`, options, (error, stdout, stderr) => {
            if (error) {
              logger.error(`Git Bash execution error: ${error.message}`);
              reject(error);
              return;
            }
            
            // BOM対応処理関数
            const processOutput = (output) => {
              if (!output) return '';
              if (output.length >= 3 && 
                  output.charCodeAt(0) === 0xEF && 
                  output.charCodeAt(1) === 0xBB && 
                  output.charCodeAt(2) === 0xBF) {
                return output.slice(3);
              }
              return output;
            };
            
            resolve({ stdout: processOutput(stdout), stderr: processOutput(stderr) });
          });
        } else {
          // 通常の CMD コマンド（第3フェーズ完全改良版）
          const options = { 
            shell: 'cmd.exe',
            env: { 
              ...process.env, 
              LANG: 'ja_JP.UTF-8', 
              LC_ALL: 'ja_JP.UTF-8', 
              LC_CTYPE: 'ja_JP.UTF-8',
              PYTHONIOENCODING: 'utf-8', 
              PYTHONUTF8: '1'
            },
            maxBuffer: 20 * 1024 * 1024
          };
          
          // エスケープ処理を改善（特殊文字をそのまま維持）
          let cmdPrefix = 'chcp 65001 >nul';
          
          // 実行コマンド構築
          let fullCommand;
          if (sanitizedCommand.includes('|') || sanitizedCommand.includes(';')) {
            // 特殊文字を含む場合はPowerShellを使用して実行
            const psCmd = `"${sanitizedCommand.replace(/"/g, '\\"')}"`;
            fullCommand = `${cmdPrefix} && powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ${psCmd}`;
          } else {
            fullCommand = `${cmdPrefix} && ${sanitizedCommand}`;
          }
          
          // コマンド実行
          exec(fullCommand, options, (error, stdout, stderr) => {
            if (error) {
              logger.error(`CMD execution error: ${error.message}`);
              reject(error);
              return;
            }
            
            // BOM対応処理関数
            const processOutput = (output) => {
              if (!output) return '';
              if (output.length >= 3 && 
                  output.charCodeAt(0) === 0xEF && 
                  output.charCodeAt(1) === 0xBB && 
                  output.charCodeAt(2) === 0xBF) {
                return output.slice(3);
              }
              return output;
            };
            
            resolve({ stdout: processOutput(stdout), stderr: processOutput(stderr) });
          });
        }
      } catch (error) {
        logger.error(`Command preparation error: ${error.message}`, error);
        reject(error);
      }
    });
  }
};

// Create Express app
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Server info
const serverInfo = {
  name: config.server.name,
  version: config.server.version,
  status: "running",
  features: config.features
};

// HTTP endpoints
app.get("/info", (req, res) => {
  res.json({
    ...serverInfo,
    uptime: process.uptime()
  });
});

// Chat endpoint
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
      logger.error("Error processing request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });
}

// Dad jokes endpoint
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
      logger.error("Error generating joke:", error);
      res.status(500).json({ error: "Failed to generate joke" });
    }
  });
}

// File operations endpoints
if (config.features.fileOperations) {
  // Search files in directory (第3フェーズ完全対応)
  app.get("/files/search", (req, res) => {
    try {
      const { directory, query } = req.query;
      if (!directory || !query) {
        return res.status(400).json({ error: "Directory path and search query are required" });
      }

      try {
        const validatedPath = fileHelpers.validateFilePath(directory);
        const glob = require('glob');
        const micromatch = require('micromatch');
        
        logger.info(`File search: "${validatedPath}" with pattern "${query}"`);
        
        // 日本語対応ワイルドカードパターンを正規表現に変換
        const patternToRegex = (pattern) => {
          try {
            // 正規表現特殊文字のエスケープ
            let regexStr = pattern
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\\\*/g, '.*')
              .replace(/\\\?/g, '.');
            
            // Unicodeフラグを使用（日本語対応に必須）
            return new RegExp(`^${regexStr}$`, 'ui');
          } catch (error) {
            logger.error(`Regex creation error: ${error.message}`);
            return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'ui');
          }
        };
        
        // ファイル名が検索パターンにマッチするかチェックする関数
        const matchesPattern = (filename, pattern) => {
          const hasWildcard = pattern.includes('*') || pattern.includes('?');
          
          try {
            // 単純な部分一致（ワイルドカードなしの場合）
            if (!hasWildcard) return filename.toLowerCase().includes(pattern.toLowerCase());
            
            // 正規表現による方法
            const regex = patternToRegex(pattern);
            const regexMatch = regex.test(filename);
            
            // micromatchによるグロブパターンマッチング
            let micromatchResult = false;
            try {
              if (typeof micromatch.isMatch === 'function') {
                micromatchResult = micromatch.isMatch(filename, pattern, { nocase: true });
              }
            } catch (mmError) {
              logger.error(`Micromatch error: ${mmError.message}`);
            }
            
            return regexMatch || micromatchResult;
          } catch (matchError) {
            logger.error(`Pattern matching error: ${matchError.message}`);
            return filename.toLowerCase().includes(pattern.toLowerCase());
          }
        };
        
        // ファイル探索関数
        const findFiles = (startDir, pattern, maxDepth = 10) => {
          const results = [];
          
          // 再帰的に探索する内部関数
          const search = (dir, depth = 0) => {
            if (depth > maxDepth) return;
            
            try {
              let entries;
              try {
                entries = fs.readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
              } catch (readError) {
                logger.error(`Cannot read directory ${dir}: ${readError.message}`);
                return;
              }
              
              for (const entry of entries) {
                try {
                  const entryName = entry.name;
                  const fullPath = path.join(dir, entryName);
                  const relativePath = path.relative(validatedPath, fullPath);
                  
                  // マッチするか確認
                  const isMatch = matchesPattern(entryName, pattern);
                  
                  // マッチしたエントリを追加
                  if (isMatch) {
                    if (entry.isDirectory()) {
                      results.push({
                        name: entryName, path: fullPath, isDirectory: true, relativePath
                      });
                    } else {
                      results.push({
                        name: entryName,
                        path: fullPath,
                        isDirectory: false,
                        size: fs.statSync(fullPath).size,
                        relativePath
                      });
                    }
                  }
                  
                  // ディレクトリなら再帰的に探索
                  if (entry.isDirectory()) {
                    search(fullPath, depth + 1);
                  }
                } catch (entryError) {
                  logger.error(`Error processing entry ${entry.name}: ${entryError.message}`);
                  continue;
                }
              }
            } catch (dirError) {
              logger.error(`Error reading directory ${dir}: ${dirError.message}`);
            }
          };
          
          search(startDir);
          return results;
        };
        
        // ファイル検索実行
        const searchResults = findFiles(validatedPath, query);
        logger.info(`File search complete. Found ${searchResults.length} matches`);
        
        // 検索結果をレスポンス
        res.json({
          directory: directory,
          query: query,
          results: searchResults,
          count: searchResults.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`File search error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error searching files:", error);
      res.status(500).json({ error: "Failed to search files" });
    }
  });

  // List files in directory (第3フェーズ対応)
  app.get("/files/list", (req, res) => {
    try {
      const { directory } = req.query;
      if (!directory) {
        return res.status(400).json({ error: "Directory path is required" });
      }

      try {
        const validatedPath = fileHelpers.validateFilePath(directory);
        
        // 日本語ファイル名に対応した強化版list処理
        let files;
        try {
          files = fs.readdirSync(validatedPath, { withFileTypes: true, encoding: 'utf8' });
        } catch (readError) {
          throw new Error(`Cannot read directory: ${readError.message}`);
        }
        
        // 各ファイル情報の取得
        const fileList = files.map(file => {
          try {
            const fullPath = path.join(validatedPath, file.name);
            return {
              name: file.name,
              isDirectory: file.isDirectory(),
              path: path.join(directory, file.name),
              size: file.isDirectory() ? null : fs.statSync(fullPath).size
            };
          } catch (statError) {
            return {
              name: file.name,
              isDirectory: file.isDirectory(),
              path: path.join(directory, file.name),
              size: null,
              error: "Failed to get file stats"
            };
          }
        });
        
        res.json({
          directory: directory,
          files: fileList,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`File listing error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Read file content (第3フェーズ対応)
  app.get("/files/read", (req, res) => {
    try {
      const { filePath } = req.query;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      try {
        const validatedPath = fileHelpers.validateFilePath(filePath);
        const stats = fs.statSync(validatedPath);
        
        if (stats.isDirectory()) {
          return res.status(400).json({ error: "Cannot read directory content" });
        }
        
        if (stats.size > config.fileOperations.maxFileSize) {
          return res.status(400).json({ error: "File exceeds maximum allowed size" });
        }
        
        // BOMを適切に処理する読み込み処理（第3フェーズ対応）
        const buffer = fs.readFileSync(validatedPath);
        let content, encoding = 'utf8';
        
        // BOM検出と適切な処理
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          // UTF-8 with BOM
          content = buffer.toString('utf8', 3);
          encoding = 'utf8-bom';
        } else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
          // UTF-16LE
          content = buffer.toString('utf16le', 2);
          encoding = 'utf16le';
        } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
          // UTF-16BE
          content = buffer.toString('utf16be', 2);
          encoding = 'utf16be';
        } else {
          // No BOM - try UTF-8
          content = buffer.toString('utf8');
        }
        
        res.json({
          path: filePath,
          content: content,
          size: stats.size,
          encoding: encoding,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`File reading error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error reading file:", error);
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  // Write to file
  app.post("/files/write", (req, res) => {
    try {
      const { filePath, content } = req.body;
      if (!filePath || content === undefined) {
        return res.status(400).json({ error: "File path and content are required" });
      }

      try {
        const validatedPath = fileHelpers.validateFilePath(filePath);
        
        // Make sure directory exists
        const directory = path.dirname(validatedPath);
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }
        
        fs.writeFileSync(validatedPath, content, 'utf8');
        
        res.json({
          path: filePath,
          size: Buffer.byteLength(content),
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`File writing error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error writing to file:", error);
      res.status(500).json({ error: "Failed to write to file" });
    }
  });

  // Create directory
  app.post("/files/mkdir", (req, res) => {
    try {
      const { directory } = req.body;
      if (!directory) {
        return res.status(400).json({ error: "Directory path is required" });
      }

      try {
        const validatedPath = fileHelpers.validateFilePath(directory);
        
        if (!fs.existsSync(validatedPath)) {
          fs.mkdirSync(validatedPath, { recursive: true });
        }
        
        res.json({
          path: directory,
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Directory creation error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error creating directory:", error);
      res.status(500).json({ error: "Failed to create directory" });
    }
  });

  // Delete file or directory
  app.delete("/files/delete", (req, res) => {
    try {
      const { path: targetPath } = req.body;
      if (!targetPath) {
        return res.status(400).json({ error: "Path is required" });
      }

      try {
        const validatedPath = fileHelpers.validateFilePath(targetPath);
        
        if (!fs.existsSync(validatedPath)) {
          return res.status(404).json({ error: "File or directory not found" });
        }
        
        const stats = fs.statSync(validatedPath);
        
        if (stats.isDirectory()) {
          fs.rmdirSync(validatedPath, { recursive: true });
        } else {
          fs.unlinkSync(validatedPath);
        }
        
        res.json({
          path: targetPath,
          wasDirectory: stats.isDirectory(),
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Deletion error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error deleting file or directory:", error);
      res.status(500).json({ error: "Failed to delete" });
    }
  });
}

// Desktop command endpoint
if (config.features.desktopCommands) {
  app.post("/command/execute", async (req, res) => {
    try {
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }

      try {
        const result = await commandHelpers.executeCommand(command);
        res.json({
          command: command,
          stdout: result.stdout,
          stderr: result.stderr,
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Command execution error: ${error.message}`, error);
        res.status(403).json({ error: error.message });
      }
    } catch (error) {
      logger.error("Error in command endpoint:", error);
      res.status(500).json({ error: "Failed to execute command" });
    }
  });
}

// Enhanced health check endpoint
app.get("/health", (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  logger.error("Server error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message || "不明なエラーが発生しました",
    timestamp: new Date().toISOString()
  });
});

// メモリ使用量監視（第3フェーズ対応）
if (config.monitoring.memoryCheck) {
  const checkMemory = () => {
    try {
      const memoryUsage = process.memoryUsage();
      const usedMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      logger.info(`Memory usage: ${usedMemoryMB}MB`);
      
      // メモリ使用量が1GBを超えたら警告ログを出力
      if (usedMemoryMB > 1024) {
        logger.error(`High memory usage detected: ${usedMemoryMB}MB`);
      }
    } catch (error) {
      logger.error("Memory check error:", error);
    }
  };
  
  // 定期的なメモリチェック
  setInterval(checkMemory, config.monitoring.memoryCheckInterval);
}

// HTTPサーバー作成と起動
const server = http.createServer(app);
const port = config.server.port || 3001;

// エラーハンドリング
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});

// シャットダウン処理
const gracefulShutdown = () => {
  logger.info('Shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // ログストリームのクローズ
    logStream.end();
    errorStream.end();
    
    process.exit(0);
  });
  
  // 10秒以内にシャットダウンしない場合は強制終了
  setTimeout(() => {
    logger.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 10000);
};

// シグナルハンドラの登録
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// サーバー起動
server.listen(port, () => {
  logger.info(`MCP Server (第3フェーズ対応版) running on port ${port}`);
  logger.info(`Server features: ${Object.keys(config.features).filter(f => config.features[f]).join(', ')}`);
  logger.info(`Server is ready to accept connections`);
});
