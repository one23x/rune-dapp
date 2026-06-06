# 全站 toast 不显示 →「授权码点了没反应」

状态:**已上线**(2026-06-06 部署 entry index-C8qqBuq4.js,toast 组件已入 bundle)

## 问题
开通交易账户的节点门控卡里输入授权码点「验证」,界面毫无反应——
无成功提示、无报错。实际上 **Supabase RPC 调用是发出去且有响应的**
(实测 `redeem_auth_code` 对错码 200ms 内返回 `{ok:false,error:"code_not_found"}`)。
影响的不止授权码:全站所有 `toast()` 反馈(开户成功/失败、充值提示等)都不可见。

## 根因(两层叠加)
1. **`<Toaster/>` 从未被挂载** —— `main.tsx` 渲染树里没有它,toast 状态有人写、无人渲染。
2. **两份一模一样的 toast store**:`src/hooks/use-toast.ts` 与
   `src/app/hooks/use-toast.ts` 是字节相同的拷贝 = 两个独立的模块级 store。
   业务代码全部 dispatch 进 `@app/hooks/use-toast`,而 `toaster.tsx` 读的是
   `@/hooks/use-toast` —— 即便挂了 Toaster 也显示不出来。

## 解决方案(均已改,见本机树)
- `src/main.tsx`:挂载 `<Toaster />`(LanguageProvider 内、AppRouter 旁)。
- `src/components/ui/toaster.tsx`:改为 import `@app/hooks/use-toast`。
- `src/hooks/use-toast.ts`:整文件改成 `export * from "@app/hooks/use-toast"`
  的转发 shim,store 永远单例,防止再分叉。

## 验证
- `npx vite build` 通过(2026-06-06 exit 0)。
- 上线后:输错授权码应弹红色「授权码无效 / code_not_found」;输对则弹
  「授权码已验证」且门控卡自动切换为开户卡。

## 进度
- [x] 2026-06-06:三处修复完成、本地构建通过
- [x] 2026-06-06:部署上线(entry 含 radix toast 痕迹)
- [ ] 真机复验(错码弹错、对码放行)——等用户重试
