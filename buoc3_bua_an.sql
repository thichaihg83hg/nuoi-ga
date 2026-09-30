-- =====================================================================
-- CẬP NHẬT: THÊM "BỮA ĂN CHUNG"
-- Chạy một lần trong SQL Editor (dữ liệu cũ giữ nguyên). Chạy lại vẫn an toàn.
-- =====================================================================
create table if not exists public.bua_an (
  id       bigint generated always as identity primary key,
  du_an    text not null references public.du_an(ma) on delete cascade,
  ngay     date not null default current_date,
  ten      text,
  so_ga    int not null default 0 check (so_ga >= 0),
  so_trung int not null default 0 check (so_trung >= 0),
  ghi_chu  text,
  check (so_ga > 0 or so_trung > 0)
);

alter table public.bua_an enable row level security;
drop policy if exists bua_an_xem on public.bua_an;
drop policy if exists bua_an_ghi on public.bua_an;
create policy bua_an_xem on public.bua_an for select to anon, authenticated using (true);
create policy bua_an_ghi on public.bua_an for all to authenticated
  using (public.la_quan_tri()) with check (public.la_quan_tri());
