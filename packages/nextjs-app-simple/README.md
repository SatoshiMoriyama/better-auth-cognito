# Next.js App (Simple) - Better Auth + Cognito

シンプルなBetter Auth + Cognito実装（組み込みプロバイダー使用）

## 特徴

- 組み込みCognitoプロバイダーを使用
- Cognitoマネージドログイン画面を表示
- ポート: 3001

## 起動方法

```bash
cd packages/nextjs-app-simple
pnpm install
pnpm dev
```

http://localhost:3001 でアクセス

## 比較

- **nextjs-app**: Generic OAuth使用、Auth0直接リダイレクト（応用編）
- **nextjs-app-simple**: 組み込みプロバイダー使用、マネージドログイン表示（基本編）
