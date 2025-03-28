const ThinkTools = require('./src/modules/think-tools');
const WebSearch = require('./src/modules/web-search');
const PathResolver = require('./src/core/path-resolver');

class MCPIntegration {
  constructor(options = {}) {
    this.thinkTools = new ThinkTools(options.thinkTools);
    this.webSearch = new WebSearch(options.webSearch);
    this.options = options;
  }

  /**
   * コンテキスト分析
   * @param {string} text - 分析するテキスト
   * @returns {Object} 分析結果
   */
  analyzeContext(text) {
    return ThinkTools.analyzeContext(text);
  }

  /**
   * テキストの論理的ステップ分割
   * @param {string} text - 分割するテキスト
   * @returns {Array} 分割されたステップ
   */
  breakdownThought(text) {
    return ThinkTools.breakdownThought(text);
  }

  /**
   * Web検索
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object>} 検索結果
   */
  async search(query, options = {}) {
    return this.webSearch.search(query, options);
  }

  /**
   * Webページのコンテンツ取得
   * @param {string} url - 取得するURL
   * @returns {Promise<string>} ページのテキストコンテンツ
   */
  async fetchPageContent(url) {
    return this.webSearch.fetchPageContent(url);
  }

  /**
   * 思考プロセスのログ記録
   * @param {string} logPath - ログファイルのパス
   * @param {Object} thoughtData - ログするデータ
   */
  logThoughtProcess(logPath, thoughtData) {
    ThinkTools.logThoughtProcess(logPath, thoughtData);
  }

  /**
   * パス解決ユーティリティ
   * @returns {PathResolver} パス解決クラス
   */
  getPathResolver() {
    return PathResolver;
  }
}

module.exports = MCPIntegration;
