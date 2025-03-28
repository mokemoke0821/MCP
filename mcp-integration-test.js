const MCPIntegration = require('./mcp-integration');
const fs = require('fs');
const path = require('path');

async function testMCPIntegration() {
  console.log('MCPインテグレーションテストを開始します');

  // MCPインテグレーションのインスタンスを作成
  const mcp = new MCPIntegration();

  // コンテキスト分析のテスト
  console.log('\n1. コンテキスト分析テスト:');
  const sampleText = 'Claudeは高度な人工知能アシスタントです。革新的な対話能力を持っています。';
  const contextAnalysis = mcp.analyzeContext(sampleText);
  console.log('分析結果:', JSON.stringify(contextAnalysis, null, 2));

  // 思考プロセス分割のテスト
  console.log('\n2. 思考プロセス分割テスト:');
  const thoughtBreakdown = mcp.breakdownThought(sampleText);
  console.log('分割結果:', JSON.stringify(thoughtBreakdown, null, 2));

  // Web検索のテスト
  console.log('\n3. Web検索テスト:');
  try {
    const searchResults = await mcp.search('人工知能の最新動向');
    console.log('検索結果:', JSON.stringify(searchResults, null, 2));
  } catch (error) {
    console.error('Web検索テストでエラー:', error);
  }

  // Webページコンテンツ取得のテスト
  console.log('\n4. Webページコンテンツ取得テスト:');
  try {
    const pageContent = await mcp.fetchPageContent('https://www.anthropic.com');
    console.log('ページコンテンツ（先頭200文字）:', pageContent.slice(0, 200));
  } catch (error) {
    console.error('ページコンテンツ取得テストでエラー:', error);
  }

  // 思考プロセスのログ記録テスト
  console.log('\n5. 思考プロセスログ記録テスト:');
  try {
    const logPath = path.join(__dirname, 'logs', 'thought-process.log');
    
    // ログディレクトリが存在しない場合は作成
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    mcp.logThoughtProcess(logPath, {
      topic: '人工知能の将来',
      insights: ['高度な対話能力', '倫理的AI']
    });
    console.log('ログ記録completed');
    
    // ログファイルの内容を確認
    const logContent = fs.readFileSync(logPath, 'utf8');
    console.log('ログファイルの内容:', logContent);
  } catch (error) {
    console.error('ログ記録テストでエラー:', error);
  }

  // パス解決ユーティリティのテスト
  console.log('\n6. パス解決ユーティリティテスト:');
  const PathResolver = mcp.getPathResolver();
  console.log('ホームディレクトリ:', PathResolver.resolve());
  console.log('パス区切り文字:', PathResolver.pathSeparator);

  console.log('\nMCPインテグレーションテスト完了');
}

// テストの実行
testMCPIntegration().catch(error => {
  console.error('テスト中に致命的なエラーが発生:', error);
});
