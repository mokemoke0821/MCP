/**
 * Enhanced MCP Server Module (第3フェーズ対応)
 * 日本語環境完全対応、特殊文字コマンド処理、ファイル検索機能強化
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// 依存関係チェック関数
function checkDependencies() {
  try {
    require('glob');
    require('micromatch');
  } catch (error) {
    console.error('必要なパッケージがインストールされていません。npm install glob micromatch を実行してください。');
    process.exit(1);
  }
}

// エンコーディング設定の強化
function setupEncoding() {
  process.env.LANG = 'ja_JP.UTF-8';
  process.env.LC_ALL = 'ja_JP.UTF-8';
  process.env.LC_CTYPE = 'ja_JP.UTF-8';
  process.env.PYTHONIOENCODING = 'utf-8';
  process.env.PYTHONUTF8 = '1';
  
  if (process.platform === 'win32') {
    try {
      exec('chcp 65001', (error) => {
        if (error) {
          console.error('コードページの設定に失敗しました:', error.message);
        }
      });
    } catch (error) {
      console.error('コードページ設定中にエラーが発生しました:', error.message);
    }
  }
}

// 安全なコマンド実行関数
function safeExecuteCommand(command, shell = 'default', options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const defaultOptions = { 
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024, // 20MB
        windowsHide: true,
        env: {
          ...process.env,
          LANG: 'ja_JP.UTF-8',
          LC_ALL: 'ja_JP.UTF-8',
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      };

      const mergedOptions = { ...defaultOptions, ...options };
      
      let execCommand;
      
      switch (shell.toLowerCase()) {
        case 'powershell':
          if (process.platform === 'win32') {
            // PowerShellの場合はエンコードコマンドを使用する
            const encodedCommand = Buffer.from(
              // UTF-8対応の正しいヘッダーを追加
              `
              [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
              [Console]::InputEncoding = [System.Text.Encoding]::UTF8;
              $OutputEncoding = [System.Text.Encoding]::UTF8;
              
              # 日本語設定
              [System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::GetCultureInfo('ja-JP');
              [System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::GetCultureInfo('ja-JP');
              
              # BOMなしUTF-8を出力設定
              $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8';
              $PSDefaultParameterValues['*:Encoding'] = 'utf8';
              
              # 実行するコマンド
              ${command}
              
              if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
                Write-Error "Command exited with code $LASTEXITCODE"
                exit $LASTEXITCODE
              }
              `.replace(/\$/g, '`$'), 'utf16le').toString('base64');
              
            execCommand = `chcp 65001 >nul && powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`;
          } else {
            // Windowsでない場合は通常のpwshを使用
            execCommand = `pwsh -NoProfile -Command "${command.replace(/"/g, '\\"')}"`;
          }
          break;
        case 'bash':
          execCommand = `bash -c "${command.replace(/"/g, '\\"')}"`;
          break;
        default:
          if (process.platform === 'win32') {
            // Windowsの場合はCMDにUTF-8を設定
            execCommand = `chcp 65001 >nul && cmd.exe /c "${command}"`;
          } else {
            execCommand = command;
          }
      }

      exec(execCommand, mergedOptions, (error, stdout, stderr) => {
        if (error) {
          reject({
            error: error.message,
            stdout,
            stderr,
            command: execCommand
          });
          return;
        }

        resolve({
          stdout,
          stderr
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ファイル検索機能
function enhancedSearchFiles(directory, pattern, options = {}) {
  const glob = require('glob');
  const defaultOptions = {
    nodir: false,
    realpath: true,
    absolute: true,
    dot: false,
    ignore: ['**/node_modules/**'],
    encoding: 'utf8'
  };

  const mergedOptions = { ...defaultOptions, ...options };

  return new Promise((resolve, reject) => {
    try {
      // ディレクトリの存在確認
      if (!fs.existsSync(directory)) {
        reject(new Error(`検索ディレクトリが存在しません: ${directory}`));
        return;
      }

      // パターンの型チェック
      if (typeof pattern !== 'string') {
        reject(new Error('検索パターンは文字列である必要があります'));
        return;
      }

      glob(pattern, { 
        cwd: directory,
        ...mergedOptions
      }, (error, matches) => {
        if (error) {
          reject(error);
          return;
        }

        // ファイル/ディレクトリの詳細情報を取得
        const detailedMatches = matches.map(filePath => {
          try {
            const stats = fs.statSync(filePath);
            return {
              path: filePath,
              name: path.basename(filePath),
              isDirectory: stats.isDirectory(),
              size: stats.isDirectory() ? null : stats.size,
              modified: stats.mtime
            };
          } catch (statError) {
            return {
              path: filePath,
              name: path.basename(filePath),
              error: statError.message
            };
          }
        });

        resolve(detailedMatches);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ロガー関数
function enhancedLogger(options = {}) {
  const defaultOptions = {
    logLevel: 'info',
    format: 'full',
    outputPath: path.join(process.cwd(), 'logs', 'enhanced-mcp.log')
  };

  const mergedOptions = { ...defaultOptions, ...options };
  
  // ログディレクトリ作成
  const logDir = path.dirname(mergedOptions.outputPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logStream = fs.createWriteStream(mergedOptions.outputPath, { flags: 'a' });

  // アロー関数を使用せず、メソッドを定義
  const logger = {
    log: function(level, message) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
      
      console.log(logMessage.trim());
      logStream.write(logMessage);
    },
    info: function(message) {
      this.log('info', message);
    },
    warn: function(message) {
      this.log('warn', message);
    },
    error: function(message) {
      this.log('error', message);
    }
  };

  return logger;
}

// 初期化関数
function initEnhancedMCPServer(options = {}) {
  checkDependencies();
  setupEncoding();

  const logger = enhancedLogger(options.logger);
  logger.info('Enhanced MCP Server モジュールが初期化されました');

  return {
    safeExecuteCommand,
    enhancedSearchFiles,
    setupEncoding,
    enhancedLogger: logger
  };
}

// モジュールエクスポート
module.exports = {
  initEnhancedMCPServer,
  safeExecuteCommand,
  enhancedSearchFiles,
  setupEncoding,
  enhancedLogger
};
