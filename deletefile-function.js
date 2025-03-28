/**
 * ファイルまたはディレクトリを削除
 * @param {string} targetPath 削除対象パス
 * @param {Object} options 削除オプション
 * @returns {Promise<Object>} 削除結果情報
 */
async function deleteFile(targetPath, options = {}) {
  const start = Date.now();
  let backupPath = null;
  
  try {
    const validatedPath = await security.validatePath(targetPath);
    logger.debug(`ファイル削除: ${validatedPath}`);
    
    // ファイル存在チェック
    let stats;
    try {
      stats = await fs.stat(validatedPath);
    } catch (err) {
      throw new Error(`対象が存在しないか、アクセス権限がありません: ${err.message}`);
    }
    
    // ファイルタイプ判定
    const isDirectory = stats.isDirectory();
    const targetType = isDirectory ? 'ディレクトリ' : 'ファイル';
    
    // 削除前のバックアップ
    if (options.createBackup !== false && config.utils.enableBackups) {
      backupPath = await utils.createBackup(validatedPath, 'delete');
    }
    
    // 削除実行
    if (isDirectory) {
      if (options.recursive === true) {
        // 再帰的に削除
        await fs.rm(validatedPath, { recursive: true, force: options.force === true });
      } else {
        // 空のディレクトリのみ削除
        await fs.rmdir(validatedPath);
      }
    } else {
      // ファイル削除
      await fs.unlink(validatedPath);
    }
    
    // 結果を返す
    const result = {
      path: targetPath,
      type: targetType,
      isDirectory,
      backupPath,
      success: true,
      elapsedMs: Date.now() - start
    };
    
    logger.info(`${targetType}削除成功: ${targetPath} (${result.elapsedMs}ms)`);
    return result;
  } catch (err) {
    const error = new Error(`ファイル削除エラー: ${err.message}`);
    error.originalError = err;
    error.path = targetPath;
    error.success = false;
    error.elapsedMs = Date.now() - start;
    
    logger.error(`ファイル削除エラー: ${targetPath} - ${err.message}`);
    throw error;
  }
}