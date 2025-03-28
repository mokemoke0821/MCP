/**
 * ファイルをコピー
 * @param {string} sourcePath 元ファイルパス
 * @param {string} destinationPath 宛先ファイルパス
 * @param {Object} options コピーオプション
 * @returns {Promise<Object>} コピー結果情報
 */
async function copyFile(sourcePath, destinationPath, options = {}) {
  const start = Date.now();
  let backupPath = null;
  
  try {
    const validatedSourcePath = await security.validatePath(sourcePath);
    const validatedDestPath = await security.validatePath(destinationPath);
    
    logger.debug(`ファイルコピー: ${validatedSourcePath} → ${validatedDestPath}`);
    
    // 元ファイル存在チェック
    try {
      const sourceStats = await fs.stat(validatedSourcePath);
      if (!sourceStats.isFile()) {
        throw new Error('指定された元パスはファイルではありません');
      }
    } catch (err) {
      throw new Error(`元ファイルが存在しないか、読み取り権限がありません: ${err.message}`);
    }
    
    // 拡張子チェック
    if (!security.isFileExtensionAllowed(validatedSourcePath, 'read') || 
        !security.isFileExtensionAllowed(validatedDestPath, 'write')) {
      throw new Error(`このファイル拡張子はコピーが許可されていません`);
    }
    
    // 宛先ディレクトリ確認と作成
    const destDir = path.dirname(validatedDestPath);
    try {
      await fs.access(destDir);
    } catch (err) {
      // 宛先ディレクトリが存在しない場合は作成
      await fs.mkdir(destDir, { recursive: true });
      logger.info(`宛先ディレクトリを作成しました: ${destDir}`);
    }
    
    // 宛先ファイルの存在チェックとバックアップ
    if (options.overwrite !== false) {
      try {
        await fs.access(validatedDestPath);
        if (options.createBackup !== false && config.utils.enableBackups) {
          backupPath = await utils.createBackup(validatedDestPath, 'copy');
        }
      } catch (err) {
        // ファイルが存在しない場合は何もしない
      }
    } else {
      // 上書き禁止時の存在チェック
      try {
        await fs.access(validatedDestPath);
        throw new Error('宛先ファイルが既に存在し、上書きが禁止されています');
      } catch (err) {
        // エラーがない場合は、ファイルが存在しないので続行
        if (err.code !== 'ENOENT') throw err;
      }
    }
    
    // ファイルコピー実行
    await fs.copyFile(validatedSourcePath, validatedDestPath);
    
    // コピー先のタイムスタンプを更新
    const sourceStats = await fs.stat(validatedSourcePath);
    await fs.utimes(validatedDestPath, sourceStats.atime, sourceStats.mtime);
    
    // 結果を返す
    const destStats = await fs.stat(validatedDestPath);
    const result = {
      sourcePath,
      destinationPath,
      size: destStats.size,
      mtime: destStats.mtime,
      backupPath,
      success: true,
      elapsedMs: Date.now() - start
    };
    
    logger.info(`ファイルコピー成功: ${sourcePath} → ${destinationPath} (${destStats.size} bytes, ${result.elapsedMs}ms)`);
    return result;
  } catch (err) {
    const error = new Error(`ファイルコピーエラー: ${err.message}`);
    error.originalError = err;
    error.sourcePath = sourcePath;
    error.destinationPath = destinationPath;
    error.success = false;
    error.elapsedMs = Date.now() - start;
    
    logger.error(`ファイルコピーエラー: ${sourcePath} → ${destinationPath} - ${err.message}`);
    throw error;
  }
}