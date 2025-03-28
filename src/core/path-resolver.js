const path = require('path');
const fs = require('fs');
const os = require('os');

class PathResolver {
  /**
   * クロスプラットフォームでのパス解決
   * @param {...string} pathSegments - パスセグメント
   * @returns {string} 解決された絶対パス
   */
  static resolve(...pathSegments) {
    const basePath = os.homedir();
    return path.resolve(basePath, ...pathSegments);
  }

  /**
   * プラットフォーム固有のパス区切り文字を取得
   * @returns {string} パス区切り文字
   */
  static get pathSeparator() {
    return path.sep;
  }

  /**
   * 安全なファイルパス結合
   * @param {...string} pathSegments - パスセグメント
   * @returns {string} 結合されたパス
   */
  static join(...pathSegments) {
    return path.join(...pathSegments);
  }

  /**
   * ディレクトリの作成（存在しない場合）
   * @param {string} dirPath - 作成するディレクトリのパス
   */
  static ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * モジュールの安全な読み込み
   * @param {string} moduleName - モジュール名
   * @returns {*} 読み込まれたモジュール
   */
  static safeRequire(moduleName) {
    try {
      return require(moduleName);
    } catch (error) {
      console.error(`モジュール ${moduleName} の読み込みに失敗：`, error);
      return null;
    }
  }

  /**
   * アプリケーションのベースディレクトリを取得
   * @returns {string} ベースディレクトリのパス
   */
  static getAppBaseDirectory() {
    return path.dirname(process.mainModule.filename);
  }
}

module.exports = PathResolver;
