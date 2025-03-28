/**
 * PowerShellコマンド直接実行テスト (test-direct-powershell.js)
 * MCPサーバー第3フェーズ改善のテスト用スクリプト
 */

// 拡張MCPモジュールをインポート
// このファイルはMCPサーバーと同じディレクトリに配置する前提
const enhancedMcp = require('./enhanced-mcp');

// 非同期関数でテストを実行
async function runTests() {
  console.log('========================================');
  console.log('PowerShellコマンド直接実行テスト 開始');
  console.log('========================================\n');
  
  const testResults = {
    basicOutput: false,
    japaneseOutput: false,
    encodingCommand: false,
    pipelineCommand: false,
    semicolonCommand: false,
    complexCommand: false
  };
  
  try {
    // テスト1: 基本的な出力テスト
    console.log('テスト1: 基本的な出力テスト');
    const basicTest = await runPowerShellCommand('Write-Output "Hello, World!"');
    testResults.basicOutput = basicTest.success;
    console.log(`出力: ${basicTest.stdout}`);
    console.log(`結果: ${basicTest.success ? '成功' : '失敗'}`);
    console.log('----------------------------------------\n');
    
    // テスト2: 日本語出力テスト
    console.log('テスト2: 日本語出力テスト');
    const japaneseTest = await runPowerShellCommand('Write-Output "こんにちは、世界！"');
    testResults.japaneseOutput = japaneseTest.success && japaneseTest.stdout.includes('こんにちは');
    console.log(`出力: ${japaneseTest.stdout}`);
    console.log(`結果: ${testResults.japaneseOutput ? '成功' : '失敗'}`);
    console.log('----------------------------------------\n');
    
    // テスト3: エンコーディングコマンドテスト
    console.log('テスト3: エンコーディングコマンドテスト');
    const encodingTest = await runPowerShellCommand('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output "日本語テスト"');
    testResults.encodingCommand = encodingTest.success && encodingTest.stdout.includes('日本語');
    console.log(`出力: ${encodingTest.stdout}`);
    console.log(`結果: ${testResults.encodingCommand ? '成功' : '失敗'}`);
    console.log('----------------------------------------\n');
    
    // テスト4: パイプラインを含むコマンドテスト
    console.log('テスト4: パイプラインを含むコマンドテスト');
    const pipelineTest = await runPowerShellCommand('Get-Process | Select-Object -First 3');
    testResults.pipelineCommand = pipelineTest.success && pipelineTest.stdout.length > 0;
    console.log(`出力: ${pipelineTest.stdout.substring(0, 200)}...`); // 出力が長い場合は省略
    console.log(`結果: ${testResults.pipelineCommand ? '成功' : '失敗'}`);
    console.log('----------------------------------------\n');
    
    // テスト5: セミコロンを含むコマンドテスト
    console.log('テスト5: セミコロンを含むコマンドテスト');
    const semicolonTest = await runPowerShellCommand('Get-Date; Write-Output "コマンド実行完了"');
    testResults.semicolonCommand = semicolonTest.success && semicolonTest.stdout.includes('コマンド実行完了');
    console.log(`出力: ${semicolonTest.stdout}`);
    console.log(`結果: ${testResults.semicolonCommand ? '成功' : '失敗'}`);
    console.log('----------------------------------------\n');
    
    // テスト6: 複雑なコマンドテスト
    console.log('テスト6: 複雑なコマンドテスト');
    const complexTest = await runPowerShellCommand('Get-Process | Where-Object { $_.CPU -gt 0 } | Select-Object -First 2 | Format-Table Name, CPU');
    testResults.complexCommand = complexTest.success && complexTest.stdout.length > 0;
    console.log(`出力: ${complexTest.stdout}`);
    console.log(`結果: ${testResults.complexCommand ? '成功' : '失敗'}`);
    console.log('----------------------------------------\n');
    
    // テスト結果の集計
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(result => result).length;
    
    console.log('========================================');
    console.log('テスト結果サマリー');
    console.log('========================================');
    console.log(`合計テスト数: ${totalTests}`);
    console.log(`成功したテスト: ${passedTests}`);
    console.log(`失敗したテスト: ${totalTests - passedTests}`);
    console.log(`成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n✓ 全てのテストが成功しました！');
    } else {
      console.log('\n✗ 一部のテストが失敗しました。');
      // 失敗したテストを表示
      Object.entries(testResults).forEach(([test, result]) => {
        if (!result) {
          console.log(`  - ${test}: 失敗`);
        }
      });
    }
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// PowerShellコマンドを実行する関数
async function runPowerShellCommand(command) {
  try {
    // 拡張モジュールのPowerShellプロセス実行関数を使用
    const ps = enhancedMcp.startPowerShellProcess(command);
    
    let stdout = '';
    let stderr = '';
    
    // 標準出力を収集
    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // 標準エラー出力を収集
    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // プロセスの終了を待機
    const exitCode = await new Promise((resolve) => {
      ps.on('close', (code) => {
        resolve(code);
      });
    });
    
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      success: exitCode === 0
    };
  } catch (error) {
    console.error('コマンド実行エラー:', error);
    return {
      stdout: '',
      stderr: error.toString(),
      exitCode: 1,
      success: false
    };
  }
}

// テストを実行
runTests();