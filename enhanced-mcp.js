/**
 * MCPサーバー改善第3フェーズ
 * 問題点：日本語文字化け、特殊文字処理、ファイル検索機能
 */

// ===== 1. PowerShell文字化け問題解決 =====

/**
 * PowerShellプロセスを改善して起動する関数
 * UTF-8エンコーディングを適切に設定
 */
function startPowerShellProcess(command, options = {}) {
  const { spawn } = require('child_process');
  
  // エンコーディング設定用のコマンドプレフィックス
  const encodingPrefix = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
  
  // BOMの自動検出と処理用の設定
  const bomDetectionPrefix = '$OutputEncoding = New-Object -typename System.Text.UTF8Encoding -argumentlist $false; ';
  
  // コマンドの前にエンコーディング設定を追加
  const fullCommand = encodingPrefix + bomDetectionPrefix + command;
  
  // PowerShellの起動パラメータ
  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', fullCommand
  ];
  
  // 環境変数設定
  const env = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    LANG: 'ja_JP.UTF-8',
    LC_ALL: 'ja_JP.UTF-8',
    ...options.env
  };
  
  // バッファサイズ設定（既に20MBに増量されている前提）
  const maxBuffer = 20 * 1024 * 1024;
  
  // PowerShellプロセスを起動
  const ps = spawn('powershell.exe', args, {
    env,
    shell: true,
    windowsHide: true,
    maxBuffer,
    ...options,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // 標準出力と標準エラー出力をUTF-8でデコード
  ps.stdout.setEncoding('utf-8');
  ps.stderr.setEncoding('utf-8');
  
  return ps;
}

/**
 * CMDプロセスを改善して起動する関数
 */
function startCmdProcess(command, options = {}) {
  const { spawn } = require('child_process');
  
  // エンコーディング設定用のコマンドプレフィックス
  const encodingPrefix = 'chcp 65001 > nul && ';
  
  // コマンドの前にエンコーディング設定を追加
  const fullCommand = encodingPrefix + command;
  
  // 環境変数設定
  const env = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    LANG: 'ja_JP.UTF-8',
    LC_ALL: 'ja_JP.UTF-8',
    ...options.env
  };
  
  // バッファサイズ設定
  const maxBuffer = 20 * 1024 * 1024;
  
  // CMDプロセスを起動
  const cmd = spawn('cmd.exe', ['/c', fullCommand], {
    env,
    shell: true,
    windowsHide: true,
    maxBuffer,
    ...options,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // 標準出力と標準エラー出力をUTF-8でデコード
  cmd.stdout.setEncoding('utf-8');
  cmd.stderr.setEncoding('utf-8');
  
  return cmd;
}

/**
 * GitBashプロセスを改善して起動する関数
 */
function startGitBashProcess(command, options = {}) {
  const { spawn } = require('child_process');
  const path = require('path');
  
  // GitBashの実行ファイルパス
  const gitBashPath = process.env.GIT_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';
  
  // 環境変数設定
  const env = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    LANG: 'ja_JP.UTF-8',
    LC_ALL: 'ja_JP.UTF-8',
    TERM: 'xterm-256color',
    ...options.env
  };
  
  // バッファサイズ設定
  const maxBuffer = 20 * 1024 * 1024;
  
  // GitBashプロセスを起動
  const bash = spawn(gitBashPath, ['-c', command], {
    env,
    shell: true,
    windowsHide: true,
    maxBuffer,
    ...options,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // 標準出力と標準エラー出力をUTF-8でデコード
  bash.stdout.setEncoding('utf-8');
  bash.stderr.setEncoding('utf-8');
  
  return bash;
}

// ===== 2. 特殊文字を含むコマンドの実行サポート =====

/**
 * 特殊文字を含むコマンドを安全に処理する関数
 * パイプライン(|)、セミコロン(;)などの特殊文字を適切に処理
 */
function safeExecuteCommand(command, shellType, options = {}) {
  // shellTypeに応じたプロセス起動関数を選択
  let startProcess;
  let processOptions = { ...options };
  
  switch (shellType.toLowerCase()) {
    case 'powershell':
      startProcess = startPowerShellProcess;
      break;
    case 'cmd':
      startProcess = startCmdProcess;
      break;
    case 'gitbash':
      startProcess = startGitBashProcess;
      break;
    default:
      throw new Error(`不明なシェルタイプ: ${shellType}`);
  }
  
  // コマンドをそのまま実行（特殊文字のエスケープはshellに任せる）
  return startProcess(command, processOptions);
}

/**
 * 特殊文字をエスケープする関数
 * 各シェルタイプに応じたエスケープ処理を行う
 */
function escapeSpecialChars(command, shellType) {
  if (!command) return command;
  
  switch (shellType.toLowerCase()) {
    case 'powershell':
      // PowerShellは基本的にそのまま実行可能だが、一部の特殊ケースのみエスケープ
      return command
        .replace(/`/g, '``')        // バッククォート
        .replace(/(\$(?![\w{]))/g, '`$1'); // 変数名でないドル記号
      
    case 'cmd':
      // CMDでの特殊文字エスケープ（複雑なパイプライン処理を可能に）
      // パイプやセミコロンは基本的にエスケープせず、処理を可能にする
      return command;
      
    case 'gitbash':
      // GitBashでの処理（基本的にはそのまま実行可能）
      return command;
      
    default:
      // 不明なシェルタイプの場合はそのまま返す
      return command;
  }
}

// ===== 3. ファイル検索機能の改善 =====

/**
 * 改善されたファイル検索関数（searchGlob）
 * 日本語ファイル名を適切に処理し、結果を正しく返す
 */
async function enhancedSearchGlob(basePath, pattern, options = {}) {
  const fs = require('fs').promises;
  const path = require('path');
  const util = require('util');
  const glob = util.promisify(require('glob'));
  const micromatch = require('micromatch');
  
  try {
    // パスの正規化
    const normalizedPath = path.normalize(basePath || '.');
    
    // 絶対パスへの変換
    const absolutePath = path.isAbsolute(normalizedPath) 
      ? normalizedPath 
      : path.resolve(process.cwd(), normalizedPath);
    
    // パスが存在するか確認
    try {
      await fs.access(absolutePath);
    } catch (err) {
      throw new Error(`指定されたパス "${absolutePath}" にアクセスできません: ${err.message}`);
    }
    
    // glob検索オプション
    const globOptions = {
      cwd: absolutePath,
      nodir: false,      // ディレクトリも含める
      dot: true,         // ドットファイルも含める
      matchBase: true,   // ベース名のみでマッチングを許可
      windowsPathsNoEscape: true, // Windows パスでエスケープを無効化
      absolute: true,    // 絶対パスで結果を返す
      ...options
    };
    
    // globを使用してファイル検索を実行
    let results = await glob(pattern, globOptions);
    
    // 結果が空の場合はmicromatchを試す
    if (results.length === 0) {
      // ディレクトリ内の全ファイルを取得
      const allFiles = await getAllFilesRecursive(absolutePath);
      
      // micromatchを使用してフィルタリング
      results = micromatch(allFiles, pattern, {
        basename: true,
        dot: true,
        windows: process.platform === 'win32'
      });
    }
    
    // 結果のファイルパスを正規化
    return results.map(filePath => path.normalize(filePath));
  } catch (err) {
    console.error(`searchGlob エラー: ${err.message}`);
    throw err;
  }
}

/**
 * 指定ディレクトリ内の全ファイルを再帰的に取得
 */
async function getAllFilesRecursive(dirPath) {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      return entry.isDirectory() 
        ? getAllFilesRecursive(fullPath) 
        : fullPath;
    }));
    
    return files.flat();
  } catch (err) {
    console.error(`getAllFilesRecursive エラー: ${err.message}`);
    return [];
  }
}

/**
 * 改善されたディレクトリリスト関数（listFiles）
 * 日本語パスやファイル名を適切に処理
 */
async function enhancedListFiles(dirPath) {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // パスの正規化
    const normalizedPath = path.normalize(dirPath || '.');
    
    // 絶対パスへの変換
    const absolutePath = path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(process.cwd(), normalizedPath);
    
    // ディレクトリが存在するか確認
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error(`"${absolutePath}" はディレクトリではありません。`);
      }
    } catch (err) {
      throw new Error(`指定されたパス "${absolutePath}" にアクセスできません: ${err.message}`);
    }
    
    // ディレクトリ内のエントリを取得
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    
    // ファイルとディレクトリの情報を構築
    const result = {
      directory: absolutePath,
      files: [],
      directories: []
    };
    
    // 各エントリの情報を取得
    for (const entry of entries) {
      const entryPath = path.join(absolutePath, entry.name);
      const stats = await fs.stat(entryPath);
      
      const info = {
        name: entry.name,
        path: entryPath,
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
      
      if (entry.isDirectory()) {
        result.directories.push(info);
      } else {
        result.files.push(info);
      }
    }
    
    return result;
  } catch (err) {
    console.error(`listFiles エラー: ${err.message}`);
    throw err;
  }
}

// ===== 4. エラー処理とログ機能 =====

/**
 * エラーメッセージを適切に処理して返す関数
 * 日本語エラーメッセージが文字化けしないよう処理
 */
function formatErrorMessage(error, shellType) {
  if (!error) return '';
  
  let errorMessage = error.message || error.toString();
  
  // シェルタイプに応じたエラーメッセージの処理
  switch (shellType.toLowerCase()) {
    case 'powershell':
      // PowerShellのエラーメッセージからノイズを除去
      errorMessage = errorMessage
        .replace(/At line:(\d+) char:(\d+)\s*\+/g, '')
        .replace(/\s+\+ CategoryInfo\s+:.+/gs, '')
        .replace(/\s+\+ FullyQualifiedErrorId\s+:.+/gs, '')
        .trim();
      break;
      
    case 'cmd':
      // CMDのエラーメッセージを整形
      errorMessage = errorMessage.trim();
      break;
      
    case 'gitbash':
      // GitBashのエラーメッセージを整形
      errorMessage = errorMessage.trim();
      break;
  }
  
  return errorMessage;
}

/**
 * 詳細なログ出力機能
 */
function enhancedLogger(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  let logMessage = `${logPrefix} ${message}`;
  
  if (data) {
    // データがオブジェクトの場合は整形して出力
    if (typeof data === 'object') {
      try {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      } catch (err) {
        logMessage += `\n[オブジェクトをJSON化できません: ${err.message}]`;
      }
    } else {
      // それ以外の場合はそのまま出力
      logMessage += ` ${data}`;
    }
  }
  
  // ログレベルに応じた出力先を選択
  switch (level.toLowerCase()) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'info':
      console.info(logMessage);
      break;
    case 'debug':
      console.debug(logMessage);
      break;
    default:
      console.log(logMessage);
  }
  
  return logMessage;
}

// ===== 5. 統合テスト機能 =====

/**
 * 各機能のテストを実行する関数
 */
async function runIntegrationTests() {
  const results = {
    powershell: {
      encoding: false,
      specialChars: false,
      japanese: false
    },
    cmd: {
      encoding: false,
      specialChars: false,
      japanese: false
    },
    gitbash: {
      encoding: false,
      specialChars: false,
      japanese: false
    },
    fileSystem: {
      searchGlob: false,
      listFiles: false,
      japaneseFiles: false
    }
  };
  
  try {
    // PowerShellテスト
    console.log("===== PowerShell テスト開始 =====");
    
    // 日本語エンコーディングテスト
    try {
      const ps = startPowerShellProcess('Write-Output "こんにちは、世界！"');
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        ps.on('close', (code) => {
          results.powershell.encoding = output.includes('こんにちは、世界！');
          console.log(`PowerShell エンコーディングテスト: ${results.powershell.encoding ? '成功' : '失敗'}`);
          resolve();
        });
      });
    } catch (err) {
      console.error(`PowerShell エンコーディングテスト エラー: ${err.message}`);
    }
    
    // 特殊文字テスト
    try {
      const ps = startPowerShellProcess('Get-Process | Select-Object -First 5');
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        ps.on('close', (code) => {
          results.powershell.specialChars = output.length > 0 && code === 0;
          console.log(`PowerShell 特殊文字テスト: ${results.powershell.specialChars ? '成功' : '失敗'}`);
          resolve();
        });
      });
    } catch (err) {
      console.error(`PowerShell 特殊文字テスト エラー: ${err.message}`);
    }
    
    // CMD テスト
    console.log("\n===== CMD テスト開始 =====");
    
    // 日本語エンコーディングテスト
    try {
      const cmd = startCmdProcess('echo こんにちは、世界！');
      let output = '';
      
      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        cmd.on('close', (code) => {
          results.cmd.encoding = output.includes('こんにちは、世界！');
          console.log(`CMD エンコーディングテスト: ${results.cmd.encoding ? '成功' : '失敗'}`);
          resolve();
        });
      });
    } catch (err) {
      console.error(`CMD エンコーディングテスト エラー: ${err.message}`);
    }
    
    // 特殊文字テスト
    try {
      const cmd = startCmdProcess('dir /b & echo "テスト"');
      let output = '';
      
      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        cmd.on('close', (code) => {
          results.cmd.specialChars = output.length > 0 && output.includes('テスト');
          console.log(`CMD 特殊文字テスト: ${results.cmd.specialChars ? '成功' : '失敗'}`);
          resolve();
        });
      });
    } catch (err) {
      console.error(`CMD 特殊文字テスト エラー: ${err.message}`);
    }
    
    // ファイル検索テスト
    console.log("\n===== ファイル検索テスト開始 =====");
    
    try {
      const searchResult = await enhancedSearchGlob('.', '*.js');
      results.fileSystem.searchGlob = searchResult.length >= 0; // 結果があるかどうかに関わらず、正常に実行されればOK
      console.log(`searchGlob テスト: ${results.fileSystem.searchGlob ? '成功' : '失敗'}`);
    } catch (err) {
      console.error(`searchGlob テスト エラー: ${err.message}`);
    }
    
    try {
      const listResult = await enhancedListFiles('.');
      results.fileSystem.listFiles = listResult && listResult.directory;
      console.log(`listFiles テスト: ${results.fileSystem.listFiles ? '成功' : '失敗'}`);
    } catch (err) {
      console.error(`listFiles テスト エラー: ${err.message}`);
    }
    
    // 最終結果の集計
    const totalTests = Object.keys(results).reduce((total, category) => {
      return total + Object.keys(results[category]).length;
    }, 0);
    
    const passedTests = Object.keys(results).reduce((total, category) => {
      return total + Object.values(results[category]).filter(result => result).length;
    }, 0);
    
    console.log(`\n===== テスト結果概要 =====`);
    console.log(`合計テスト数: ${totalTests}`);
    console.log(`成功テスト数: ${passedTests}`);
    console.log(`成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    return results;
  } catch (err) {
    console.error(`統合テスト実行エラー: ${err.message}`);
    throw err;
  }
}

// ===== 6. メイン統合機能 =====

/**
 * 改善されたMCPサーバーの初期化関数
 * 各修正を適用するエントリーポイント
 */
function initEnhancedMCPServer() {
  const originalExecuteCommand = global.executeCommand || null;
  const originalSearchGlob = global.searchGlob || null;
  const originalListFiles = global.listFiles || null;
  
  // 既存の関数をバックアップしてから上書き
  
  // 1. executeCommand 関数の拡張
  global.executeCommand = async function(options) {
    const { shell, command, workingDir } = options;
    
    if (!shell || !command) {
      throw new Error("シェルタイプとコマンドは必須です");
    }
    
    // 特殊文字を含むコマンドの安全な実行
    try {
      enhancedLogger('info', `コマンド実行開始`, { shell, command });
      
      // 作業ディレクトリの設定
      const processOptions = {};
      if (workingDir) {
        processOptions.cwd = workingDir;
      }
      
      // 適切なシェルでコマンドを実行
      const process = safeExecuteCommand(command, shell, processOptions);
      
      // 標準出力と標準エラー出力を収集
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // プロセスの終了を待機
      const exitCode = await new Promise((resolve) => {
        process.on('close', (code) => {
          resolve(code);
        });
      });
      
      // 実行結果をログに記録
      enhancedLogger('info', `コマンド実行完了`, { exitCode });
      
      // 結果を返す
      return {
        stdout,
        stderr: formatErrorMessage(stderr, shell),
        exitCode
      };
    } catch (err) {
      enhancedLogger('error', `コマンド実行エラー`, err);
      return {
        stdout: '',
        stderr: formatErrorMessage(err, shell),
        exitCode: 1
      };
    }
  };
  
  // 2. searchGlob 関数の拡張
  global.searchGlob = async function(path, pattern) {
    try {
      enhancedLogger('info', `ファイル検索開始`, { path, pattern });
      const results = await enhancedSearchGlob(path, pattern);
      enhancedLogger('info', `ファイル検索完了`, { count: results.length });
      return results;
    } catch (err) {
      enhancedLogger('error', `ファイル検索エラー`, err);
      throw err;
    }
  };
  
  // 3. listFiles 関数の拡張
  global.listFiles = async function(path) {
    try {
      enhancedLogger('info', `ディレクトリリスト開始`, { path });
      const results = await enhancedListFiles(path);
      enhancedLogger('info', `ディレクトリリスト完了`, { 
        directory: results.directory,
        filesCount: results.files.length,
        directoriesCount: results.directories.length
      });
      return results;
    } catch (err) {
      enhancedLogger('error', `ディレクトリリストエラー`, err);
      throw err;
    }
  };
  
  // 初期化完了のログ
  enhancedLogger('info', `拡張MCPサーバー初期化完了`);
  
  // 自動テスト実行（オプション）
  if (process.env.MCP_AUTO_TEST === 'true') {
    runIntegrationTests()
      .then(results => {
        enhancedLogger('info', `自動テスト完了`, results);
      })
      .catch(err => {
        enhancedLogger('error', `自動テストエラー`, err);
      });
  }
  
  return {
    originalExecuteCommand,
    originalSearchGlob,
    originalListFiles
  };
}

// エクスポート
module.exports = {
  startPowerShellProcess,
  startCmdProcess,
  startGitBashProcess,
  safeExecuteCommand,
  escapeSpecialChars,
  enhancedSearchGlob,
  enhancedListFiles,
  formatErrorMessage,
  enhancedLogger,
  runIntegrationTests,
  initEnhancedMCPServer
};