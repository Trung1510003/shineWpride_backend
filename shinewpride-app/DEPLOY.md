# Triển khai ShineW Pride lên shinewpride.com (đơn giản — 1 service)

Có **2 phần độc lập**. Khách hàng chỉ dùng phần 1; phần 2 chạy ngầm.

| Phần | Triển khai ở đâu | Khách thấy |
|---|---|---|
| 1. Storefront (theme) | Hạ tầng Shopify + domain `shinewpride.com` | ✅ |
| 2. App backend (watermark, mail, chống lưu ảnh) | Railway (1 service) | ❌ chạy ngầm qua `/apps/shinewpride` |

---

## PHẦN 1 — Storefront lên shinewpride.com (domain đã trỏ về Shopify)

> Làm trong web Shopify Admin, không cần dòng lệnh.

1. Đẩy theme lên store (chạy ở thư mục theme gốc, KHÔNG phải `shinewpride-app/`):
   ```bash
   shopify theme push --store shinewpride.myshopify.com
   ```
2. Shopify Admin → **Online Store → Themes** → theme vừa đẩy → **Publish**.
3. Shopify Admin → **Settings → Domains** → đảm bảo `shinewpride.com` là **Primary domain**.
   - Xong: khách vào `https://shinewpride.com` thấy giao diện shop.

---

## PHẦN 2 — App backend lên Railway (1 lần)

### B1. Tạo dịch vụ trên Railway
1. railway.app → **New Project → Deploy from GitHub repo** → chọn repo này.
2. Trong service Settings → **Root Directory** = `shinewpride-app`
   (Railway sẽ tự dùng `railway.json` + `Dockerfile` ở đó).
3. **+ New → Database → PostgreSQL** (Railway tự tạo `DATABASE_URL`).

### B2. Đặt Variables cho service (tab Variables)
```
DATABASE_URL          = ${{Postgres.DATABASE_URL}}   # tham chiếu plugin Postgres
SHOPIFY_API_KEY       = <từ Shopify Partner app>
SHOPIFY_API_SECRET    = <từ Shopify Partner app>
SHOPIFY_APP_URL       = https://<tên-service>.up.railway.app   # lấy ở tab Settings → Domains
SCOPES                = read_products,write_products,read_customers,write_customers,write_app_proxy
RESEND_API_KEY        = <key Resend>
RESEND_FROM_EMAIL     = ShineW Pride <no-reply@shinewpride.com>
WATERMARK_TEXT        = ShineW Pride
EMAIL_SCHEDULER_TIMEZONE = Asia/Ho_Chi_Minh
# KHÔNG đặt REDIS_URL và KHÔNG đặt APP_PROCESS_ROLE → chạy gọn 1 tiến trình.
```
Railway sẽ tự build (Dockerfile), chạy `prisma migrate deploy`, rồi start. Migration chạy tự động mỗi lần deploy.

### B3. Trỏ Shopify về app vừa deploy
Chạy 1 lần ở máy (đăng nhập Shopify Partner):
```bash
cd shinewpride-app
npm run deploy        # Shopify CLI: cập nhật App URL + webhooks + App Proxy
```
Hoặc trong **Partner Dashboard → App setup**: đặt App URL = `SHOPIFY_APP_URL`, Allowed redirect = `<URL>/api/auth`.

### B4. Cài app lên store & bật chống-lưu-ảnh
1. Cài app vào store `shinewpride.myshopify.com` (link cài từ Partner Dashboard).
2. Shopify Admin → **Online Store → Themes → Customize** → bật app embed **image-protection**.

---

## Cập nhật về sau (cực gọn)
- Sửa code → `git push` → Railway tự build & deploy lại (kèm migrate).
- Sửa giao diện shop → `shopify theme push` rồi Publish.

## Kiểm tra nhanh sau khi live
- `https://shinewpride.com` mở được, popup email hoạt động (email vào app → Subscribers).
- Thêm ảnh sản phẩm trong Admin → ảnh tự có watermark "ShineW Pride".
- App → Email campaigns → **Send test** → nhận mail (Resend). Lịch tự gửi 18:00 & 20:00 (giờ VN).
