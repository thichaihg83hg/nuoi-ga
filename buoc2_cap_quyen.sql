-- BƯỚC 2: cấp quyền quản trị (thủ quỹ). Làm sau khi tạo tài khoản trong Authentication > Users.
-- Thay email mẫu bằng email thật rồi chạy trong SQL Editor.
insert into public.quan_tri (user_id, ghi_chu)
select id, 'Thủ quỹ' from auth.users where email = 'ngacvantuan.hg@gmail.com'
on conflict (user_id) do nothing;

-- Kiểm tra: phải thấy 1 dòng
select u.email, q.ghi_chu from public.quan_tri q join auth.users u on u.id = q.user_id;
