-- =====================================================================
-- DỰ ÁN NUÔI GÀ – XÓM TRỌ VUI VẺ: CÀI ĐẶT CƠ SỞ DỮ LIỆU (BƯỚC 1)
-- Chạy toàn bộ file này một lần trong Supabase > SQL Editor (project riêng).
-- Chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- 1. BẢNG ------------------------------------------------------------
create table if not exists public.quan_tri (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ghi_chu text
);

create table if not exists public.du_an (
  ma           text primary key,              -- vd: NG23
  ten          text not null,
  ten_nhom     text,
  truc_kieu    text not null default 'ngay' check (truc_kieu in ('ngay', 'tuan')),
  truc_bat_dau date not null default current_date
);

create table if not exists public.ho (
  id        bigint generated always as identity primary key,
  du_an     text not null references public.du_an(ma) on delete cascade,
  ten       text not null,
  thu_tu    int not null default 0,
  hoat_dong boolean not null default true
);

create table if not exists public.dot_gop (
  id      bigint generated always as identity primary key,
  du_an   text not null references public.du_an(ma) on delete cascade,
  ten     text not null,
  muc_gop numeric not null check (muc_gop >= 0),
  han     date,
  thu_tu  int not null default 0
);

create table if not exists public.thu (
  id       bigint generated always as identity primary key,
  du_an    text not null references public.du_an(ma) on delete cascade,
  ngay     date not null default current_date,
  loai     text not null check (loai in ('gop_von', 'ban_ga', 'ban_trung', 'khac')),
  ho_id    bigint references public.ho(id) on delete set null,
  dot_id   bigint references public.dot_gop(id) on delete set null,
  so_tien  numeric not null check (so_tien > 0),
  noi_dung text,
  dan_ga_id bigint                               -- gắn với lần xuất bán gà (nếu có)
);

create table if not exists public.chi (
  id           bigint generated always as identity primary key,
  du_an        text not null references public.du_an(ma) on delete cascade,
  ngay         date not null default current_date,
  nhom         text not null check (nhom in ('xay_chuong', 'dung_cu', 'con_giong', 'thuc_an', 'thuoc', 'khac')),
  noi_dung     text not null,
  so_tien      numeric not null check (so_tien > 0),
  nguoi_ung_id bigint references public.ho(id) on delete set null,   -- null = chi thẳng từ quỹ
  da_hoan      boolean not null default false,
  ngay_hoan    date
);

create table if not exists public.dan_ga (
  id      bigint generated always as identity primary key,
  du_an   text not null references public.du_an(ma) on delete cascade,
  ngay    date not null default current_date,
  loai    text not null check (loai in ('nhap', 'hao_hut', 'xuat_ban', 'xuat_chia')),
  so_con  int not null check (so_con > 0),
  ghi_chu text,
  chia_id bigint                                 -- gắn với lần chia gà (nếu có)
);

create table if not exists public.trung (
  id      bigint generated always as identity primary key,
  du_an   text not null references public.du_an(ma) on delete cascade,
  ngay    date not null default current_date,
  so_qua  int not null check (so_qua >= 0),
  unique (du_an, ngay)
);

create table if not exists public.chia (
  id      bigint generated always as identity primary key,
  du_an   text not null references public.du_an(ma) on delete cascade,
  ngay    date not null default current_date,
  loai    text not null check (loai in ('trung', 'ga')),
  moi_ho  int not null check (moi_ho > 0),
  so_ho   int not null check (so_ho > 0),
  ghi_chu text
);

create table if not exists public.tiem_phong (
  id           bigint generated always as identity primary key,
  du_an        text not null references public.du_an(ma) on delete cascade,
  ten          text not null,
  ngay_du_kien date not null,
  da_tiem      boolean not null default false,
  ngay_tiem    date,
  ghi_chu      text
);

create table if not exists public.anh (
  id        bigint generated always as identity primary key,
  du_an     text not null references public.du_an(ma) on delete cascade,
  duong_dan text not null,
  chu_thich text,
  ngay      date not null default current_date
);

-- Liên kết: xóa lần chia gà thì xóa luôn dòng xuất chuồng; xóa lần xuất bán thì xóa luôn khoản thu
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'thu_dan_ga_fk') then
    alter table public.thu add constraint thu_dan_ga_fk foreign key (dan_ga_id) references public.dan_ga(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dan_ga_chia_fk') then
    alter table public.dan_ga add constraint dan_ga_chia_fk foreign key (chia_id) references public.chia(id) on delete cascade;
  end if;
end $$;

-- 2. PHÂN QUYỀN ----------------------------------------------------
create or replace function public.la_quan_tri()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quan_tri where user_id = auth.uid())
$$;

alter table public.quan_tri enable row level security;
drop policy if exists quan_tri_doc on public.quan_tri;
create policy quan_tri_doc on public.quan_tri for select to authenticated using (user_id = auth.uid());

-- Ai có link cũng XEM được; chỉ tài khoản quản trị được THÊM/SỬA/XÓA
do $$
declare t text;
begin
  foreach t in array array['du_an','ho','dot_gop','thu','chi','dan_ga','trung','chia','tiem_phong','anh'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists %1$s_xem on public.%1$s', t);
    execute format('drop policy if exists %1$s_ghi on public.%1$s', t);
    execute format('create policy %1$s_xem on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_ghi on public.%1$s for all to authenticated using (public.la_quan_tri()) with check (public.la_quan_tri())', t);
  end loop;
end $$;

-- 3. KHO ẢNH (công khai để xem, chỉ quản trị được tải lên/xóa) --------
insert into storage.buckets (id, name, public)
values ('anh-du-an', 'anh-du-an', true)
on conflict (id) do update set public = true;

drop policy if exists anh_du_an_xem on storage.objects;
drop policy if exists anh_du_an_them on storage.objects;
drop policy if exists anh_du_an_sua on storage.objects;
drop policy if exists anh_du_an_xoa on storage.objects;
create policy anh_du_an_xem on storage.objects for select to anon, authenticated
  using (bucket_id = 'anh-du-an');
create policy anh_du_an_them on storage.objects for insert to authenticated
  with check (bucket_id = 'anh-du-an' and public.la_quan_tri());
create policy anh_du_an_sua on storage.objects for update to authenticated
  using (bucket_id = 'anh-du-an' and public.la_quan_tri());
create policy anh_du_an_xoa on storage.objects for delete to authenticated
  using (bucket_id = 'anh-du-an' and public.la_quan_tri());

-- 4. DỮ LIỆU BAN ĐẦU (theo bảng kinh phí hiện có) ---------------------
-- Ngày của các khoản cũ đang để tạm 30/9/2026, sửa lại trong trang quản trị nếu cần.
do $$
declare v_dot bigint;
begin
  if exists (select 1 from public.du_an where ma = 'NG23') then return; end if;

  insert into public.du_an (ma, ten, ten_nhom, truc_kieu, truc_bat_dau)
  values ('NG23', 'Dự án nuôi gà', 'Xóm trọ vui vẻ', 'ngay', '2026-10-01');

  insert into public.ho (du_an, ten, thu_tu) values
    ('NG23', 'Ngạc Văn Tuấn', 1),
    ('NG23', 'Phan Thị Tuyết Nhung', 2),
    ('NG23', 'Hoàn Tường Vi', 3),
    ('NG23', 'Lương Thị Thu Hương', 4),
    ('NG23', 'Nguyễn Thị Bích Nguyệt', 5),
    ('NG23', 'Phạm Thị Hiền', 6),
    ('NG23', 'Nguyễn Thị Phượng', 7);

  insert into public.dot_gop (du_an, ten, muc_gop, thu_tu)
  values ('NG23', 'Đợt 1', 1500000, 1) returning id into v_dot;

  insert into public.thu (du_an, ngay, loai, ho_id, dot_id, so_tien, noi_dung)
  select 'NG23', '2026-09-30', 'gop_von', h.id, v_dot, g.so_tien, 'Góp vốn đợt 1'
  from (values
    ('Ngạc Văn Tuấn', 1000000), ('Phan Thị Tuyết Nhung', 1000000), ('Hoàn Tường Vi', 1000000),
    ('Lương Thị Thu Hương', 1000000), ('Nguyễn Thị Bích Nguyệt', 1000000), ('Phạm Thị Hiền', 1000000),
    ('Nguyễn Thị Phượng', 1500000)
  ) as g(ten, so_tien)
  join public.ho h on h.ten = g.ten and h.du_an = 'NG23';

  insert into public.chi (du_an, ngay, nhom, noi_dung, so_tien) values
    ('NG23', '2026-09-30', 'xay_chuong', 'Thuê chở xi măng, cát', 600000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua vít', 55000),
    ('NG23', '2026-09-30', 'dung_cu',    'Mua đục', 50000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua tre', 1210000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua dây thép', 100000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua ván', 360000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua gạch', 1500000),
    ('NG23', '2026-09-30', 'dung_cu',    'Mua xẻng và thuổng', 220000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua lưới', 586000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua ngói', 270000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua dây thép to', 90000),
    ('NG23', '2026-09-30', 'xay_chuong', 'Mua tre (đợt 2)', 310000);
end $$;
