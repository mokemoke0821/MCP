/**
 * ディレクトリをコピー
 * @param {string} sourcePath 元ディレクトリパス
 * @param {string} destinationPath 宛先ディレクトリパス
 * @param {Object} options コピーオプション
 * @returns {Promise<Object>} コピー結果情報
 */
async function copyDirectory(sourcePath, destinationPath, options = {}) {
  const start = Date.now();
  const stats = { files: 0, directories: 0, errors: 0 };
  
  try {
    const validatedSourcePath = await security.validatePath(sourcePath);
    const validatedDestPath = await security.validatePath(destinationPath);
    
    logger.debug(`ディレクトリコピー: ${validatedSourcePath} → ${validatedDestPath}`);
    
    // 元ディレクトリ存在チェック
    try {
      const sourceStats = await fs.stat(validatedSourcePath);
      if (!sourceStats.isDirectory()) {
        throw new Error('指定された元パスはディレクトリではありません');
      }
    } catch (err) {
      throw new Error(`元ディレクトリが存在しないか、読み取り権限がありません: ${err.message}`);
    }
    
    // 宛先ディレクトリ作成
    try {
      await fs.mkdir(validatedDestPath, { recursive: true });
      stats.directories++;
      logger.debug(`宛先ディレクトリを作成しました: ${validatedDestPath}`);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw new Error(`宛先ディレクトリの作成に失敗しました: ${err.message}`);
      }
    }
    
    // 再帰コピー用の内部関数
    async function copyRecursive(source, destination) {
      // ディレクトリ内の項目を取得
      const entries = await fs.readdir(source, { withFileTypes: true });
      
      // 各項目を処理
      for (const entry of entries) {
        const srcPath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        
        try {
          if (entry.isDirectory()) {
            // ディレクトリの場合は再帰コピー
            await fs.mkdir(destPath, { recursive: true });
            stats.directories++;
            await copyRecursive(srcPath, destPath);
          } else if (entry.isFile()) {
            // ファイルの場合はコピー
            try {
              if (!security.isFileExtensionAllowed(srcPath, 'read') || 
                  !security.isFileExtensionAllowed(destPath, 'write')) {
                logger.warn(`このファイル拡張子はコピーが許可されていません: ${entry.name}`);
                continue;
              }
              
              await fs.copyFile(srcPath, destPath);
              stats.files++;
            } catch (fileErr) {
              logger.error(`ファイルコピーエラー: ${srcPath} → ${destPath} - ${fileErr.message}`);
              stats.errors++;
            }
          }
        } catch (entryErr) {
          logger.error(`エントリコピーエラー: ${srcPath} - ${entryErr.message}`);
          stats.errors++;
        }
      }
    }
    
    // 再帰コピー実行
    await copyRecursive(validatedSourcePath, validatedDestPath);
    
    // 結果を返す
    const result = {
      sourcePath,
      destinationPath,
      stats,
      success: true,
      elapsedMs: Date.now() - start
    };
    
    logger.info(`ディレクトリコピー成功: ${sourcePath} → ${destinationPath} (ファイル${stats.files}個, ディレクトリ${stats.directories}個, エラー${stats.errors}件, ${result.elapsedMs}ms)`);
    return result;
  } catch (err) {
    const error = new Error(`ディレクトリコピーエラー: ${err.message}`);
    error.originalError = err;
    error.sourcePath = sourcePath;
    error.destinationPath = destinationPath;
    error.stats = stats;
    error.success = false;
    error.elapsedMs = Date.now() - start;
    
    logger.error(`ディレクトリコピーエラー: ${sourcePath} → ${destinationPath} - ${err.message}`);
    throw error;
  }
}