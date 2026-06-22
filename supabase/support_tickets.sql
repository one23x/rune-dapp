-- ============================================================================
-- support_tickets — dapp 用户工单 (support / help-desk tickets)
-- ============================================================================
--
-- dapp 用户(连接钱包 = 匿名 anon)在 /app/support 提交工单与回复；管理后台
-- (rune-admin-panel,Supabase Auth = authenticated)读取、改状态、回复。
--
--   dapp 用户 (anon key) → support_tickets / support_ticket_messages → 后台 (authenticated)
--
-- 截图附件存 Storage bucket `ticket-attachments`(public read),路径约定:
--   {chain_id}/{wallet}/{ticket_id}/{filename}
--
-- ⚠️ 多租户/安全说明（留给 rune-audit）：
--   写姿态（本表自有，非沿用其它表）：
--     • anon (dapp 用户)        = INSERT(建工单) + SELECT(读全表) + 仅限回复标记列的 UPDATE
--                                  (last_reply_at / last_reply_by / updated_at,见下方 GRANT 收紧)。
--                                  status / priority / subject / description 等内容列 anon 不可改。
--     • authenticated (管理后台) = 全权 UPDATE(改状态/优先级/内容) + 全权读写线程。
--   读隔离现状：anon 角色可 SELECT 全表所有工单，前端按连接钱包 (wallet=lower(addr))
--   在 WHERE 子句里自行过滤；并未在 DB 层做按钱包的行级隔离(dapp 无 Supabase Auth
--   JWT,拿不到可信的 wallet claim)。因此 anon 理论上能读到他人工单的
--   subject/description/附件 URL —— 工单含用户自填联系方式/描述,敏感度较高,是否需
--   收紧(改走 Edge Function + service-role 鉴权,或接 thirdweb→Supabase JWT 桥)留给
--   rune-audit 评估。
--   写隔离已收紧：anon 的表级 UPDATE 权限通过 GRANT 列级授权限定到回复标记列(见
--   RLS 段落末尾的 revoke/grant)；RLS policy 仅做行级 using(true),列级隔离靠 GRANT。
--
-- 幂等 —— 可安全重复执行。
-- ============================================================================

-- ── 工单主表 ──
create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  chain_id      integer not null,                 -- 56 mainnet / 97 testnet(对齐后台 adminChainId)
  wallet        text not null,                    -- 连接钱包,统一小写
  user_id       uuid,                             -- 可选关联 trading_users.id
  category      text not null
                  check (category in ('deposit','withdraw','copy_trade','node_tier','wallet','vault','account_data','other')),
  subject       text not null,
  description   text not null,
  status        text not null default 'open'
                  check (status in ('open','in_progress','resolved','closed')),
  priority      text not null default 'normal'
                  check (priority in ('low','normal','high')),
  attachments   jsonb not null default '[]'::jsonb,   -- [{path,url,name}]
  contact       text,                             -- 可选 tg/email
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_reply_at timestamptz,
  last_reply_by text check (last_reply_by in ('user','admin'))
);

-- 我的工单列表:按钱包 + 最新优先
create index if not exists support_tickets_wallet_idx
  on public.support_tickets (wallet, created_at desc);

-- 后台待办:只看未关闭的工单(部分索引,体积小)
create index if not exists support_tickets_open_idx
  on public.support_tickets (status, created_at desc)
  where status <> 'closed';

-- 后台按链(主网/测试网)筛选
create index if not exists support_tickets_chain_idx
  on public.support_tickets (chain_id, created_at desc);

-- ── 工单消息线程 ──
create table if not exists public.support_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  sender      text not null check (sender in ('user','admin')),
  body        text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- 线程按时间正序读取
create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

-- ── 防滥用:单钱包 1 小时内最多 5 条新工单（before insert 触发器）──
-- security definer 确保以函数 owner 权限读全表计数,不受 anon RLS 影响。
create or replace function public.support_tickets_rate_limit() returns trigger
language plpgsql security definer as $$
begin
  if (select count(*) from public.support_tickets
        where wallet = new.wallet and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited: too many tickets from this wallet in the last hour';
  end if;
  return new;
end$$;
drop trigger if exists support_tickets_rate_limit_trg on public.support_tickets;
create trigger support_tickets_rate_limit_trg before insert on public.support_tickets
  for each row execute function public.support_tickets_rate_limit();

-- ============================================================================
-- RLS
--   anon          = dapp 用户(VITE_SUPABASE_PUBLISHABLE_KEY)
--   authenticated = 管理后台(Supabase Auth 会话)
-- ============================================================================

-- ── support_tickets ──
alter table public.support_tickets enable row level security;

-- anon 可读全表(前端按 wallet 过滤,见上方安全说明)
drop policy if exists support_tickets_anon_select on public.support_tickets;
create policy support_tickets_anon_select
  on public.support_tickets
  for select
  using (true);

-- anon 可新建工单
drop policy if exists support_tickets_anon_insert on public.support_tickets;
create policy support_tickets_anon_insert
  on public.support_tickets
  for insert
  with check (true);

-- anon 可 UPDATE —— 应用层仅用于「回复时 bump last_reply_at/last_reply_by/updated_at」。
-- Postgres RLS 无法在策略里限定「只允许改某几列」,因此列级隔离改由下方 GRANT 收紧
-- (revoke 全表 update,再按列 grant)。policy 这里只保留行级 using(true)/with check(true)。
drop policy if exists support_tickets_anon_update on public.support_tickets;
create policy support_tickets_anon_update
  on public.support_tickets
  for update
  using (true)
  with check (true);

-- authenticated(后台)全权:读 + 改状态
drop policy if exists support_tickets_auth_select on public.support_tickets;
create policy support_tickets_auth_select
  on public.support_tickets
  for select
  to authenticated
  using (true);

drop policy if exists support_tickets_auth_update on public.support_tickets;
create policy support_tickets_auth_update
  on public.support_tickets
  for update
  to authenticated
  using (true)
  with check (true);

-- ── 列级写权限收紧（RLS 无法限定列,靠 GRANT 实现）──
-- anon (dapp 用户) 只能 bump 回复标记列,不能改 status/priority/subject/description 等内容列。
-- status 故意不授予 anon(管理员专属);后台以 last_reply_by='user' 作为「需处理」信号。
revoke update on public.support_tickets from anon;
grant  update (last_reply_at, last_reply_by, updated_at) on public.support_tickets to anon;
-- authenticated (管理后台) 保留全列 update。
grant  update on public.support_tickets to authenticated;

-- ── support_ticket_messages ──
alter table public.support_ticket_messages enable row level security;

-- anon 可读全表(随工单读线程,前端按 ticket_id 过滤)
drop policy if exists support_ticket_messages_anon_select on public.support_ticket_messages;
create policy support_ticket_messages_anon_select
  on public.support_ticket_messages
  for select
  using (true);

-- anon 只能以 user 身份发消息(不能伪造 admin 回复)
drop policy if exists support_ticket_messages_anon_insert on public.support_ticket_messages;
create policy support_ticket_messages_anon_insert
  on public.support_ticket_messages
  for insert
  with check (sender = 'user');

-- authenticated(后台)全权:读 + 回复(可发 admin 消息)
drop policy if exists support_ticket_messages_auth_select on public.support_ticket_messages;
create policy support_ticket_messages_auth_select
  on public.support_ticket_messages
  for select
  to authenticated
  using (true);

drop policy if exists support_ticket_messages_auth_insert on public.support_ticket_messages;
create policy support_ticket_messages_auth_insert
  on public.support_ticket_messages
  for insert
  to authenticated
  with check (true);

-- ============================================================================
-- Storage: ticket-attachments bucket(public read)
--   路径约定:{chain_id}/{wallet}/{ticket_id}/{filename}
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

-- 仅允许位图截图(排除 SVG 以杜绝 script-in-svg 注入向量),单文件 ≤ 5MB。
update storage.buckets
  set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'],
      file_size_limit = 5242880
  where id = 'ticket-attachments';

-- anon 可上传到该 bucket(截图);public 读由 bucket.public=true 提供 CDN URL,
-- 这里再补一条 SELECT policy 以支持 supabase 客户端的 list/getPublicUrl 路径。
drop policy if exists ticket_attachments_anon_insert on storage.objects;
create policy ticket_attachments_anon_insert
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'ticket-attachments');

drop policy if exists ticket_attachments_public_select on storage.objects;
create policy ticket_attachments_public_select
  on storage.objects
  for select
  using (bucket_id = 'ticket-attachments');
