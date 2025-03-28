/**
 * cross-platform-integration.js
 * MCPサーバーにクロスプラットフォーム対応機能を統合するモジュール
 */

const platformInfo = require('./platform-detect');
const crossPlatformPath = require('./cross-platform-path');
const configTransformer = require('./config-transform');
const fs = require('fs-extra');
const path = require('path');

/**
 * クロスプラットフォーム対応機能の統合クラス
 */
class CrossPlatformIntegration {
  /**
   * MCPサーバーにクロスプラットフォーム対応機能を統合
   * @param {object} server - MCPサーバーインスタンス
   * @param {object} config - 設定オブジェクト
   */
  constructor(server, config = {}) {
    this.server = server;
    this.config = config;
    this.platformInfo = platformInfo;
    this.path = crossPlatformPath;
    this.configTransformer = configTransformer;
    
    // ロガーの設定
    this.logger = this.setupLogger();
  }

  /**
   * ロガーのセットアップ
   * @returns {object} - ロガーオブジェクト
   */
  setupLogger() {
    const logDir = this.config.monitoring?.logPath || './logs';
    const normalizedLogDir = this.path.normalize(logDir);
    
    // ディレクトリが存在しなければ作成
    if (!fs.existsSync(normalizedLogDir)) {
      fs.mkdirSync(normalizedLogDir, { recursive: true });
    }
    
    const logFile = path.join(normalizedLogDir, 'cross-platform.log');
    
    // シンプルなロガーを実装
    return {
      info: (context, message) => {
        if (!this.config.monitoring?.errorLogging) return;
        
        const logEntry = `[${new Date().toISOString()}] [INFO] [${context}] ${message}\n`;
        fs.appendFileSync(logFile, logEntry);
      },
      
      error: (context, error) => {
        if (!this.config.monitoring?.errorLogging) return;
        
        const logEntry = `[${new Date().toISOString()}] [ERROR] [${context}] ${error.stack || error}\n`;
        fs.appendFileSync(logFile, logEntry);
      }
    };
  }

  /**
   * クロスプラットフォーム対応機能をMCPサーバーに統合
   */
  integrate() {
    try {
      this.logger.info('統合開始', 'クロスプラットフォーム対応機能の統合を開始します');
      
      // クロスプラットフォームパスユーティリティをグローバルに統合
      this.integratePathUtilities();
      
      // 設定ファイル変換を統合
      this.integrateConfigTransformer();
      
      // プラットフォーム検出APIを公開
      this.exposePlatformInfo();
      
      this.logger.info('統合完了', 'クロスプラットフォーム対応機能が正常に統合されました');
      
      return true;
    } catch (error) {
      this.logger.error('統合エラー', error);
      return false;
    }
  }

  /**
   * パス操作ユーティリティを統合
   */
  integratePathUtilities() {
    try {
      this.logger.info('パスユーティリティ統合', 'クロスプラットフォームパス操作機能を統合します');
      
      // ファイルヘルパーを拡張
      if (this.server.fileHelpers) {
        // 既存の関数をバックアップ
        const originalIsPathAllowed = this.server.fileHelpers.isPathAllowed;
        const originalValidateFilePath = this.server.fileHelpers.validateFilePath;
        
        // クロスプラットフォーム対応版で上書き
        this.server.fileHelpers.isPathAllowed = (filePath) => {
          // パスを正規化
          const normalizedPath = this.path.normalize(filePath);
          
          // 許可パスリストも正規化して比較
          return this.config.fileOperations?.allowedPaths.some(allowedPath => {
            const normalizedAllowedPath = this.path.normalize(allowedPath);
            return this.path.isSubPath(normalizedAllowedPath, normalizedPath);
          });
        };
        
        this.server.fileHelpers.validateFilePath = (filePath) => {
          if (!this.server.fileHelpers.isPathAllowed(filePath)) {
            throw new Error(`Access denied: ${filePath} is not in an allowed directory`);
          }
          return this.path.normalize(filePath);
        };
        
        // 新しい関数を追加
        this.server.fileHelpers.expandTilde = (filePath) => {
          return this.path.expandTilde(filePath);
        };
        
        this.server.fileHelpers.isAbsolute = (filePath) => {
          return this.path.isAbsolute(filePath);
        };
        
        this.server.fileHelpers.join = (...paths) => {
          return this.path.join(...paths);
        };
        
        this.server.fileHelpers.resolve = (...paths) => {
          return this.path.resolve(...paths);
        };
        
        this.server.fileHelpers.relative = (from, to) => {
          return this.path.relative(from, to);
        };
      }
      
      this.logger.info('パスユーティリティ統合完了', 'クロスプラットフォームパス操作機能が正常に統合されました');
    } catch (error) {
      this.logger.error('パスユーティリティ統合エラー', error);
      throw error;
    }
  }

  /**
   * 設定変換モジュールを統合
   */
  integrateConfigTransformer() {
    try {
      this.logger.info('設定変換統合', '設定変換機能を統合します');
      
      // 設定APIの追加
      if (this.server.app) {
        // 設定検証APIの追加
        this.server.app.post("/config/validate", async (req, res) => {
          try {
            const { config } = req.body;
            if (!config) {
              return res.status(400).json({ error: "Config object is required" });
            }
            
            try {
              // 設定を変換
              const transformedConfig = this.configTransformer.transformConfig(config);
              
              // パスの検証
              let pathValidation = null;
              if (transformedConfig.fileOperations?.allowedPaths) {
                pathValidation = await this.configTransformer.validatePaths(
                  transformedConfig.fileOperations.allowedPaths
                );
              }
              
              res.json({
                original: config,
                transformed: transformedConfig,
                pathValidation,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              this.logger.error(`Config validation error: ${error.message}`, error);
              res.status(403).json({ error: error.message });
            }
          } catch (error) {
            this.logger.error("Error validating config:", error);
            res.status(500).json({ error: "Failed to validate config" });
          }
        });
        
        // 設定保存APIの追加
        this.server.app.post("/config/save", async (req, res) => {
          try {
            const { config, path: configPath } = req.body;
            if (!config || !configPath) {
              return res.status(400).json({ 
                error: "Config object and path are required" 
              });
            }
            
            try {
              // 設定を変換
              const transformedConfig = this.configTransformer.transformConfig(config);
              
              // 設定ファイルのパスを検証（特別にルートディレクトリへのアクセスを許可）
              const normalizedPath = this.path.normalize(configPath);
              if (!normalizedPath.includes(this.server.appDir)) {
                return res.status(403).json({ 
                  error: "Config path must be within app directory" 
                });
              }
              
              // 設定を保存
              await this.configTransformer.saveConfig(normalizedPath, transformedConfig);
              
              res.json({
                path: normalizedPath,
                success: true,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              this.logger.error(`Config save error: ${error.message}`, error);
              res.status(403).json({ error: error.message });
            }
          } catch (error) {
            this.logger.error("Error saving config:", error);
            res.status(500).json({ error: "Failed to save config" });
          }
        });
      }
      
      this.logger.info('設定変換統合完了', '設定変換機能が正常に統合されました');
    } catch (error) {
      this.logger.error('設定変換統合エラー', error);
      throw error;
    }
  }

  /**
   * プラットフォーム情報APIを公開
   */
  exposePlatformInfo() {
    try {
      this.logger.info('プラットフォーム情報API', 'プラットフォーム情報APIを公開します');
      
      // プラットフォーム情報APIの追加
      if (this.server.app) {
        this.server.app.get("/platform/info", (req, res) => {
          try {
            // プラットフォーム情報を返す
            res.json({
              platform: this.platformInfo.platform,
              isWindows: this.platformInfo.isWindows,
              isMac: this.platformInfo.isMac,
              isLinux: this.platformInfo.isLinux,
              osName: this.platformInfo.osName,
              osVersion: this.platformInfo.osVersion,
              homeDir: this.platformInfo.homeDir,
              tempDir: this.platformInfo.tempDir,
              appDir: this.platformInfo.appDir,
              nodeVersion: this.platformInfo.nodeVersion,
              pathSeparator: this.platformInfo.pathSeparator,
              locale: this.platformInfo.getLocaleInfo(),
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            this.logger.error("Error getting platform info:", error);
            res.status(500).json({ error: "Failed to get platform info" });
          }
        });
      }
      
      this.logger.info('プラットフォーム情報API公開完了', 'プラットフォーム情報APIが正常に公開されました');
    } catch (error) {
      this.logger.error('プラットフォーム情報API公開エラー', error);
      throw error;
    }
  }
}

module.exports = CrossPlatformIntegration;