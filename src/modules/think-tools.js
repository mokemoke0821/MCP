const fs = require('fs');
const path = require('path');

class ThinkTools {
  /**
   * テキストのコンテキスト分析
   * @param {string} text - 分析するテキスト
   * @returns {Object} 分析結果
   */
  static analyzeContext(text) {
    return {
      length: text.length,
      wordCount: text.trim().split(/\s+/).length,
      sentenceCount: text.match(/[.!?]+/g)?.length || 0,
      keyPhrases: this.extractKeyPhrases(text)
    };
  }

  /**
   * テキストから重要フレーズを抽出
   * @param {string} text - 入力テキスト
   * @returns {string[]} 重要フレーズの配列
   */
  static extractKeyPhrases(text, options = {}) {
    const {
      minWordLength = 3,
      maxPhrases = 5
    } = options;

    // 簡易的なキーフレーズ抽出
    const words = text.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length >= minWordLength);

    // 単語の出現頻度をカウント
    const wordFrequency = words.reduce((freq, word) => {
      freq[word] = (freq[word] || 0) + 1;
      return freq;
    }, {});

    // 頻度の高い単語をソート
    return Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPhrases)
      .map(entry => entry[0]);
  }

  /**
   * テキストを論理的なステップに分割
   * @param {string} text - 分割するテキスト
   * @returns {string[]} 分割されたステップ
   */
  static breakdownThought(text) {
    // 文章を文単位で分割
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    return sentences.map((sentence, index) => ({
      step: index + 1,
      content: sentence.trim(),
      analysis: this.analyzeContext(sentence)
    }));
  }

  /**
   * 思考プロセスのログを記録
   * @param {string} logPath - ログファイルのパス
   * @param {Object} thoughtData - ログする思考データ
   */
  static logThoughtProcess(logPath, thoughtData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...thoughtData
    };

    try {
      // ログディレクトリが存在しない場合は作成
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // ログファイルに追記
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (error) {
      console.error('思考プロセスのログ記録に失敗:', error);
    }
  }
}

module.exports = ThinkTools;
