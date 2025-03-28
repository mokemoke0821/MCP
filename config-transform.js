/**
 * config-transform.js
 * 環境に応じて設定ファイルを変換するモジュール
 */

const fs = require('fs-extra');
const path = require('path');
const platformInfo = require('./platform-detect');
const crossPlatformPath = require('./cross-platform-path');

/**
 * 設定ファイルの変換・正規化を行うクラス
 */
class ConfigTransformer {
  constructor() {
    this.platform = process.platform;
    this.isWindows = platformInfo.isWindows;
    this.homeDir = platformInfo.homeDir;
    this.appDir = platformInfo.appDir;
    this.path = crossPlatformPath;
  }

  /**
   * 設定ファイルを読み込み、環境に応じて変換
   * @param {string} configPath - 設定ファイルのパス
   * @param {object} defaultConfig - デフォルト設定（任意）
   * @returns {Promise<object>} - 変換された設定オブジェクト
   */
  async loadConfig(configPath, defaultConfig = null) {
    try {
      const normalizedPath = this.path.normalize(configPath);
      
      // 設定ファイルが存在するか確認
      if (!fs.existsSync(normalizedPath)) {
        if (defaultConfig) {
          // デフォルト設定が提供されている場合は、それを保存して返す
          await this.saveConfig(normalizedPath, defaultConfig);
          return this.transformConfig(defaultConfig);
        }
        throw new Error(`Config file not found: ${normalizedPath}`);
      }
      
      // 設定ファイルの読み込み
      const configContent = fs.readFileSync(normalizedPath, 'utf8');
      
      // JSON解析
      const config = JSON.parse(configContent);
      
      // 設定の変換
      const transformedConfig = this.transformConfig(config);
      
      return transformedConfig;
    } catch (error) {
      if (defaultConfig) {
        return this.transformConfig(defaultConfig);
      }
      throw new Error(`Error loading config: ${error.message}`);
    }
  }

  /**
   * 設定オブジェクトをファイルに保存
   * @param {string} configPath - 設定ファイルのパス
   * @param {object} config - 設定オブジェクト
   * @param {object} options - 保存オプション
   * @returns {Promise<void>}
   */
  async saveConfig(configPath, config, options = {}) {
    try {
      const normalizedPath = this.path.normalize(configPath);
      
      // デフォルトオプション
      const defaultOptions = {
        pretty: true, // きれいに整形するか
        backup: true, // バックアップを作成するか
        ensureDir: true // 親ディレクトリを作成するか
      };
      
      // オプションを結合
      const mergedOptions = { ...defaultOptions, ...options };
      
      // 必要なら親ディレクトリを作成
      if (mergedOptions.ensureDir) {
        const configDir = path.dirname(normalizedPath);
        await fs.ensureDir(configDir);
      }
      
      // 既存の設定ファイルをバックアップ
      if (mergedOptions.backup && fs.existsSync(normalizedPath)) {
        const backupPath = `${normalizedPath}.bak`;
        await fs.copy(normalizedPath, backupPath, { overwrite: true });
      }
      
      // 設定オブジェクトをJSON文字列に変換
      const configJson = mergedOptions.pretty
        ? JSON.stringify(config, null, 2)
        : JSON.stringify(config);
      
      // ファイルに書き込み
      await fs.writeFile(normalizedPath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Error saving config: ${error.message}`);
    }
  }

  /**
   * 設定オブジェクトを現在の環境に合わせて変換
   * @param {object} config - 変換する設定オブジェクト
   * @returns {object} - 変換された設定オブジェクト
   */
  transformConfig(config) {
    if (!config) return {};
    
    // 新しいオブジェクトを作成して変更
    const transformed = JSON.parse(JSON.stringify(config));
    
    // パス関連の設定を正規化
    this.normalizePathsInConfig(transformed);
    
    // プラットフォーム固有の設定を適用
    this.applyPlatformSpecificConfig(transformed);
    
    return transformed;
  }

  /**
   * 設定オブジェクト内のパス関連の値を正規化
   * @param {object} config - 正規化する設定オブジェクト
   * @param {string} prefix - 現在のパス（再帰処理用）
   */
  normalizePathsInConfig(config, prefix = '') {
    if (!config || typeof config !== 'object') return;
    
    // オブジェクトの各プロパティを処理
    for (const key in config) {
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
      
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = config[key];
      
      if (typeof value === 'string') {
        // パスかどうかを推測（キー名ベース）
        const isPathKey = /path|dir|directory|folder|file|location/i.test(key);
        
        // パスを含むと思われる値かどうか
        const containsPathSeparator = value.includes('/') || value.includes('\\');
        const startsWithDot = value.startsWith('./') || value.startsWith('.\\');
        const startsWithTilde = value.startsWith('~');
        
        if (isPathKey || containsPathSeparator || startsWithDot || startsWithTilde) {
          // パスとして扱い、正規化
          // チルダ展開
          let normalizedValue = this.path.expandTilde(value);
          
          // 相対パスを絶対パスに変換
          if (!this.path.isAbsolute(normalizedValue) && startsWithDot) {
            normalizedValue = this.path.resolve(this.appDir, normalizedValue);
          }
          
          // 環境に応じたパス区切り文字に正規化
          normalizedValue = this.path.normalize(normalizedValue);
          
          // 変換結果を設定
          config[key] = normalizedValue;
        }
      } else if (Array.isArray(value)) {
        // 配列の場合、各要素を処理
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          
          if (typeof item === 'string') {
            // パスかどうかを推測（キー名ベース）
            const isPathKey = /paths|dirs|directories|folders|files|locations/i.test(key);
            
            // パスを含むと思われる値かどうか
            const containsPathSeparator = item.includes('/') || item.includes('\\');
            const startsWithDot = item.startsWith('./') || item.startsWith('.\\');
            const startsWithTilde = item.startsWith('~');
            
            if (isPathKey || containsPathSeparator || startsWithDot || startsWithTilde) {
              // パスとして扱い、正規化
              // チルダ展開
              let normalizedItem = this.path.expandTilde(item);
              
              // 相対パスを絶対パスに変換
              if (!this.path.isAbsolute(normalizedItem) && startsWithDot) {
                normalizedItem = this.path.resolve(this.appDir, normalizedItem);
              }
              
              // 環境に応じたパス区切り文字に正規化
              normalizedItem = this.path.normalize(normalizedItem);
              
              // 変換結果を設定
              value[i] = normalizedItem;
            }
          } else if (typeof item === 'object' && item !== null) {
            // オブジェクトの場合は再帰的に処理
            this.normalizePathsInConfig(item, `${fullKey}[${i}]`);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        // オブジェクトの場合は再帰的に処理
        this.normalizePathsInConfig(value, fullKey);
      }
    }
  }

  /**
   * プラットフォーム固有の設定を適用
   * @param {object} config - 適用先の設定オブジェクト
   */
  applyPlatformSpecificConfig(config) {
    if (!config) return;
    
    // プラットフォーム固有の設定セクションがあれば適用
    const platformKey = this.isWindows ? 'windows' : this.platform;
    
    // プラットフォーム設定を取得
    const platformConfig = config[platformKey];
    
    if (platformConfig && typeof platformConfig === 'object') {
      // プラットフォーム固有の設定を適用（浅いマージ）
      for (const key in platformConfig) {
        if (Object.prototype.hasOwnProperty.call(platformConfig, key)) {
          config[key] = platformConfig[key];
        }
      }
      
      // プラットフォームセクションは削除（冗長を避けるため）
      delete config[platformKey];
    }
    
    // デフォルトのパス設定を環境に応じて調整
    if (config.fileOperations && Array.isArray(config.fileOperations.allowedPaths)) {
      // Windowsのデフォルトパスを修正
      if (this.isWindows) {
        config.fileOperations.allowedPaths = config.fileOperations.allowedPaths.map(allowedPath => {
          // *nix形式のパスをWindows形式に変換
          if (allowedPath.startsWith('/')) {
            return this.path.normalize(allowedPath);
          }
          return allowedPath;
        });
      }
    }
    
    // サーバーのコマンド許可リストを環境に応じて調整
    if (config.security && Array.isArray(config.security.allowedCommands)) {
      if (this.isWindows) {
        // Windowsの場合はPowerShellコマンドを追加
        const hasWildcard = config.security.allowedCommands.includes('*');
        if (!hasWildcard) {
          // PowerShell固有コマンドが不足していれば追加
          const psCommands = [
            'Get-Content', 'Set-Content', 'Get-ChildItem', 'Get-Date',
            'Set-Date', 'Write-Output'
          ];
          
          for (const cmd of psCommands) {
            if (!config.security.allowedCommands.includes(cmd)) {
              config.security.allowedCommands.push(cmd);
            }
          }
          
          // PowerShellそのものを許可
          if (!config.security.allowedCommands.includes('powershell')) {
            config.security.allowedCommands.push('powershell');
          }
        }
      } else {
        // Unix系の場合はシェルコマンドを追加
        const hasWildcard = config.security.allowedCommands.includes('*');
        if (!hasWildcard) {
          // Unix系コマンドが不足していれば追加
          const unixCommands = [
            'cat', 'ls', 'cp', 'mv', 'rm', 'mkdir', 'date', 'echo'
          ];
          
          for (const cmd of unixCommands) {
            if (!config.security.allowedCommands.includes(cmd)) {
              config.security.allowedCommands.push(cmd);
            }
          }
          
          // シェル関連コマンドを許可
          if (!config.security.allowedCommands.includes('bash')) {
            config.security.allowedCommands.push('bash');
          }
          if (!config.security.allowedCommands.includes('sh')) {
            config.security.allowedCommands.push('sh');
          }
        }
      }
    }
    
    // ロケール設定を環境に応じて調整
    if (!config.locale) {
      config.locale = platformInfo.getLocaleInfo().locale;
    }
    
    return config;
  }

  /**
   * 指定されたパス設定をアクセス可能か検証
   * @param {Array<string>} paths - 検証するパスの配列
   * @returns {Promise<object>} - 検証結果
   */
  async validatePaths(paths) {
    if (!paths || !Array.isArray(paths)) {
      return { valid: false, error: 'No paths provided or invalid format' };
    }
    
    const results = [];
    
    for (const pathItem of paths) {
      const normalizedPath = this.path.normalize(pathItem);
      
      try {
        // パスが存在するか確認
        const exists = fs.existsSync(normalizedPath);
        
        if (!exists) {
          results.push({
            path: normalizedPath,
            valid: false,
            error: 'Path does not exist'
          });
          continue;
        }
        
        // ディレクトリかどうか確認
        const isDirectory = fs.statSync(normalizedPath).isDirectory();
        
        if (!isDirectory) {
          results.push({
            path: normalizedPath,
            valid: false,
            error: 'Path is not a directory'
          });
          continue;
        }
        
        // アクセス権限を確認
        try {
          // 読み取りと書き込みの権限をチェック
          await fs.access(normalizedPath, fs.constants.R_OK | fs.constants.W_OK);
          
          results.push({
            path: normalizedPath,
            valid: true,
            isDirectory: true,
            canRead: true,
            canWrite: true
          });
        } catch (accessError) {
          try {
            // 読み取り権限のみをチェック
            await fs.access(normalizedPath, fs.constants.R_OK);
            
            results.push({
              path: normalizedPath,
              valid: true,
              isDirectory: true,
              canRead: true,
              canWrite: false,
              error: 'Write permission denied'
            });
          } catch (readError) {
            results.push({
              path: normalizedPath,
              valid: false,
              isDirectory: true,
              canRead: false,
              canWrite: false,
              error: 'Read and write permissions denied'
            });
          }
        }
      } catch (error) {
        results.push({
          path: normalizedPath,
          valid: false,
          error: `Validation error: ${error.message}`
        });
      }
    }
    
    // 全体の検証結果をまとめる
    const allValid = results.every(result => result.valid);
    
    return {
      valid: allValid,
      paths: results
    };
  }

  /**
   * 設定をマージする
   * @param {object} target - ターゲット設定
   * @param {object} source - マージ元設定
   * @param {boolean} overwrite - 既存の値を上書きするか
   * @returns {object} - マージされた設定
   */
  mergeConfigs(target, source, overwrite = true) {
    if (!target) return source ? { ...source } : {};
    if (!source) return { ...target };
    
    const result = { ...target };
    
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      
      // ターゲットに存在しないか、上書きモードの場合
      if (!(key in result) || overwrite) {
        if (
          typeof source[key] === 'object' && 
          source[key] !== null && 
          !Array.isArray(source[key]) &&
          typeof result[key] === 'object' &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          // オブジェクト同士の場合は再帰的にマージ
          result[key] = this.mergeConfigs(result[key], source[key], overwrite);
        } else {
          // それ以外はコピー
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
}

// シングルトンインスタンスを作成してエクスポート
const configTransformer = new ConfigTransformer();

module.exports = configTransformer;