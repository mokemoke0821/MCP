/**
 * cross-platform-path.js
 * クロスプラットフォーム互換性のあるパス操作ユーティリティ
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const pathType = require('path-type');
const platformInfo = require('./platform-detect');

/**
 * クロスプラットフォーム互換のパス操作をするクラス
 */
class CrossPlatformPath {
  constructor() {
    this.platform = process.platform;
    this.sep = path.sep;
    this.isWindows = platformInfo.isWindows;
    this.appDir = platformInfo.appDir;
    this.homeDir = platformInfo.homeDir;
  }

  /**
   * パスを正規化（OS固有の区切り文字に変換）
   * @param {string} inputPath - 入力パス
   * @returns {string} - 正規化されたパス
   */
  normalize(inputPath) {
    if (!inputPath) return '';
    
    // null, undefined, 空文字列の処理
    if (!inputPath) return '';
    
    // 既にStringでなければ変換
    const pathStr = String(inputPath);
    
    // Windowsでよく発生する円記号表記をスラッシュに正規化
    const unifiedPath = this.isWindows ? pathStr.replace(/\\/g, '/') : pathStr;
    
    // 環境に応じたパス区切り文字を用いて正規化
    return path.normalize(unifiedPath);
  }

  /**
   * 複数のパスセグメントを結合
   * @param {...string} segments - 結合するパスセグメント
   * @returns {string} - 結合されたパス
   */
  join(...segments) {
    return path.join(...segments);
  }

  /**
   * 絶対パスを解決
   * @param {...string} segments - 解決するパスセグメント
   * @returns {string} - 解決された絶対パス
   */
  resolve(...segments) {
    return path.resolve(...segments);
  }

  /**
   * 相対パスを作成
   * @param {string} from - 基準パス
   * @param {string} to - 対象パス
   * @returns {string} - 相対パス
   */
  relative(from, to) {
    return path.relative(this.normalize(from), this.normalize(to));
  }

  /**
   * パスがサブパスかどうか確認
   * @param {string} parent - 親パス
   * @param {string} child - 子パス候補
   * @returns {boolean} - 子パスであるかどうか
   */
  isSubPath(parent, child) {
    const normalizedParent = this.normalize(parent);
    const normalizedChild = this.normalize(child);
    
    // 絶対パスでなければ解決
    const resolvedParent = path.isAbsolute(normalizedParent) ? normalizedParent : path.resolve(normalizedParent);
    const resolvedChild = path.isAbsolute(normalizedChild) ? normalizedChild : path.resolve(normalizedChild);
    
    // Windowsでの大文字小文字を無視した比較
    if (this.isWindows) {
      return resolvedChild.toLowerCase().startsWith(resolvedParent.toLowerCase() + this.sep) || 
             resolvedChild.toLowerCase() === resolvedParent.toLowerCase();
    }
    
    // UNIXベースシステムでの比較
    return resolvedChild.startsWith(resolvedParent + this.sep) || 
           resolvedChild === resolvedParent;
  }

  /**
   * パスが絶対パスかどうか
   * @param {string} inputPath - チェックするパス
   * @returns {boolean} - 絶対パスならtrue
   */
  isAbsolute(inputPath) {
    return path.isAbsolute(this.normalize(inputPath));
  }

  /**
   * URLをローカルファイルパスに変換
   * @param {string} url - 変換するURL
   * @returns {string} - ローカルファイルパス
   */
  fromFileURL(url) {
    if (!url) return '';
    
    if (!url.startsWith('file://')) {
      return url; // file: URLでない場合はそのまま返す
    }
    
    try {
      // 'file://' プレフィックスを削除
      let localPath = url.substring(7);
      
      // Windowsの場合、ホスト部分を処理
      if (this.isWindows) {
        if (localPath.startsWith('/')) {
          // '/C:/' のようなパスから、先頭のスラッシュを削除
          localPath = localPath.substring(1);
        }
      }
      
      // URLデコード処理（%20を空白に戻すなど）
      localPath = decodeURIComponent(localPath);
      
      // 正規化して返す
      return this.normalize(localPath);
    } catch (error) {
      console.error(`Error converting file URL to path: ${error.message}`);
      return '';
    }
  }

  /**
   * ローカルファイルパスをURLに変換
   * @param {string} localPath - 変換するローカルパス
   * @returns {string} - file: URL
   */
  toFileURL(localPath) {
    if (!localPath) return '';
    
    try {
      // パスを正規化
      const normalizedPath = this.normalize(localPath);
      
      // 絶対パスに変換
      const absolutePath = path.isAbsolute(normalizedPath) 
        ? normalizedPath 
        : path.resolve(normalizedPath);
      
      // file:// URLに変換
      // Windowsの場合、先頭に'/'を追加
      let fileURL = 'file://';
      if (this.isWindows && !absolutePath.startsWith('/')) {
        fileURL += '/';
      }
      
      // コンポーネントをURL符号化
      const components = absolutePath.split(this.sep);
      const encodedComponents = components.map(component => encodeURIComponent(component));
      
      // Windows形式からUNIX形式に変換（\を/に変換）
      return fileURL + encodedComponents.join('/');
    } catch (error) {
      console.error(`Error converting path to file URL: ${error.message}`);
      return '';
    }
  }

  /**
   * プラットフォーム間で統一された一時ファイルパスを生成
   * @param {string} prefix - ファイル名プレフィックス
   * @param {string} suffix - ファイル名サフィックス
   * @returns {string} - 一時ファイルのパス
   */
  getTempFilePath(prefix = 'temp', suffix = '') {
    const tempDir = os.tmpdir();
    const timestamp = new Date().getTime();
    const randomNum = Math.floor(Math.random() * 10000);
    const fileName = `${prefix}-${timestamp}-${randomNum}${suffix}`;
    
    return this.join(tempDir, fileName);
  }

  /**
   * 環境変数でサポートされているホームディレクトリを取得（~展開用）
   * @returns {string} - ホームディレクトリパス
   */
  getHomeDir() {
    return this.homeDir;
  }

  /**
   * チルダ(~)を含むパスを展開
   * @param {string} inputPath - 展開するパス
   * @returns {string} - 展開されたパス
   */
  expandTilde(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') return '';
    
    const homeDir = this.getHomeDir();
    
    // パスが~で始まる場合、ホームディレクトリに置き換え
    if (inputPath === '~' || inputPath === '~/') {
      return homeDir;
    } else if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
      return this.join(homeDir, inputPath.substring(2));
    }
    
    return inputPath;
  }

  /**
   * パスが存在するかチェック
   * @param {string} inputPath - チェックするパス
   * @returns {boolean} - 存在すればtrue
   */
  exists(inputPath) {
    try {
      return fs.existsSync(this.normalize(inputPath));
    } catch (error) {
      return false;
    }
  }

  /**
   * パスがディレクトリかどうかチェック
   * @param {string} inputPath - チェックするパス
   * @returns {boolean} - ディレクトリならtrue
   */
  isDirectory(inputPath) {
    try {
      const normalizedPath = this.normalize(inputPath);
      return fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * パスがファイルかどうかチェック
   * @param {string} inputPath - チェックするパス
   * @returns {boolean} - ファイルならtrue
   */
  isFile(inputPath) {
    try {
      const normalizedPath = this.normalize(inputPath);
      return fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * パスからディレクトリ名を取得
   * @param {string} inputPath - パス
   * @returns {string} - ディレクトリ名
   */
  dirname(inputPath) {
    return path.dirname(this.normalize(inputPath));
  }

  /**
   * パスからベース名を取得
   * @param {string} inputPath - パス
   * @param {string} ext - 削除する拡張子（オプション）
   * @returns {string} - ベース名
   */
  basename(inputPath, ext) {
    return path.basename(this.normalize(inputPath), ext);
  }

  /**
   * パスから拡張子を取得
   * @param {string} inputPath - パス
   * @returns {string} - 拡張子
   */
  extname(inputPath) {
    return path.extname(this.normalize(inputPath));
  }

  /**
   * パスを解析して構成部分を取得
   * @param {string} inputPath - パス
   * @returns {object} - 解析結果（root, dir, base, name, ext）
   */
  parse(inputPath) {
    return path.parse(this.normalize(inputPath));
  }

  /**
   * 構成部分からパスを生成
   * @param {object} pathObj - パス構成オブジェクト
   * @returns {string} - 生成されたパス
   */
  format(pathObj) {
    return path.format(pathObj);
  }

  /**
   * URLからクエリパラメータを抽出
   * @param {string} url - パースするURL
   * @returns {object} - クエリパラメータオブジェクト
   */
  parseQuery(url) {
    if (!url || !url.includes('?')) return {};
    
    try {
      const queryString = url.split('?')[1];
      const pairs = queryString.split('&');
      const result = {};
      
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        result[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
      
      return result;
    } catch (error) {
      return {};
    }
  }

  /**
   * 環境に応じたパスをサニタイズ（安全な形に変換）
   * @param {string} inputPath - サニタイズするパス
   * @returns {string} - サニタイズされたパス
   */
  sanitize(inputPath) {
    if (!inputPath) return '';
    
    // パスを正規化
    let sanitizedPath = this.normalize(inputPath);
    
    // Windowsの場合、禁止文字を置換
    if (this.isWindows) {
      // Windowsのファイル名に使用できない文字を置換
      sanitizedPath = sanitizedPath.replace(/[<>:"\/\\|?*]/g, '_');
    } else {
      // Unix系の場合、主に/を置換
      sanitizedPath = sanitizedPath.replace(/\//g, '_');
    }
    
    return sanitizedPath;
  }

  /**
   * パスをプラットフォーム間で安全に保存可能な形式に変換
   * @param {string} inputPath - 変換するパス
   * @returns {string} - 安全なパス文字列
   */
  toSafeString(inputPath) {
    if (!inputPath) return '';
    
    // 絶対パスの場合、ルート部分（C:\や/など）を特殊な形式に変換
    let safeString = this.normalize(inputPath);
    
    // Windowsドライブ文字の特殊処理
    if (this.isWindows && /^[A-Za-z]:/.test(safeString)) {
      safeString = safeString.replace(/^([A-Za-z]):/, '_drive_$1_');
    } else if (safeString.startsWith('/')) {
      // Unix系絶対パスの特殊処理
      safeString = safeString.replace(/^\//, '_root_');
    }
    
    // パス区切り文字を_で置換
    safeString = safeString.replace(/[\\\/]/g, '_');
    
    return safeString;
  }

  /**
   * 安全なパス文字列を元のパス形式に戻す
   * @param {string} safeString - 安全なパス文字列
   * @returns {string} - 元のパス形式
   */
  fromSafeString(safeString) {
    if (!safeString) return '';
    
    let originalPath = safeString;
    
    // ドライブ文字の復元
    originalPath = originalPath.replace(/^_drive_([A-Za-z])_/, '$1:' + this.sep);
    
    // Unix系ルートの復元
    originalPath = originalPath.replace(/^_root_/, '/');
    
    // _をパス区切り文字に置換
    originalPath = originalPath.replace(/_/g, this.sep);
    
    // 重複するパス区切り文字を単一に正規化
    return this.normalize(originalPath);
  }

  /**
   * 2つのパスを比較（大文字小文字の区別はOSに依存）
   * @param {string} path1 - 1つ目のパス
   * @param {string} path2 - 2つ目のパス
   * @returns {boolean} - パスが同じならtrue
   */
  equals(path1, path2) {
    const norm1 = this.normalize(path1);
    const norm2 = this.normalize(path2);
    
    if (this.isWindows) {
      // Windowsでは大文字小文字を区別しない
      return norm1.toLowerCase() === norm2.toLowerCase();
    } else {
      // Unix系では大文字小文字を区別する
      return norm1 === norm2;
    }
  }
}

// シングルトンインスタンスを作成してエクスポート
const crossPlatformPath = new CrossPlatformPath();

module.exports = crossPlatformPath;