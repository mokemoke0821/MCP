/**
 * ファイルを移動
 * @param {string} sourcePath 元ファイルパス
 * @param {string} destinationPath 宛先ファイルパス
 * @param {Object} options 移動オプション
 * @returns {Promise<Object>} 移動結果情報
 */
async function moveFile(sourcePath, destinationPath, options = {}) {
  const start = Date.now();
  let backupPath = null;
  
  try {
    const validatedSourcePath = await security.validatePath(sourcePath);
    const validatedDestPath = await security.validatePath(destinationPath);
    
    logger.debug(`ファイル移動: ${validatedSourcePath} → ${validatedDestPath}`);
    
    // 元ファイル存在チェック
    try {
      const sourceStats = await fs.stat(validatedSourcePath);
      if (!sourceStats.isFile() && !sourceStats.isDirectory()) {
        throw new Error('指定された元パスはファイルまたはディレクトリではありません');
      }
    } catch (err) {
      throw new Error(`元ファイルが存在しないか、読み取り権限がありません: ${err.message}`);
    }
    
    // 拡張子チェック（ファイルの場合）
    const srcStats = await fs.stat(validatedSourcePath);
    if (srcStats.isFile()) {
      if (!security.isFileExtensionAllowed(validatedSourcePath, 'read') || 
          !security.isFileExtensionAllowed(validatedDestPath, 'write')) {
        throw new Error(`このファイル拡張子は移動が許可されていません`);
      }
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
          backupPath = await utils.createBackup(validatedDestPath, 'move');
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
    
    // ファイル移動実行
    await fs.rename(validatedSourcePath, validatedDestPath);
    
    // 結果を返す
    let finalStats;
    try {
      finalStats = await fs.stat(validatedDestPath);
    } catch (err) {
      // 移動後のファイル情報取得に失敗した場合は、最低限の情報のみ返す
      finalStats = { size: 0, mtime: new Date() };
    }
    
    const result = {
      sourcePath,
      destinationPath,
      size: finalStats.size,
      mtime: finalStats.mtime,
      backupPath,
      success: true,
      elapsedMs: Date.now() - start
    };
    
    logger.info(`ファイル移動成功: ${sourcePath} → ${destinationPath} (${finalStats.size} bytes, ${result.elapsedMs}ms)`);
    return result;
  } catch (err) {
    const error = new Error(`ファイル移動エラー: ${err.message}`);
    error.originalError = err;
    error.sourcePath = sourcePath;
    error.destinationPath = destinationPath;
    error.success = false;
    error.elapsedMs = Date.now() - start;
    
    logger.error(`ファイル移動エラー: ${sourcePath} → ${destinationPath} - ${err.message}`);
    throw error;
  }
}