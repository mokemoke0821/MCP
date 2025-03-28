# MCP サーバー

MCP (Message Control Protocol) サーバーは、クロスプラットフォーム対応のシェルコマンド実行サーバーです。Windows、macOS、Linux環境での動作をサポートし、PowerShell、CMD、GitBash、Bashの各シェルを使用できます。特に日本語環境での使用に最適化されています。

## 主な機能

- **クロスプラットフォーム対応**:
  - Windows、macOS、Linuxでの動作保証
  - プラットフォーム固有パスの自動変換
  - 環境検出と最適化機能

- **複数シェルサポート**: 
  - Windows: PowerShell、CMD、GitBash
  - macOS/Linux: Bash

- **日本語環境の完全対応**: 
  - UTF-8/UTF-16LE エンコーディング処理
  - 日本語ファイル名の正確な処理
  - ロケール自動検出機能

- **高度なファイル操作**:
  - コピー、移動、削除の強化機能
  - 特殊文字を含むパス処理
  - グロブパターンによる検索

- **設定管理**:
  - プラットフォーム別設定
  - 動的設定変換
  - JSON検証と自動修正

## インストール

```bash
# 依存パッケージのインストール
npm install
```

## 使用方法

### サーバーの起動

```bash
node server.js
```

または PM2 を使用して:

```bash
# Windows環境でのPM2のセットアップ (初回のみ)
setup-pm2.bat

# PM2 での起動
pm2 start autostart.js
```

## システム要件

- Node.js 14.0.0 以上
- NPM 6.0.0 以上
- Windows 10/11、macOS 10.15以上、または Ubuntu/Debian系 Linux

## テスト

テストスクリプトを実行して機能を検証できます:

```bash
# PowerShell 直接実行テスト (Windowsのみ)
node test-direct-powershell.js

# MCP サーバー統合テスト (全プラットフォーム対応)
node mcp-integration-test.js
```

## 環境設定

`config.json`ファイルでサーバーの動作をカスタマイズできます:

```json
{
  "features": {
    "crossPlatform": true,  // クロスプラットフォーム機能を有効化
    "fileOperations": true, // ファイル操作機能を有効化
    "desktopCommands": true // デスクトップコマンド実行を有効化
  }
}
```

## ライセンス

MITライセンス
