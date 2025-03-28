# MCP サーバー

MCP (Message Control Protocol) サーバーは、Windows 環境で動作するシェルコマンド実行サーバーです。PowerShell、CMD、GitBash の各シェルをサポートし、特に日本語環境での使用に最適化されています。

## 特徴

- **複数シェルサポート**: PowerShell、CMD、GitBash
- **日本語環境の完全対応**: UTF-8/UTF-16LE エンコーディング処理
- **特殊文字を含むコマンド処理**: パイプライン(|)、セミコロン(;)などの特殊文字をサポート
- **強化されたファイル検索機能**: 日本語ファイル名対応

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
# PM2 のセットアップ (初回のみ)
setup-pm2.bat

# PM2 での起動
pm2 start autostart.js
```

## テスト

テストスクリプトを実行して機能を検証できます:

```bash
# PowerShell 直接実行テスト
node test-direct-powershell.js

# MCP サーバー統合テスト
node test-mcp-server.js
```

## 開発

このプロジェクトは第3フェーズまでの改善を実装しています:

1. **第1フェーズ**: 基本機能実装
2. **第2フェーズ**: バッファサイズ増量、依存パッケージ追加
3. **第3フェーズ**: 日本語環境対応、特殊文字処理、ファイル検索機能改善

## ライセンス

MITライセンス
