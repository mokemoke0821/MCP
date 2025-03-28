/**
 * platform-detect.js
 * オペレーティングシステムやプラットフォーム情報を検出するユーティリティ
 */

const os = require('os');
const isWindows = require('is-windows');
const path = require('path');
const fs = require('fs');

/**
 * プラットフォーム情報をまとめたクラス
 */
class PlatformInfo {
  constructor() {
    // OS情報の取得
    this.platform = process.platform;
    this.isWindows = isWindows();
    this.isMac = process.platform === 'darwin';
    this.isLinux = process.platform === 'linux';
    this.osName = this.getOsName();
    this.osVersion = this.getOsVersion();
    
    // パス区切り文字
    this.pathSeparator = path.sep;
    this.delim = path.delimiter;
    
    // ホームディレクトリとテンポラリディレクトリ
    this.homeDir = os.homedir();
    this.tempDir = os.tmpdir();
    
    // 環境変数
    this.env = this.getSanitizedEnv();
    
    // プロセス情報
    this.nodeVersion = process.version;
    this.appDir = this.getAppDirectory();
  }

  /**
   * 現在のOSの名前を取得
   * @returns {string} - OS名
   */
  getOsName() {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        return `Windows ${this.getWindowsVersion()}`;
      case 'darwin':
        return `macOS ${os.release()}`;
      case 'linux':
        return this.getLinuxDistribution() || `Linux ${os.release()}`;
      default:
        return `${platform} ${os.release()}`;
    }
  }

  /**
   * Windows OSのバージョン情報を取得
   * @returns {string} - Windowsのバージョン情報
   */
  getWindowsVersion() {
    if (!this.isWindows) return '';
    
    const release = os.release().split('.');
    
    if (release[0] === '10' && release[1] === '0') {
      if (release[2] >= 22000) {
        return '11';  // Windows 11ビルド番号22000以上
      } else {
        return '10';  // Windows 10
      }
    } else if (release[0] === '6') {
      // Windows Vista以降のバージョンマッピング
      switch (release[1]) {
        case '0': return 'Vista';
        case '1': return '7';
        case '2': return '8';
        case '3': return '8.1';
        default: return release.join('.');
      }
    }
    
    return release.join('.');
  }

  /**
   * Linuxディストリビューション情報を取得（可能な場合）
   * @returns {string|null} - ディストリビューション情報
   */
  getLinuxDistribution() {
    if (!this.isLinux) return null;
    
    try {
      // /etc/os-releaseからディストリビューション情報を読み取る
      if (fs.existsSync('/etc/os-release')) {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        const match = osRelease.match(/PRETTY_NAME="(.+)"/);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      // Ubuntuの場合、lsb_releaseを使用
      if (fs.existsSync('/etc/lsb-release')) {
        const lsbRelease = fs.readFileSync('/etc/lsb-release', 'utf8');
        const match = lsbRelease.match(/DISTRIB_DESCRIPTION="(.+)"/);
        if (match && match[1]) {
          return match[1];
        }
      }
    } catch (error) {
      // エラーが発生した場合は無視
    }
    
    return null;
  }

  /**
   * OSバージョン情報を取得
   * @returns {string} - OSバージョン
   */
  getOsVersion() {
    // Windows 11はプロセスバージョンでは10と表示されるため、
    // 特別な処理を行う
    if (this.isWindows && this.getWindowsVersion() === '11') {
      return '11.0.0';
    }
    
    return os.release();
  }

  /**
   * サニタイズされた環境変数を取得
   * @returns {object} - 安全な環境変数オブジェクト
   */
  getSanitizedEnv() {
    // 重要な環境変数をコピー
    const env = {};
    
    // PATHを含める
    if (process.env.PATH) {
      env.PATH = process.env.PATH;
    }
    
    // ホームディレクトリパス
    if (process.env.HOME || process.env.USERPROFILE) {
      env.HOME = process.env.HOME || process.env.USERPROFILE;
    }
    
    // テンポラリディレクトリパス
    if (process.env.TEMP || process.env.TMP) {
      env.TEMP = process.env.TEMP || process.env.TMP;
    }
    
    // ロケール設定
    if (process.env.LANG) {
      env.LANG = process.env.LANG;
    }
    
    // システムドライブ情報（Windowsの場合）
    if (this.isWindows && process.env.SystemDrive) {
      env.SystemDrive = process.env.SystemDrive;
    }
    
    // ユーザー名
    if (process.env.USER || process.env.USERNAME) {
      env.USER = process.env.USER || process.env.USERNAME;
    }
    
    return env;
  }

  /**
   * アプリケーションディレクトリを取得
   * @returns {string} - アプリケーションのベースディレクトリ
   */
  getAppDirectory() {
    try {
      // 通常は__dirnameを使用するが、このモジュールを使用する側の
      // ルートディレクトリを推測する
      let dir = __dirname;
      
      // このファイルがnode_modulesにインストールされている場合の処理
      if (dir.includes('node_modules')) {
        return path.resolve(dir.split('node_modules')[0]);
      }
      
      // このファイルがmcp-serverディレクトリにある場合の処理
      if (dir.endsWith('mcp-server')) {
        return dir;
      }
      
      // 親ディレクトリを返す
      return path.dirname(dir);
    } catch (error) {
      // エラーが発生した場合はプロセスの作業ディレクトリを返す
      return process.cwd();
    }
  }

  /**
   * プラットフォーム固有のデフォルトログディレクトリを取得
   * @returns {string} - ログディレクトリパス
   */
  getDefaultLogDirectory() {
    if (this.isWindows) {
      return path.join(this.appDir, 'logs');
    } else if (this.isMac) {
      return path.join(this.homeDir, 'Library', 'Logs', 'claude-mcp-server');
    } else {
      return path.join(this.homeDir, '.claude-mcp-server', 'logs');
    }
  }

  /**
   * プラットフォーム固有のデフォルト設定ディレクトリを取得
   * @returns {string} - 設定ディレクトリパス
   */
  getDefaultConfigDirectory() {
    if (this.isWindows) {
      return this.appDir;
    } else if (this.isMac) {
      return path.join(this.homeDir, 'Library', 'Application Support', 'claude-mcp-server');
    } else {
      return path.join(this.homeDir, '.claude-mcp-server');
    }
  }

  /**
   * プラットフォーム固有のデフォルトキャッシュディレクトリを取得
   * @returns {string} - キャッシュディレクトリパス
   */
  getDefaultCacheDirectory() {
    if (this.isWindows) {
      return path.join(this.appDir, 'cache');
    } else if (this.isMac) {
      return path.join(this.homeDir, 'Library', 'Caches', 'claude-mcp-server');
    } else {
      return path.join(this.homeDir, '.cache', 'claude-mcp-server');
    }
  }

  /**
   * 可能であれば環境を検出してロケール情報を取得
   * @returns {object} - ロケール情報
   */
  getLocaleInfo() {
    let locale = 'en-US';
    let encoding = 'utf8';
    
    try {
      // プロセス環境変数からLANGを確認
      if (process.env.LANG) {
        const langMatch = process.env.LANG.match(/^([a-z]{2}_[A-Z]{2})/);
        if (langMatch) {
          locale = langMatch[1].replace('_', '-');
        }
      }
      
      // Windowsの場合はCPANGパラメータをチェック
      if (this.isWindows && process.env.CPANGLANG) {
        locale = process.env.CPANGLANG;
      }
      
      // LC_ALLが設定されている場合はそちらを優先
      if (process.env.LC_ALL) {
        const lcAllMatch = process.env.LC_ALL.match(/^([a-z]{2}_[A-Z]{2})/);
        if (lcAllMatch) {
          locale = lcAllMatch[1].replace('_', '-');
        }
      }
      
      // 日本語環境チェック
      if (locale.startsWith('ja')) {
        return {
          locale: 'ja-JP',
          language: 'ja',
          region: 'JP',
          encoding: 'utf8'
        };
      }
    } catch (error) {
      // エラーが発生した場合はデフォルト値を使用
    }
    
    // ロケール識別子からパース
    const [language, region] = locale.split('-');
    
    return {
      locale,
      language,
      region,
      encoding
    };
  }

  /**
   * システム情報の概要を取得
   * @returns {object} - システム情報の概要
   */
  getSummary() {
    return {
      platform: this.platform,
      osName: this.osName,
      osVersion: this.osVersion,
      homeDir: this.homeDir,
      appDir: this.appDir,
      pathSep: this.pathSeparator,
      locale: this.getLocaleInfo().locale,
      nodeVersion: this.nodeVersion
    };
  }
}

// シングルトンインスタンスを作成・エクスポート
const platformInfo = new PlatformInfo();

module.exports = platformInfo;