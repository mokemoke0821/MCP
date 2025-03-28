// MCPサーバーとファイル操作モジュールの統合
// ファイル操作機能を既存のMCPサーバーに統合するための修正ファイル

// 拡張ファイル操作モジュールをインポート
const fileOperations = require('./file-operations');
const fileWatcher = require('./file-watcher');
const path = require('path');
const fs = require('fs');

// グローバル設定
let globalConfig = null;

// アクティブなウォッチャーのリスナー登録状況を追跡
const activeListeners = new Map();

// MCPサーバー起動時の初期化関数
async function initMCPFileOperations(config) {
  try {
    console.log('拡張ファイル操作モジュールを初期化しています...');
    
    // config.jsonからの設定を使用して初期化
    const fileOpConfig = config.fileOperations || {};
    
    // グローバル設定を保存
    globalConfig = config;
    
    // セキュリティ設定
    const securityConfig = {
      allowedPaths: fileOpConfig.allowedPaths || [],
      enablePathTraversalProtection: 
        fileOpConfig.security?.enablePathTraversalProtection !== undefined 
          ? fileOpConfig.security.enablePathTraversalProtection 
          : true,
      enableSymlinkProtection: 
        fileOpConfig.security?.enableSymlinkProtection !== undefined
          ? fileOpConfig.security.enableSymlinkProtection
          : true,
      maxPathLength: 
        fileOpConfig.security?.maxPathLength || 260,
      whitelistedExtensions: 
        fileOpConfig.security?.whitelistedExtensions || ['*'],
      blacklistedExtensions: 
        fileOpConfig.security?.blacklistedExtensions || 
        ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.com']
    };
    
    // バックアップ設定
    const backupConfig = {
      enableBackups: 
        fileOpConfig.backup?.enableBackups !== undefined
          ? fileOpConfig.backup.enableBackups
          : true,
      backupDir: 
        fileOpConfig.backup?.backupDir || './backups',
      backupRetentionDays: 
        fileOpConfig.backup?.backupRetentionDays || 7
    };
    
    // その他の設定
    const otherConfig = {
      maxFileSize: fileOpConfig.maxFileSize || 10485760,
      tempDir: fileOpConfig.temp?.tempDir || './temp',
      streamLargeFiles: 
        fileOpConfig.advanced?.streamLargeFiles !== undefined
          ? fileOpConfig.advanced.streamLargeFiles
          : true,
      streamThreshold: 
        fileOpConfig.advanced?.streamThreshold || 5242880,
      detailedErrorMessages: 
        fileOpConfig.advanced?.detailedErrorMessages !== undefined
          ? fileOpConfig.advanced.detailedErrorMessages
          : true,
      logAllOperations: 
        fileOpConfig.advanced?.logAllOperations !== undefined
          ? fileOpConfig.advanced.logAllOperations
          : true
    };
    
    // ファイル監視設定の更新
    const watcherConfig = {
      usePolling: fileOpConfig.watcher?.usePolling !== undefined
        ? fileOpConfig.watcher.usePolling
        : process.platform === 'win32',
      pollingInterval: fileOpConfig.watcher?.pollingInterval || 5000,
      maxWatchers: fileOpConfig.watcher?.maxWatchers || 50,
      recursive: fileOpConfig.watcher?.recursive !== undefined
        ? fileOpConfig.watcher.recursive
        : true,
      persistent: fileOpConfig.watcher?.persistent !== undefined
        ? fileOpConfig.watcher.persistent
        : true
    };
    
    // ファイル監視設定を更新
    fileWatcher.updateWatchConfig(watcherConfig);
    
    // モジュールの初期化
    const initResult = await fileOperations.initialize({
      security: securityConfig,
      utils: {
        ...backupConfig,
        tempDir: otherConfig.tempDir
      },
      maxFileSize: otherConfig.maxFileSize,
      logFileOperations: otherConfig.logAllOperations,
      detailedErrorMessages: otherConfig.detailedErrorMessages
    });
    
    if (initResult.success) {
      console.log('拡張ファイル操作モジュールが正常に初期化されました');
      
      // バックアップディレクトリとテンポラリディレクトリの作成
      ensureDirectoryExists(backupConfig.backupDir);
      ensureDirectoryExists(otherConfig.tempDir);
      
      return true;
    } else {
      console.error(`拡張ファイル操作モジュールの初期化に失敗しました: ${initResult.error}`);
      return false;
    }
  } catch (err) {
    console.error(`拡張ファイル操作モジュールの初期化中にエラーが発生しました: ${err.message}`);
    return false;
  }
}

// ディレクトリが存在することを確認する補助関数
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`ディレクトリを作成しました: ${dirPath}`);
    }
  } catch (err) {
    console.error(`ディレクトリの作成に失敗しました: ${dirPath}, エラー: ${err.message}`);
  }
}

// エラーレスポンスを標準化する関数
function createErrorResponse(error, operation) {
  const errorResponse = {
    success: false,
    operation,
    error: error.message || '不明なエラー',
    timestamp: new Date().toISOString()
  };
  
  if (globalConfig?.fileOperations?.advanced?.detailedErrorMessages) {
    errorResponse.details = {
      stack: error.stack,
      code: error.code
    };
  }
  
  return errorResponse;
}

// 成功レスポンスを標準化する関数
function createSuccessResponse(data, operation) {
  return {
    success: true,
    operation,
    data,
    timestamp: new Date().toISOString()
  };
}

// MCP Tools の統合関数
function setupMCPFileTools(server) {
  if (!server) {
    console.error('MCPサーバーインスタンスが提供されていません');
    return false;
  }
  
  // 拡張ファイル読み取りツール
  server.tool("extendedReadFile", "拡張ファイル読み取り機能", {
    filePath: String,
    options: {
      encoding: String,
      offset: Number,
      limit: Number,
      asBase64: Boolean
    }
  }, async ({ filePath, options = {} }) => {
    try {
      const result = await fileOperations.readFile(filePath, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: result.data }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ファイル読み取りエラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // 拡張ファイル書き込みツール
  server.tool("extendedWriteFile", "拡張ファイル書き込み機能", {
    filePath: String,
    content: String,
    options: {
      encoding: String,
      append: Boolean,
      createBackup: Boolean
    }
  }, async ({ filePath, content, options = {} }) => {
    try {
      const result = await fileOperations.writeFile(filePath, content, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: `ファイル ${filePath} は正常に書き込まれました` }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ファイル書き込みエラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ディレクトリ一覧ツール
  server.tool("extendedListDirectory", "ディレクトリ内のファイル・フォルダ一覧表示", {
    directoryPath: String,
    options: {
      recursive: Boolean,
      includeHidden: Boolean,
      pattern: String
    }
  }, async ({ directoryPath, options = {} }) => {
    try {
      const result = await fileOperations.listDirectory(directoryPath, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ディレクトリ一覧エラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイル情報取得ツール
  server.tool("getFileInfo", "ファイル情報の詳細を取得", {
    filePath: String,
    options: {
      resolveSymlinks: Boolean
    }
  }, async ({ filePath, options = {} }) => {
    try {
      const result = await fileOperations.getFileInfo(filePath, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ファイル情報取得エラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイルコピーツール
  server.tool("copyFile", "ファイルコピー", {
    sourcePath: String,
    destinationPath: String,
    options: {
      overwrite: Boolean,
      createBackup: Boolean
    }
  }, async ({ sourcePath, destinationPath, options = {} }) => {
    try {
      const result = await fileOperations.copyFile(sourcePath, destinationPath, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: `ファイルが正常にコピーされました: ${sourcePath} → ${destinationPath}` }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ファイルコピーエラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイル移動ツール
  server.tool("moveFile", "ファイル移動", {
    sourcePath: String,
    destinationPath: String,
    options: {
      overwrite: Boolean,
      createBackup: Boolean
    }
  }, async ({ sourcePath, destinationPath, options = {} }) => {
    try {
      const result = await fileOperations.moveFile(sourcePath, destinationPath, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: `ファイルが正常に移動されました: ${sourcePath} → ${destinationPath}` }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ファイル移動エラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイル削除ツール
  server.tool("deleteFile", "ファイル削除", {
    filePath: String,
    options: {
      force: Boolean,
      createBackup: Boolean,
      recursive: Boolean
    }
  }, async ({ filePath, options = {} }) => {
    try {
      const result = await fileOperations.deleteFile(filePath, options);
      
      if (result.success) {
        return {
          content: [{ type: "text", text: `ファイルが正常に削除されました: ${filePath}` }]
        };
      } else {
        return {
          content: [{ type: "text", text: `ファイル削除エラー: ${result.error}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `予期せぬエラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // === ファイル監視ツール ===
  
  // ファイル監視開始ツール
  server.tool("watchPath", "ファイルやディレクトリの変更を監視", {
    targetPath: String,
    options: {
      recursive: Boolean,
      usePolling: Boolean,
      pollingInterval: Number,
      persistent: Boolean
    }
  }, async ({ targetPath, options = {} }) => {
    try {
      const watcherId = await fileWatcher.watchPath(targetPath, options);
      
      return {
        content: [{ 
          type: "text", 
          text: `ファイル監視を開始しました: ${targetPath} (監視ID: ${watcherId})` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `ファイル監視開始エラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイル監視停止ツール
  server.tool("unwatchPath", "ファイル監視を停止", {
    watcherId: String
  }, async ({ watcherId }) => {
    try {
      const result = fileWatcher.unwatchPath(watcherId);
      
      if (result) {
        // リスナー登録の削除
        if (activeListeners.has(watcherId)) {
          const listeners = activeListeners.get(watcherId);
          for (const { event, listener } of listeners) {
            fileWatcher.off(event, listener);
          }
          activeListeners.delete(watcherId);
        }
        
        return {
          content: [{ type: "text", text: `ファイル監視を停止しました (監視ID: ${watcherId})` }]
        };
      } else {
        return {
          content: [{ type: "text", text: `指定された監視IDは存在しません: ${watcherId}` }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `ファイル監視停止エラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // 全てのファイル監視を停止ツール
  server.tool("unwatchAll", "全てのファイル監視を停止", {}, async () => {
    try {
      const count = fileWatcher.unwatchAll();
      
      // 全てのリスナー登録を削除
      for (const [watcherId, listeners] of activeListeners.entries()) {
        for (const { event, listener } of listeners) {
          fileWatcher.off(event, listener);
        }
      }
      activeListeners.clear();
      
      return {
        content: [{ type: "text", text: `${count}件のファイル監視を停止しました` }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `ファイル監視停止エラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // アクティブなファイル監視一覧ツール
  server.tool("listWatchers", "アクティブなファイル監視の一覧を取得", {}, async () => {
    try {
      const watchers = fileWatcher.listWatchers();
      
      return {
        content: [{ type: "text", text: JSON.stringify(watchers, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `ファイル監視一覧取得エラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイル監視イベントリスナー登録ツール
  server.tool("addWatchListener", "ファイル監視イベントリスナーを登録", {
    watcherId: String,
    events: [String],
    callbackUrl: String
  }, async ({ watcherId, events, callbackUrl }) => {
    try {
      // 監視IDの存在確認
      const watchers = fileWatcher.listWatchers();
      const watcherExists = watchers.some(w => w.watcherId === watcherId);
      
      if (!watcherExists) {
        return {
          content: [{ type: "text", text: `指定された監視IDは存在しません: ${watcherId}` }],
          isError: true
        };
      }
      
      // イベントの検証
      const validEvents = events.filter(event => 
        fileWatcher.supportedEvents.includes(event) ||
        event === 'watcher-start' ||
        event === 'watcher-stop'
      );
      
      if (validEvents.length === 0) {
        return {
          content: [{ type: "text", text: `有効なイベントが指定されていません。サポートされているイベント: ${fileWatcher.supportedEvents.join(', ')}, watcher-start, watcher-stop` }],
          isError: true
        };
      }
      
      // リスナーのセットアップ
      const listeners = [];
      
      for (const event of validEvents) {
        const listener = (eventData) => {
          // ここでWebhookを呼び出す処理を実装
          // 実際の実装では、callbackUrlにPOSTリクエストを送信する
          console.log(`イベント ${event} が発生しました: ${JSON.stringify(eventData)}`);
          
          // 本来はWebhookを呼び出すコード
          // fetch(callbackUrl, {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ event, data: eventData, watcherId })
          // });
        };
        
        fileWatcher.on(event, listener);
        listeners.push({ event, listener });
      }
      
      // リスナーを保存
      if (activeListeners.has(watcherId)) {
        activeListeners.get(watcherId).push(...listeners);
      } else {
        activeListeners.set(watcherId, listeners);
      }
      
      return {
        content: [{ type: "text", text: `ファイル監視イベントリスナーを登録しました: ${validEvents.join(', ')} (監視ID: ${watcherId})` }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `イベントリスナー登録エラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  // ファイル監視イベントリスナー削除ツール
  server.tool("removeWatchListener", "ファイル監視イベントリスナーを削除", {
    watcherId: String,
    events: [String]
  }, async ({ watcherId, events }) => {
    try {
      if (!activeListeners.has(watcherId)) {
        return {
          content: [{ type: "text", text: `指定された監視IDのリスナーは登録されていません: ${watcherId}` }],
          isError: true
        };
      }
      
      const listeners = activeListeners.get(watcherId);
      const removedEvents = [];
      
      if (events && events.length > 0) {
        // 特定のイベントのみ削除
        const remainingListeners = [];
        
        for (const listener of listeners) {
          if (events.includes(listener.event)) {
            fileWatcher.off(listener.event, listener.listener);
            removedEvents.push(listener.event);
          } else {
            remainingListeners.push(listener);
          }
        }
        
        if (remainingListeners.length > 0) {
          activeListeners.set(watcherId, remainingListeners);
        } else {
          activeListeners.delete(watcherId);
        }
      } else {
        // 全てのイベントを削除
        for (const listener of listeners) {
          fileWatcher.off(listener.event, listener.listener);
          removedEvents.push(listener.event);
        }
        
        activeListeners.delete(watcherId);
      }
      
      return {
        content: [{ type: "text", text: `ファイル監視イベントリスナーを削除しました: ${removedEvents.join(', ')} (監視ID: ${watcherId})` }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `イベントリスナー削除エラー: ${error.message}` 
        }],
        isError: true
      };
    }
  });
  
  console.log('拡張ファイル操作ツールとファイル監視ツールがMCPサーバーに正常に統合されました');
  return true;
}

// エクスポート
module.exports = {
  initMCPFileOperations,
  setupMCPFileTools,
  createErrorResponse,
  createSuccessResponse
};
