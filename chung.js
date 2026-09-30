/* =====================================================================
   PHẦN DÙNG CHUNG cho trang xem (index.html) và trang quản trị (quan-tri.html)
   ===================================================================== */
const sb = supabase.createClient(CAU_HINH.url, CAU_HINH.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "nuoi-ga-xom-tro" }
});
const DA = CAU_HINH.duAn;
const BUCKET = "anh-du-an";

const NHOM_CHI = { xay_chuong: "Xây chuồng", dung_cu: "Dụng cụ", con_giong: "Con giống", thuc_an: "Thức ăn", thuoc: "Thuốc", khac: "Khác" };
const MAU_NHOM = { xay_chuong: "#2F9E44", dung_cu: "#F08C2E", con_giong: "#F7C548", thuc_an: "#74B816", thuoc: "#E8590C", khac: "#A8A29A" };
const LOAI_THU = { gop_von: "Góp vốn", ban_ga: "Bán gà", ban_trung: "Bán trứng", khac: "Thu khác" };
const LOAI_GA = { nhap: "Nhập gà", hao_hut: "Hao hụt", xuat_ban: "Xuất bán", xuat_chia: "Chia cho các hộ" };

const tien = n => Math.round(Number(n) || 0).toLocaleString("vi-VN") + "đ";
const so = n => (Number(n) || 0).toLocaleString("vi-VN");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const p2 = n => String(n).padStart(2, "0");
const chuoiNgay = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const homNay = () => chuoiNgay(new Date());
const ngayVN = s => (s ? s.split("-").reverse().join("/") : "");
const taoNgay = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const soNgayGiua = (a, b) => Math.round((taoNgay(b) - taoNgay(a)) / 86400000);
const THU_VN = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/* ---------- Tải toàn bộ dữ liệu của dự án ---------- */
async function taiTatCa() {
  const bang = ["du_an", "ho", "dot_gop", "thu", "chi", "dan_ga", "trung", "chia", "tiem_phong", "anh", "bua_an"];
  const kq = await Promise.all(bang.map(b => {
    const q = sb.from(b).select("*");
    return b === "du_an" ? q.eq("ma", DA) : q.eq("du_an", DA);
  }));
  const d = {};
  kq.forEach((r, i) => { if (r.error) throw r.error; d[bang[i]] = r.data || []; });
  d.du_an = d.du_an[0] || { ma: DA, ten: "Dự án nuôi gà", ten_nhom: "Xóm trọ vui vẻ", truc_kieu: "ngay", truc_bat_dau: homNay() };
  const theoNgay = (a, b) => (b.ngay || "").localeCompare(a.ngay || "") || b.id - a.id;
  d.ho.sort((a, b) => a.thu_tu - b.thu_tu || a.id - b.id);
  d.dot_gop.sort((a, b) => a.thu_tu - b.thu_tu || a.id - b.id);
  ["thu", "chi", "dan_ga", "trung", "chia", "anh", "bua_an"].forEach(b => d[b].sort(theoNgay));
  d.tiem_phong.sort((a, b) => a.ngay_du_kien.localeCompare(b.ngay_du_kien));
  return d;
}

/* ---------- Tính các con số tổng hợp ---------- */
function tinhToan(d) {
  const t = {};
  const cong = (ds, f) => ds.reduce((s, x) => s + Number(f(x) || 0), 0);
  const tenHo = Object.fromEntries(d.ho.map(h => [h.id, h.ten]));
  t.tenHo = id => tenHo[id] || "";
  t.hoHoatDong = d.ho.filter(h => h.hoat_dong);

  t.tongThu = cong(d.thu, x => x.so_tien);
  t.tongGop = cong(d.thu.filter(x => x.loai === "gop_von"), x => x.so_tien);
  t.thuKhac = t.tongThu - t.tongGop;
  t.tongChi = cong(d.chi, x => x.so_tien);
  const quyTra = d.chi.filter(x => !x.nguoi_ung_id || x.da_hoan);
  t.quyDaChi = cong(quyTra, x => x.so_tien);
  t.quyConLai = t.tongThu - t.quyDaChi;
  t.dsNo = d.chi.filter(x => x.nguoi_ung_id && !x.da_hoan);
  t.no = cong(t.dsNo, x => x.so_tien);
  t.noTheoHo = {};
  t.dsNo.forEach(x => { t.noTheoHo[x.nguoi_ung_id] = (t.noTheoHo[x.nguoi_ung_id] || 0) + Number(x.so_tien); });

  // Góp vốn theo đợt
  t.gop = d.dot_gop.map(dot => {
    const dong = t.hoHoatDong.map(h => {
      const da = cong(d.thu.filter(x => x.loai === "gop_von" && x.dot_id === dot.id && x.ho_id === h.id), x => x.so_tien);
      return { ho: h, da, can: Number(dot.muc_gop), thieu: Math.max(0, Number(dot.muc_gop) - da) };
    });
    const can = dot.muc_gop * dong.length, da = cong(dong, x => x.da);
    return { dot, dong, can, da, thieu: cong(dong, x => x.thieu), soHoDu: dong.filter(x => x.thieu === 0).length };
  });
  t.canGop = cong(t.gop, g => g.can);
  t.daGopTheoDot = cong(t.gop, g => g.da);

  // Đàn gà
  const ga = l => cong(d.dan_ga.filter(x => x.loai === l), x => x.so_con);
  t.gaNhap = ga("nhap"); t.gaHao = ga("hao_hut"); t.gaBan = ga("xuat_ban"); t.gaChia = ga("xuat_chia");
  // Bữa ăn chung
  t.soBua = d.bua_an.length;
  t.gaAn = cong(d.bua_an, x => x.so_ga);
  t.trungAn = cong(d.bua_an, x => x.so_trung);
  t.gaHienCo = t.gaNhap - t.gaHao - t.gaBan - t.gaChia - t.gaAn;

  // Trứng và chia
  t.trungTong = cong(d.trung, x => x.so_qua);
  t.trungDaChia = cong(d.chia.filter(x => x.loai === "trung"), x => x.moi_ho * x.so_ho);
  t.trungTon = t.trungTong - t.trungDaChia - t.trungAn;
  t.trungMoiHo = cong(d.chia.filter(x => x.loai === "trung"), x => x.moi_ho);
  t.gaMoiHo = cong(d.chia.filter(x => x.loai === "ga"), x => x.moi_ho);
  const thang = homNay().slice(0, 7);
  t.trungThangNay = cong(d.trung.filter(x => x.ngay.startsWith(thang)), x => x.so_qua);

  // Chi theo nhóm
  t.chiTheoNhom = Object.keys(NHOM_CHI).map(k => ({ nhom: k, ten: NHOM_CHI[k], tien: cong(d.chi.filter(x => x.nhom === k), x => x.so_tien) })).filter(x => x.tien > 0);

  // Thu chi theo tháng
  const thangMap = {};
  d.thu.forEach(x => { const k = x.ngay.slice(0, 7); (thangMap[k] ||= { thu: 0, chi: 0 }).thu += Number(x.so_tien); });
  d.chi.forEach(x => { const k = x.ngay.slice(0, 7); (thangMap[k] ||= { thu: 0, chi: 0 }).chi += Number(x.so_tien); });
  t.theoThang = Object.keys(thangMap).sort().map(k => ({ thang: k, ...thangMap[k] }));

  // Tiêm phòng
  const hn = homNay();
  t.tiemChuaXong = d.tiem_phong.filter(x => !x.da_tiem);
  t.tiemQuaHan = t.tiemChuaXong.filter(x => x.ngay_du_kien < hn);
  t.tiemSapToi = t.tiemChuaXong.filter(x => x.ngay_du_kien >= hn);

  // Lịch trực
  t.trucNgay = ngay => {
    const ds = t.hoHoatDong;
    if (!ds.length) return null;
    const lech = soNgayGiua(d.du_an.truc_bat_dau, ngay);
    if (lech < 0) return null;
    const i = d.du_an.truc_kieu === "tuan" ? Math.floor(lech / 7) : lech;
    return ds[i % ds.length];
  };
  return t;
}

/* ---------- Xuất Excel ---------- */
function xuatExcel(d, t) {
  const wb = XLSX.utils.book_new();
  const them = (ten, dong, rong) => {
    const ws = XLSX.utils.aoa_to_sheet(dong);
    ws["!cols"] = rong.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, ten);
  };
  them("Tong hop", [
    [`${d.du_an.ten} – ${d.du_an.ten_nhom || ""} (mã ${d.du_an.ma})`],
    [`Xuất ngày ${ngayVN(homNay())}`], [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng thu (đồng)", t.tongThu], ["Trong đó góp vốn (đồng)", t.tongGop], ["Thu khác (đồng)", t.thuKhac],
    ["Tổng chi (đồng)", t.tongChi], ["Quỹ đã chi (đồng)", t.quyDaChi], ["Quỹ còn lại (đồng)", t.quyConLai],
    ["Quỹ đang nợ người chi hộ (đồng)", t.no],
    ["Số gà hiện có (con)", t.gaHienCo], ["Tổng trứng thu (quả)", t.trungTong], ["Trứng chưa chia (quả)", t.trungTon],
    ["Số bữa ăn chung", t.soBua], ["Gà dùng cho bữa ăn chung (con)", t.gaAn], ["Trứng dùng cho bữa ăn chung (quả)", t.trungAn],
    ["Mỗi hộ đã nhận trứng (quả)", t.trungMoiHo], ["Mỗi hộ đã nhận gà (con)", t.gaMoiHo]
  ], [38, 18]);
  const gopDong = [["Đợt góp", "Hộ", "Mức góp", "Đã góp", "Còn thiếu"]];
  t.gop.forEach(g => g.dong.forEach(x => gopDong.push([g.dot.ten, x.ho.ten, x.can, x.da, x.thieu])));
  them("Gop von", gopDong, [12, 26, 12, 12, 12]);
  them("Thu", [["Ngày", "Loại", "Hộ", "Đợt", "Số tiền", "Nội dung"],
    ...d.thu.map(x => [ngayVN(x.ngay), LOAI_THU[x.loai], t.tenHo(x.ho_id), (d.dot_gop.find(o => o.id === x.dot_id) || {}).ten || "", Number(x.so_tien), x.noi_dung || ""])], [11, 12, 24, 10, 12, 34]);
  them("Chi", [["Ngày", "Nhóm", "Nội dung", "Số tiền", "Người chi hộ", "Đã hoàn"],
    ...d.chi.map(x => [ngayVN(x.ngay), NHOM_CHI[x.nhom], x.noi_dung, Number(x.so_tien), t.tenHo(x.nguoi_ung_id), x.nguoi_ung_id ? (x.da_hoan ? "Đã hoàn" : "Chưa hoàn") : ""])], [11, 12, 30, 12, 24, 10]);
  them("Dan ga", [["Ngày", "Loại", "Số con", "Ghi chú"], ...d.dan_ga.map(x => [ngayVN(x.ngay), LOAI_GA[x.loai], x.so_con, x.ghi_chu || ""])], [11, 18, 9, 34]);
  them("Trung", [["Ngày", "Số quả"], ...d.trung.map(x => [ngayVN(x.ngay), x.so_qua])], [11, 9]);
  them("Chia", [["Ngày", "Loại", "Mỗi hộ", "Số hộ", "Tổng", "Ghi chú"],
    ...d.chia.map(x => [ngayVN(x.ngay), x.loai === "trung" ? "Trứng (quả)" : "Gà (con)", x.moi_ho, x.so_ho, x.moi_ho * x.so_ho, x.ghi_chu || ""])], [11, 12, 8, 8, 8, 30]);
  them("Bua an chung", [["Ngày", "Bữa ăn", "Số gà", "Số trứng", "Ghi chú"],
    ...d.bua_an.map(x => [ngayVN(x.ngay), x.ten || "", x.so_ga, x.so_trung, x.ghi_chu || ""])], [11, 28, 8, 9, 34]);
  XLSX.writeFile(wb, `DuAnNuoiGa_${d.du_an.ma}_${homNay()}.xlsx`);
}

/* ---------- Đường dẫn ảnh công khai ---------- */
const duongAnh = p => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
