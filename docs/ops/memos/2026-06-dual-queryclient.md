# 双 QueryClient 实例 — 模块级 invalidate 全部无效

状态:**已上线**(2026-06-06 随同批部署)

## 问题
开户成功 / 充值 / 撤单后界面数据不刷新(余额、订单列表停留旧值),
必须手动刷新页面。没有任何报错——invalidate 调用「成功」但作用在错的缓存上。

## 根因
`main.tsx` 自己 `new QueryClient()` 提供给 `<QueryClientProvider>`,
而 `src/app/lib/queryClient.ts` 又导出另一个单例。
组件里 `useQueryClient()` 拿到的是前者;但 `copy-trading/shared.tsx` 等
直接 import 后者做模块级 `queryClient.invalidateQueries(...)`
(shared.tsx:518/721/722/1043)→ 永远是 no-op。

## 解决方案(已改)
- `src/app/lib/queryClient.ts` 单例改为唯一权威(defaults 沿用 main.tsx 原值:
  staleTime 60s / retry 1 / refetchOnWindowFocus false,行为不变)。
- `main.tsx` 改为 import 该单例,不再自建。

## 防复发
新增 provider 时**永远 import `@app/lib/queryClient`**,不要 `new QueryClient()`。

## 进度
- [x] 2026-06-06:修复 + vite build 通过
- [x] 2026-06-06:部署上线
- [ ] 复验:开户/充值后列表自动刷新——等用户操作
