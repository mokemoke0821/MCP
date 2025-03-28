const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class WebSearch {
  /**
   * コンストラクタ
   * @param {Object} options - 検索オプション
   */
  constructor(options = {}) {
    this.options = {
      cacheDir: path.join(__dirname, '..', '..', 'cache', 'web-search'),
      cacheTTL: 24 * 60 * 60 * 1000, // 24時間
      providers: ['google', 'bing'],
      ...options
    };

    // キャッシュディレクトリ作成
    if (!fs.existsSync(this.options.cacheDir)) {
      fs.mkdirSync(this.options.cacheDir, { recursive: true });
    }
  }

  /**
   * 検索を実行
   * @param {string} query - 検索クエリ
   * @param {Object} searchOptions - 検索オプション
   * @returns {Promise<Object>} 検索結果
   */
  async search(query, searchOptions = {}) {
    const mergedOptions = { ...this.options, ...searchOptions };
    const cacheKey = this.generateCacheKey(query, mergedOptions);

    // キャッシュを確認
    const cachedResult = this.checkCache(cacheKey);
    if (cachedResult) return cachedResult;

    // 検索プロバイダーを順番に試行
    for (const provider of mergedOptions.providers) {
      try {
        const results = await this.searchProvider(query, provider, mergedOptions);
        
        // 結果をキャッシュ
        this.cacheResults(cacheKey, results);
        
        return results;
      } catch (error) {
        console.warn(`${provider}での検索に失敗:`, error);
        continue;
      }
    }

    throw new Error('すべての検索プロバイダーでの検索に失敗');
  }

  /**
   * 特定のプロバイダーで検索
   * @param {string} query - 検索クエリ
   * @param {string} provider - 検索プロバイダー
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object>} 検索結果
   */
  async searchProvider(query, provider, options) {
    switch (provider) {
      case 'google':
        return this.googleSearch(query, options);
      case 'bing':
        return this.bingSearch(query, options);
      default:
        throw new Error(`未サポートの検索プロバイダー: ${provider}`);
    }
  }

  /**
   * Google検索（シミュレーション）
   * @param {string} query - 検索クエリ
   * @returns {Promise<Object>} 検索結果
   */
  async googleSearch(query, options) {
    // 実際の実装にはAPIキーと適切な検索APIが必要
    const mockResults = {
      provider: 'google',
      query: query,
      results: [
        { title: 'サンプル結果1', url: 'https://example.com/1', snippet: '...' },
        { title: 'サンプル結果2', url: 'https://example.com/2', snippet: '...' }
      ]
    };

    return mockResults;
  }

  /**
   * Bing検索（シミュレーション）
   * @param {string} query - 検索クエリ
   * @returns {Promise<Object>} 検索結果
   */
  async bingSearch(query, options) {
    // 実際の実装にはAPIキーと適切な検索APIが必要
    const mockResults = {
      provider: 'bing',
      query: query,
      results: [
        { title: 'サンプル結果A', url: 'https://example.org/a', snippet: '...' },
        { title: 'サンプル結果B', url: 'https://example.org/b', snippet: '...' }
      ]
    };

    return mockResults;
  }

  /**
   * Webページのコンテンツを取得
   * @param {string} url - 取得するURL
   * @returns {Promise<string>} ページのテキストコンテンツ
   */
  async fetchPageContent(url) {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // テキストコンテンツを抽出（簡易的な実装）
      return $('body').text().trim();
    } catch (error) {
      console.error(`ページ取得エラー: ${url}`, error);
      return '';
    }
  }

  /**
   * キャッシュキーを生成
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {string} キャッシュキー
   */
  generateCacheKey(query, options) {
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, '_');
    return `search_${normalizedQuery}_${JSON.stringify(options)}`;
  }

  /**
   * キャッシュを確認
   * @param {string} cacheKey - キャッシュキー
   * @returns {Object|null} キャッシュされた結果
   */
  checkCache(cacheKey) {
    const cachePath = path.join(this.options.cacheDir, `${cacheKey}.json`);
    
    try {
      if (fs.existsSync(cachePath)) {
        const stats = fs.statSync(cachePath);
        const now = Date.now();
        
        // キャッシュの有効期限をチェック
        if (now - stats.mtime.getTime() < this.options.cacheTTL) {
          const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          return cachedData;
        }
      }
    } catch (error) {
      console.warn('キャッシュ確認中にエラー:', error);
    }
    
    return null;
  }

  /**
   * 検索結果をキャッシュ
   * @param {string} cacheKey - キャッシュキー
   * @param {Object} results - キャッシュする検索結果
   */
  cacheResults(cacheKey, results) {
    const cachePath = path.join(this.options.cacheDir, `${cacheKey}.json`);
    
    try {
      fs.writeFileSync(cachePath, JSON.stringify(results), 'utf8');
    } catch (error) {
      console.error('キャッシュ書き込み中にエラー:', error);
    }
  }
}

module.exports = WebSearch;
