# Kế hoạch triển khai Backend cho ShineW Pride (Shopify)

> Tài liệu này chia nhỏ toàn bộ công việc thành các task độc lập. Mỗi task có:
> **Mục tiêu / chức năng trong hệ thống · Input · Output · Mô tả · Prompt cho AI agent** (kèm Input, Output, Mô tả, File path, Ảnh hưởng tới hệ thống).
> Có thể copy nguyên phần "Prompt cho AI agent" để giao cho từng agent thực hiện.

---

## 0. Bối cảnh kiến trúc (đọc trước khi làm)

- **Repo hiện tại là một Shopify Online Store Theme (Liquid)** đặt ở thư mục gốc (`sections/`, `snippets/`, `assets/`, `templates/`, `layout/theme.liquid`...). Thư mục `prototype/` là bản dựng React/Vite chỉ để thiết kế và đã bị loại khỏi theme qua `.shopifyignore`.
- **Theme KHÔNG chạy được code server-side.** Cả 3 nhóm tính năng backend (watermark ảnh, lịch gửi mail, lưu/đọc database) bắt buộc phải nằm trong **một Shopify App riêng**. Theme chỉ "ăn theo" qua: **App Proxy** (gọi API app từ storefront), **Theme App Extension** (chèn block JS/CSS vào theme), và **Admin API webhooks**.
- **Quyết định kiến trúc tổng thể:**
  - App backend: **Shopify App + Remix** (template chính thức `shopify app init`), TypeScript.
  - ORM + DB: **Prisma + PostgreSQL** (chi tiết lựa chọn ở mục 1).
  - Xử lý ảnh/watermark: **sharp** (libvips).
  - Hàng đợi & lịch: **node-cron** (đơn giản) hoặc **BullMQ + Redis** (tin cậy, có retry) — khuyến nghị BullMQ cho production.
  - Gửi email: nhà cung cấp ngoài (**Resend** / SendGrid / Mailgun / AWS SES) vì Shopify không cho gửi email marketing tuỳ ý qua API.
- **Cây thư mục mới sẽ tạo** (app nằm cạnh theme trong cùng repo):

```
shinewpride-theme/            # theme hiện có (giữ nguyên ở gốc)
shinewpride-app/              # APP MỚI (Shopify Remix backend)
  shopify.app.toml
  package.json
  prisma/schema.prisma
  app/
    shopify.server.ts
    db.server.ts
    routes/
      app._index.tsx
      app.watermark.tsx
      app.subscribers.tsx
      app.campaigns.tsx
      webhooks.products-create.tsx
      webhooks.products-update.tsx
      proxy.subscribe.tsx
    services/
      watermark.server.ts
      shopify-media.server.ts
      email/provider.server.ts
      email/scheduler.server.ts
  extensions/
    image-protection/         # Theme App Extension
      blocks/image-protection.liquid
      assets/image-protection.js
```

> **Lưu ý quan trọng về tính năng "chặn chụp màn hình":** Trên web KHÔNG thể chặn hoàn toàn screenshot ở mức hệ điều hành (PrintScreen, Snipping Tool, chụp bằng điện thoại...). Chỉ có thể **gây khó / răn đe** (chặn chuột phải, kéo-thả, phím tắt lưu, làm mờ ảnh khi mất focus, phát hiện DevTools) và **bảo vệ thực sự bằng watermark + ảnh độ phân giải thấp**. Plan dưới đây làm theo hướng đó.

---

## PHA 1 — Hạ tầng App & Database

### Task 1.1 — Khởi tạo Shopify App (Remix)
- **Chức năng:** Tạo bộ khung app backend để gắn webhook, app proxy, admin UI.
- **Input:** Quyền Partner account Shopify, Shopify CLI đã cài, store dev.
- **Output:** Thư mục `shinewpride-app/` chạy được `shopify app dev`, có `shopify.app.toml`, auth OAuth hoạt động.
- **Công nghệ sử dụng:** Shopify CLI, `@shopify/app` (template Remix), Remix, React, TypeScript, Node.js, Vite, Shopify App Bridge, Polaris.
- **Mô tả:** Dùng template chính thức Remix + TypeScript. Đây là nền cho mọi task backend.
- **Prompt cho AI agent:**
  > **Mô tả:** Khởi tạo một Shopify App mới bằng Remix template (TypeScript) trong thư mục `shinewpride-app/` cạnh theme. Không đụng vào file theme ở gốc.
  > **Input:** Chạy `shopify app init` (hoặc `npm init @shopify/app@latest`), chọn Remix, TypeScript. App name: "ShineW Pride Backend".
  > **Output:** `shinewpride-app/shopify.app.toml`, `package.json`, `app/shopify.server.ts`, chạy được `shopify app dev` và cài lên store dev thành công.
  > **File path:** tạo mới toàn bộ trong `shinewpride-app/`.
  > **Ảnh hưởng hệ thống:** Thêm thành phần backend tách biệt; KHÔNG thay đổi theme. Là phụ thuộc nền của tất cả task PHA 2–5.

### Task 1.2 — Chọn & cấu hình Database (Prisma + PostgreSQL)
- **Chức năng:** Lưu session OAuth, danh sách subscriber, chiến dịch email, log gửi mail, log watermark.
- **Input:** App từ Task 1.1; chuỗi kết nối PostgreSQL (local Docker hoặc Neon/Supabase/Railway).
- **Output:** `prisma/schema.prisma` cấu hình `provider = "postgresql"`, `prisma migrate` chạy được, `db.server.ts` export PrismaClient.
- **Công nghệ sử dụng:** Prisma ORM, PostgreSQL, `@shopify/shopify-app-session-storage-prisma`, Node.js, TypeScript, dotenv.
- **Mô tả & khuyến nghị framework DB cho Shopify:**
  - **Khuyến nghị chính: Prisma + PostgreSQL.** Là chuẩn của template Shopify Remix, type-safe, migrate tốt, host dễ (Neon/Supabase/Railway/RDS).
  - Dev nhanh: **SQLite** (đổi 1 dòng provider) — không khuyến nghị cho production (không chịu tải đồng thời tốt).
  - Thay thế: **MySQL/PlanetScale** (cũng dùng Prisma), hoặc **MongoDB + Mongoose** (nếu thích NoSQL, nhưng mất type-safety của Prisma).
- **Prompt cho AI agent:**
  > **Mô tả:** Cấu hình Prisma với PostgreSQL cho app `shinewpride-app`. Giữ session storage qua `@shopify/shopify-app-session-storage-prisma`.
  > **Input:** `DATABASE_URL` (PostgreSQL) đặt trong `.env`. App đã có sẵn Prisma từ template.
  > **Output:** `prisma/schema.prisma` đặt `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`; chạy `prisma migrate dev --name init` thành công; `app/db.server.ts` export `prisma`.
  > **File path:** `shinewpride-app/prisma/schema.prisma`, `shinewpride-app/app/db.server.ts`, `shinewpride-app/.env`.
  > **Ảnh hưởng hệ thống:** Tạo lớp lưu trữ dùng chung cho subscriber, campaign, log. Là phụ thuộc của Task 1.3, PHA 4.

### Task 1.3 — Định nghĩa data models (schema)
- **Chức năng:** Mô hình dữ liệu cho subscriber, campaign email, log gửi, log watermark.
- **Input:** Prisma đã cấu hình (Task 1.2).
- **Output:** Các model: `Subscriber`, `EmailCampaign`, `EmailSendLog`, `WatermarkLog`; migration mới.
- **Công nghệ sử dụng:** Prisma schema (PSL), PostgreSQL, Prisma Migrate, Prisma Client (TypeScript).
- **Mô tả:** Định nghĩa rõ field & quan hệ để các task sau dùng.
- **Prompt cho AI agent:**
  > **Mô tả:** Thêm các model Prisma sau và tạo migration:
  > - `Subscriber { id, email(unique), shopDomain, source, status(active/unsubscribed), shopifyCustomerId?, createdAt }`
  > - `EmailCampaign { id, name, subject, htmlTemplate, scheduleSlot(enum: SIX_PM/EIGHT_PM), active(bool), createdAt }`
  > - `EmailSendLog { id, campaignId(fk), subscriberEmail, status(sent/failed), error?, sentAt }`
  > - `WatermarkLog { id, shopifyMediaId, productId, status(done/failed), originalUrl, watermarkedUrl?, createdAt }`
  > **Input:** schema hiện tại từ Task 1.2.
  > **Output:** schema cập nhật + `prisma migrate dev --name domain-models` chạy thành công + Prisma Client tái tạo.
  > **File path:** `shinewpride-app/prisma/schema.prisma`.
  > **Ảnh hưởng hệ thống:** Cung cấp cấu trúc dữ liệu cho PHA 2 (watermark log) và PHA 4 (email). Không ảnh hưởng theme.

### Task 1.4 — Cấu hình scopes & biến môi trường
- **Chức năng:** Khai báo quyền Admin API cần thiết và secrets.
- **Input:** App từ 1.1.
- **Output:** `shopify.app.toml` có scopes; `.env.example` liệt kê biến cần.
- **Công nghệ sử dụng:** Shopify App config (TOML), Shopify OAuth scopes, Shopify App Proxy, biến môi trường (.env).
- **Mô tả:** Scopes tối thiểu: `read_products, write_products` (watermark), `read_customers, write_customers` (subscriber/email). App proxy được khai báo (dùng ở Task 4.2).
- **Prompt cho AI agent:**
  > **Mô tả:** Cập nhật scopes và tạo file `.env.example`. Khai báo App Proxy trong `shopify.app.toml` (subpath prefix `apps`, subpath `shinewpride`, url trỏ về route `/proxy`).
  > **Input:** `shinewpride-app/shopify.app.toml`.
  > **Output:** scopes = `read_products,write_products,read_customers,write_customers`; block `[app_proxy]`; `.env.example` gồm `DATABASE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, RESEND_API_KEY, REDIS_URL, WATERMARK_TEXT`.
  > **File path:** `shinewpride-app/shopify.app.toml`, `shinewpride-app/.env.example`.
  > **Ảnh hưởng hệ thống:** Mở quyền cho các API call sau; cấu hình app proxy để theme gọi backend.

---

## PHA 2 — Watermark ảnh sản phẩm trước khi niêm yết

> Mục tiêu: mọi ảnh sản phẩm trước khi hiển thị trên web đều mang watermark nội dung "ShineWpride". Hai luồng: (A) **Pipeline chủ động** — merchant upload ảnh thô vào trang admin của app → app chèn watermark → đẩy lên Shopify. (B) **Webhook an toàn** — nếu ảnh được thêm trực tiếp trong Shopify admin mà chưa có watermark thì tự động xử lý lại.

### Task 2.1 — Service chèn watermark (sharp)
- **Chức năng:** Hàm thuần nhận buffer ảnh → trả buffer ảnh đã có watermark "ShineWpride" lặp chéo (tiled, mờ).
- **Input:** Buffer ảnh gốc, text watermark, độ mờ.
- **Output:** Buffer ảnh đã watermark (giữ định dạng, nén hợp lý).
- **Công nghệ sử dụng:** sharp (libvips), SVG (text watermark), Node.js Buffer, TypeScript, Vitest (unit test).
- **Mô tả:** Dùng `sharp` composite một lớp SVG text lặp chéo phủ toàn ảnh. Có unit test với 1 ảnh mẫu.
- **Prompt cho AI agent:**
  > **Mô tả:** Viết service `watermarkImage(input: Buffer, opts?): Promise<Buffer>` dùng `sharp`. Tạo lớp SVG chứa chữ "ShineWpride" lặp chéo (xoay ~ -30°), opacity ~0.18, kích thước theo chiều rộng ảnh; composite lên ảnh gốc; resize giới hạn max width 2000px; xuất WebP/JPEG chất lượng 82.
  > **Input:** `input: Buffer` ảnh gốc; `opts: { text?: string='ShineWpride', opacity?: number=0.18 }`.
  > **Output:** `Buffer` ảnh đã watermark. Kèm test `watermark.server.test.ts` đọc 1 ảnh trong `tee/` (hoặc fixture) và assert kích thước > 0, định dạng hợp lệ.
  > **File path:** tạo `shinewpride-app/app/services/watermark.server.ts` (+ test). Cài `sharp`.
  > **Ảnh hưởng hệ thống:** Lõi xử lý ảnh; được Task 2.2, 2.4, 2.5 gọi. Không ảnh hưởng theme.

### Task 2.2 — Service đẩy ảnh lên Shopify (staged upload + media)
- **Chức năng:** Upload buffer ảnh đã watermark lên Shopify và gắn vào sản phẩm.
- **Input:** Buffer ảnh, productId, admin GraphQL client.
- **Output:** media được tạo trên sản phẩm; trả về mediaId + URL.
- **Công nghệ sử dụng:** Shopify Admin GraphQL API (`stagedUploadsCreate`, `productCreateMedia`, metafields), fetch/HTTP PUT, Prisma (ghi log), TypeScript.
- **Mô tả:** Dùng `stagedUploadsCreate` → PUT file lên staged target → `productCreateMedia`. Gắn tag/metafield `watermarked=true` để tránh xử lý lặp.
- **Prompt cho AI agent:**
  > **Mô tả:** Viết `uploadWatermarkedMedia(admin, productId, buffer, filename)`: gọi mutation `stagedUploadsCreate`, PUT buffer lên target, rồi `productCreateMedia` với `originalSource = resourceUrl`. Sau khi tạo, set metafield `custom.watermarked = "true"` cho media/sản phẩm.
  > **Input:** `admin` (GraphQL client từ Remix), `productId: gid`, `buffer: Buffer`, `filename: string`.
  > **Output:** `{ mediaId, imageUrl }`. Ghi `WatermarkLog` (Task 1.3) status=done.
  > **File path:** `shinewpride-app/app/services/shopify-media.server.ts`.
  > **Ảnh hưởng hệ thống:** Ghi dữ liệu vào Shopify (write_products) và DB log. Dùng bởi 2.4 và 2.5.

### Task 2.3 — Trang Admin: upload ảnh thô (pipeline thủ công)
- **Chức năng:** Giao diện trong app cho merchant chọn sản phẩm + upload nhiều ảnh thô.
- **Input:** Danh sách sản phẩm (Admin API), file ảnh người dùng chọn.
- **Output:** Form upload (Polaris) gửi multipart tới route action.
- **Công nghệ sử dụng:** Remix (loader/route), React, Shopify Polaris (`DropZone`, `Select`), App Bridge, Shopify Admin GraphQL API (`products`), TypeScript.
- **Mô tả:** Trang embedded Polaris: dropzone ảnh, chọn sản phẩm đích, nút "Watermark & Publish".
- **Prompt cho AI agent:**
  > **Mô tả:** Tạo route Remix `app.watermark.tsx`: loader lấy danh sách sản phẩm (GraphQL `products(first:50)`); UI Polaris có `DropZone` (nhiều ảnh) + `Select` chọn sản phẩm + nút submit multipart tới action của chính route.
  > **Input:** ảnh người dùng upload, productId chọn.
  > **Output:** form POST multipart; hiển thị kết quả/trạng thái từng ảnh.
  > **File path:** `shinewpride-app/app/routes/app.watermark.tsx`.
  > **Ảnh hưởng hệ thống:** Thêm trang admin; phụ thuộc 2.1, 2.2 (gọi ở 2.4). Không ảnh hưởng theme/storefront.

### Task 2.4 — Action xử lý upload thủ công (nối 2.1 + 2.2)
- **Chức năng:** Nhận ảnh thô từ 2.3 → watermark → đẩy lên Shopify → trả kết quả.
- **Input:** multipart files + productId.
- **Output:** JSON kết quả từng ảnh (mediaId/URL hoặc lỗi).
- **Công nghệ sử dụng:** Remix action, `unstable_parseMultipartFormData`, sharp (qua service 2.1), Shopify Admin GraphQL (qua service 2.2), Prisma, TypeScript.
- **Mô tả:** Action của route `app.watermark.tsx` lặp qua từng file: gọi `watermarkImage` rồi `uploadWatermarkedMedia`.
- **Prompt cho AI agent:**
  > **Mô tả:** Viết `action` cho `app.watermark.tsx`: parse multipart (dùng `unstable_parseMultipartFormData` hoặc tương đương), với mỗi file → `watermarkImage(buffer)` → `uploadWatermarkedMedia(admin, productId, out, name)`. Bắt lỗi từng file, ghi `WatermarkLog`.
  > **Input:** request multipart (files + `productId`).
  > **Output:** `json({ results: [{ name, status, imageUrl?, error? }] })`.
  > **File path:** `shinewpride-app/app/routes/app.watermark.tsx` (phần action).
  > **Ảnh hưởng hệ thống:** Tạo media watermark trên sản phẩm Shopify, ghi DB log. Phụ thuộc 2.1, 2.2, 1.3.

### Task 2.5 — Webhook tự động watermark khi thêm ảnh trực tiếp
- **Chức năng:** Bắt ảnh thêm qua Shopify admin chưa có watermark → tự xử lý.
- **Input:** Webhook `products/create`, `products/update` payload.
- **Output:** Ảnh chưa watermark được thay bằng bản đã watermark; ảnh gốc xoá.
- **Công nghệ sử dụng:** Shopify Webhooks (`products/create`, `products/update`), `authenticate.webhook` (HMAC), Shopify Admin GraphQL (`productDeleteMedia`), BullMQ + Redis (job nền), sharp, Prisma, TypeScript.
- **Mô tả:** Đăng ký webhook; với mỗi image chưa có metafield `watermarked`, tải về, watermark, upload bản mới, xoá media cũ. Tránh vòng lặp bằng cờ metafield. **Nên chạy nền bằng queue (Task 4.x/BullMQ) để không timeout webhook.**
- **Prompt cho AI agent:**
  > **Mô tả:** Tạo route webhook `webhooks.products-update.tsx` (và create): xác thực HMAC qua `authenticate.webhook`; với mỗi media ảnh thiếu cờ `watermarked`, đẩy job vào hàng đợi (hoặc xử lý trực tiếp nếu chưa có queue): download ảnh gốc → `watermarkImage` → `uploadWatermarkedMedia` → `productDeleteMedia` ảnh gốc.
  > **Input:** payload webhook product (gồm media/images).
  > **Output:** ảnh sản phẩm đã thay bằng bản watermark; `WatermarkLog` cập nhật; HTTP 200 nhanh.
  > **File path:** `shinewpride-app/app/routes/webhooks.products-create.tsx`, `webhooks.products-update.tsx`; cập nhật đăng ký webhook trong `shopify.app.toml`.
  > **Ảnh hưởng hệ thống:** Đảm bảo MỌI ảnh sản phẩm đều có watermark dù thêm bằng đường nào. Có thể tốn API rate-limit → dùng queue. Phụ thuộc 2.1, 2.2.

---

## PHA 3 — Chặn chụp/lưu/tải ảnh (Theme App Extension + Storefront)

> Lưu ý đã nêu: chỉ răn đe được, không chặn tuyệt đối. Bảo vệ thật = watermark (PHA 2) + ảnh preview độ phân giải thấp.

### Task 3.1 — Theme App Extension: block bảo vệ ảnh
- **Chức năng:** Đóng gói JS/CSS bảo vệ ảnh thành 1 app block bật/tắt từ Theme Editor.
- **Input:** App từ PHA 1.
- **Output:** Extension `image-protection` với block liquid + asset JS/CSS, có settings (bật/tắt từng cơ chế).
- **Công nghệ sử dụng:** Shopify Theme App Extension, Liquid (app block + schema), `shopify.extension.toml`, Shopify CLI, vanilla JavaScript, CSS.
- **Mô tả:** Merchant chèn block vào theme; cấu hình bật/tắt: chặn chuột phải, chặn kéo-thả, làm mờ khi mất focus, phát hiện DevTools.
- **Prompt cho AI agent:**
  > **Mô tả:** Tạo Theme App Extension tên `image-protection` trong `shinewpride-app/extensions/`. Block `image-protection.liquid` nạp `assets/image-protection.js` + CSS; khai báo `schema` settings: `disable_context_menu`, `disable_drag`, `blur_on_blur`, `detect_devtools` (checkbox).
  > **Input:** không có dữ liệu runtime; chỉ settings từ theme editor.
  > **Output:** extension build được bằng `shopify app dev`; block xuất hiện trong Theme Editor.
  > **File path:** `shinewpride-app/extensions/image-protection/blocks/image-protection.liquid`, `.../assets/image-protection.js`, `.../shopify.extension.toml`.
  > **Ảnh hưởng hệ thống:** Cho phép bật bảo vệ ảnh trên storefront mà không sửa trực tiếp file theme.

### Task 3.2 — Logic JS chống lưu/kéo/chuột phải
- **Chức năng:** Vô hiệu hoá các thao tác lưu ảnh phổ biến.
- **Input:** DOM storefront (ảnh trong `.am-product-card__img`, `.product-media__image`).
- **Output:** chuột phải/kéo-thả/long-press bị chặn trên ảnh sản phẩm; phím tắt lưu (Ctrl+S) bị chặn.
- **Công nghệ sử dụng:** Vanilla JavaScript (DOM events: `contextmenu`, `dragstart`, `keydown`), CSS (`user-select`, `-webkit-user-drag`, `-webkit-touch-callout`), HTML overlay.
- **Mô tả:** Gắn listener theo settings; thêm `draggable=false`, CSS `user-select:none; -webkit-user-drag:none; -webkit-touch-callout:none`; lớp phủ trong suốt chống "Save image as".
- **Prompt cho AI agent:**
  > **Mô tả:** Viết `image-protection.js`: đọc settings từ `data-*` của block; nếu bật → `contextmenu`/`dragstart` preventDefault trên ảnh sản phẩm; thêm class CSS `no-save`; chặn `keydown` Ctrl+S/Ctrl+P; thêm overlay `<span class="img-guard">` phủ lên ảnh.
  > **Input:** thuộc tính `data-*` cấu hình; các phần tử ảnh sản phẩm.
  > **Output:** hành vi chặn hoạt động trên Shop, Product, Cart; không vỡ giao diện.
  > **File path:** `shinewpride-app/extensions/image-protection/assets/image-protection.js` (+ CSS kèm hoặc trong block).
  > **Ảnh hưởng hệ thống:** Tăng răn đe sao chép ảnh; chỉ ảnh hưởng storefront khi block được bật.

### Task 3.3 — Làm mờ ảnh khi mất focus / phát hiện DevTools
- **Chức năng:** Làm mờ ảnh khi người dùng chuyển tab/mất focus (răn đe công cụ chụp) và khi mở DevTools.
- **Input:** sự kiện `visibilitychange`, `blur`, heuristic kích thước cửa sổ DevTools.
- **Output:** ảnh sản phẩm bị mờ tạm thời trong các tình huống trên.
- **Công nghệ sử dụng:** Vanilla JavaScript (`visibilitychange`, `blur`/`focus`, heuristic DevTools), CSS `filter: blur()`, Page Visibility API.
- **Mô tả:** Thêm class `.is-protected-blur` (filter: blur) khi `document.hidden`/window blur; heuristic phát hiện DevTools (chênh lệch outer/inner size) để mờ + ẩn ảnh full-res.
- **Prompt cho AI agent:**
  > **Mô tả:** Bổ sung vào `image-protection.js`: nếu `blur_on_blur` bật → toggle class blur theo `visibilitychange`/`blur`/`focus`; nếu `detect_devtools` bật → vòng kiểm tra kích thước, khi nghi DevTools mở thì thêm blur và xoá `src` độ phân giải cao.
  > **Input:** settings `blur_on_blur`, `detect_devtools`.
  > **Output:** ảnh tự mờ đúng tình huống, tự khôi phục khi quay lại.
  > **File path:** `shinewpride-app/extensions/image-protection/assets/image-protection.js`.
  > **Ảnh hưởng hệ thống:** Răn đe screenshot/screen-record; chỉ storefront, có thể tắt từ theme editor.

### Task 3.4 — Phục vụ ảnh preview độ phân giải thấp (tuỳ chọn, bảo vệ thật)
- **Chức năng:** Storefront chỉ tải bản ảnh nhỏ + watermark; ảnh gốc không lộ.
- **Input:** ảnh đã watermark (PHA 2), tham số width của theme.
- **Output:** thẻ `<img>` dùng `image_url: width` nhỏ hơn (vd max 1200) cho card; tắt `data-max-resolution` zoom full.
- **Công nghệ sử dụng:** Shopify Liquid (filter `image_url`, `image_tag`), Shopify CDN image resizing, HTML responsive images.
- **Mô tả:** Giảm rủi ro tải ảnh gốc chất lượng cao. Sửa nhẹ trong theme (snippet ảnh).
- **Prompt cho AI agent:**
  > **Mô tả:** Trong THEME, giảm độ phân giải tối đa của ảnh sản phẩm: ở `snippets/product-media.liquid` bỏ/hạ `data_max_resolution` (đang 3840) xuống ~1200; ở `snippets/am-product-card.liquid` giữ width ≤ 600. Đảm bảo không vỡ layout.
  > **Input:** `snippets/product-media.liquid`, `snippets/am-product-card.liquid`.
  > **Output:** ảnh storefront tải ở độ phân giải giới hạn, vẫn đẹp nhưng khó dùng lại.
  > **File path:** `shinewpride-theme/snippets/product-media.liquid`, `shinewpride-theme/snippets/am-product-card.liquid`.
  > **Ảnh hưởng hệ thống:** Sửa THEME (storefront). Test kỹ trang sản phẩm/zoom. Bổ trợ cho 3.1–3.3.

---

## PHA 4 — Tự động gửi email lúc 18:00 và 20:00 (DB + scheduler)

### Task 4.1 — Tích hợp nhà cung cấp email
- **Chức năng:** Hàm gửi 1 email (provider thật).
- **Input:** email người nhận, subject, html.
- **Output:** kết quả gửi (id/lỗi).
- **Công nghệ sử dụng:** Resend SDK (hoặc SendGrid/Mailgun/AWS SES SDK), Node.js, TypeScript (interface `EmailProvider`).
- **Mô tả:** Khuyến nghị **Resend** (đơn giản) hoặc SendGrid/Mailgun/SES. Bọc thành 1 interface để dễ đổi.
- **Prompt cho AI agent:**
  > **Mô tả:** Viết `sendEmail({ to, subject, html })` dùng SDK Resend (`RESEND_API_KEY`), tách interface `EmailProvider` để có thể đổi sang SendGrid/SES.
  > **Input:** `{ to, subject, html }`.
  > **Output:** `{ id }` khi ok, throw khi lỗi.
  > **File path:** `shinewpride-app/app/services/email/provider.server.ts`. Cài SDK tương ứng.
  > **Ảnh hưởng hệ thống:** Lớp gửi mail dùng chung cho scheduler (4.4) và test (4.5).

### Task 4.2 — App Proxy nhận đăng ký email từ popup → lưu DB
- **Chức năng:** Storefront gửi email subscriber về app, lưu `Subscriber` và đồng bộ Shopify customer.
- **Input:** POST `{ email }` từ form popup qua app proxy.
- **Output:** record `Subscriber` (DB) + tạo/cập nhật customer trên Shopify (tag newsletter).
- **Công nghệ sử dụng:** Shopify App Proxy (verify signature), Remix action, Zod (validate), Prisma (upsert), Shopify Admin GraphQL (`customerCreate`/`customerUpdate`), TypeScript.
- **Mô tả:** Route `proxy.subscribe.tsx` xác thực chữ ký app proxy; upsert subscriber; gọi Admin API tạo customer.
- **Prompt cho AI agent:**
  > **Mô tả:** Tạo route `proxy.subscribe.tsx` (app proxy). Action: verify proxy signature; validate email (zod); upsert `Subscriber{ email, shopDomain, source:'popup', status:'active' }`; gọi `customerCreate`/`customerUpdate` gắn tag `newsletter,popup-discount`. Trả JSON.
  > **Input:** POST form/json `{ email }` từ storefront.
  > **Output:** `json({ ok, code: 'WELCOME10' })`; bản ghi DB + customer Shopify.
  > **File path:** `shinewpride-app/app/routes/proxy.subscribe.tsx`.
  > **Ảnh hưởng hệ thống:** Kết nối popup theme với DB & Shopify customers. Phụ thuộc 1.3, 1.4. Liên quan Task 4.3 (sửa popup theme).

### Task 4.3 — Nối popup email của theme vào App Proxy
- **Chức năng:** Form popup hiện tại gửi tới app proxy thay vì chỉ `/contact`.
- **Input:** `snippets/email-discount-popup.liquid`, `assets/email-popup.js`.
- **Output:** popup gửi email tới `/apps/shinewpride/subscribe`, hiển thị mã WELCOME10.
- **Công nghệ sử dụng:** Vanilla JavaScript (`fetch`), Shopify App Proxy URL, Shopify Liquid (snippet), Web Components (custom element popup hiện có).
- **Mô tả:** Sửa JS theme để fetch app proxy; vẫn fallback giữ luồng `/contact` nếu cần.
- **Prompt cho AI agent:**
  > **Mô tả:** Trong THEME, sửa `assets/email-popup.js` để khi submit, gọi `fetch('/apps/shinewpride/subscribe', {method:'POST', body})` rồi hiện màn success + mã giảm giá. Giữ markup `snippets/email-discount-popup.liquid`, chỉ đổi đích submit/handler JS.
  > **Input:** `assets/email-popup.js`, `snippets/email-discount-popup.liquid`.
  > **Output:** đăng ký email lưu vào DB qua app proxy; UX không đổi.
  > **File path:** `shinewpride-theme/assets/email-popup.js` (và nếu cần `shinewpride-theme/snippets/email-discount-popup.liquid`).
  > **Ảnh hưởng hệ thống:** Sửa THEME (storefront). Phụ thuộc Task 4.2 phải sống. Test submit thật.

### Task 4.4 — Scheduler gửi mail 18:00 & 20:00
- **Chức năng:** Chạy đúng 18:00 và 20:00 (theo timezone shop), lấy campaign active + subscriber, gửi mail, ghi log.
- **Input:** thời gian hệ thống, `EmailCampaign` active, danh sách `Subscriber` active.
- **Output:** email được gửi tới subscriber; `EmailSendLog` cho từng người.
- **Công nghệ sử dụng:** node-cron (hoặc BullMQ repeatable jobs + Redis/ioredis), timezone (`Asia/Ho_Chi_Minh`), Prisma, Resend (qua service 4.1), Node.js, TypeScript.
- **Mô tả:** Dùng **node-cron** (`0 18 * * *`, `0 20 * * *`, timezone) hoặc **BullMQ repeatable jobs** (khuyến nghị production: retry, không trùng khi scale nhiều instance). Tránh gửi trùng bằng khoá theo ngày+slot.
- **Prompt cho AI agent:**
  > **Mô tả:** Viết `scheduler.server.ts`: khởi tạo 2 cron job 18:00 và 20:00 (timezone cấu hình, mặc định `Asia/Ho_Chi_Minh`). Mỗi lần chạy: lấy `EmailCampaign` active theo slot → lấy `Subscriber` status active → gửi qua `sendEmail` → ghi `EmailSendLog`. Đảm bảo idempotent (không gửi 2 lần/slot/ngày). Khởi động scheduler khi app boot (chỉ 1 instance).
  > **Input:** DB campaigns + subscribers; giờ hệ thống.
  > **Output:** email đã gửi + log; an toàn khi chạy lại.
  > **File path:** `shinewpride-app/app/services/email/scheduler.server.ts` (+ hook khởi động trong server entry). Cài `node-cron` hoặc `bullmq`+`ioredis`.
  > **Ảnh hưởng hệ thống:** Gửi email thật theo lịch; dùng provider (4.1) + DB (1.3) + subscriber (4.2). Cẩn trọng deploy nhiều instance.

### Task 4.5 — Admin UI quản lý campaign & subscriber
- **Chức năng:** Tạo/sửa nội dung email, gán slot 18:00/20:00, bật/tắt; xem subscriber & log gửi.
- **Input:** dữ liệu DB.
- **Output:** trang Polaris CRUD campaign + bảng subscriber + bảng log; nút "Gửi thử".
- **Công nghệ sử dụng:** Remix (loader/action), React, Shopify Polaris (Form, DataTable/IndexTable), App Bridge, Prisma, TypeScript.
- **Mô tả:** Để merchant tự quản nội dung mail và theo dõi.
- **Prompt cho AI agent:**
  > **Mô tả:** Tạo route `app.campaigns.tsx` (CRUD `EmailCampaign`: name, subject, htmlTemplate, scheduleSlot, active; nút "Send test" gọi `sendEmail` tới email nhập) và `app.subscribers.tsx` (bảng `Subscriber` + `EmailSendLog`, lọc theo status). Dùng Polaris + Remix loader/action.
  > **Input:** thao tác người dùng trong admin.
  > **Output:** dữ liệu campaign/subscriber được xem & chỉnh; gửi thử hoạt động.
  > **File path:** `shinewpride-app/app/routes/app.campaigns.tsx`, `shinewpride-app/app/routes/app.subscribers.tsx`.
  > **Ảnh hưởng hệ thống:** Giao diện vận hành cho PHA 4. Phụ thuộc 1.3, 4.1.

---

## PHA 5 — Triển khai & vận hành

### Task 5.1 — Hạ tầng & deploy
- **Chức năng:** Đưa app + DB + (Redis nếu dùng BullMQ) lên môi trường chạy 24/7.
- **Input:** app hoàn chỉnh.
- **Output:** app chạy production (Fly.io/Railway/Render), DB PostgreSQL managed, biến môi trường, webhook đã đăng ký.
- **Công nghệ sử dụng:** Docker, Fly.io/Railway/Render, PostgreSQL managed (Neon/Supabase/RDS), Redis (nếu BullMQ), `prisma migrate deploy`, Shopify CLI deploy, biến môi trường/secrets.
- **Mô tả:** Scheduler cần process chạy liên tục → KHÔNG dùng serverless cho cron (hoặc tách cron sang worker riêng / hosted cron). 
- **Prompt cho AI agent:**
  > **Mô tả:** Viết cấu hình deploy (Dockerfile/`fly.toml` hoặc Railway), chạy `prisma migrate deploy` khi release, đảm bảo 1 process chạy scheduler (worker riêng nếu nhiều instance). Cấu hình secrets.
  > **Input:** app + `.env` production.
  > **Output:** app + DB online, OAuth/app proxy/webhook hoạt động trên store thật.
  > **File path:** `shinewpride-app/Dockerfile`, `shinewpride-app/fly.toml` (hoặc tương đương).
  > **Ảnh hưởng hệ thống:** Đưa toàn bộ backend vào hoạt động. Phụ thuộc tất cả PHA trước.

### Task 5.2 — Logging, retry & cảnh báo
- **Chức năng:** Theo dõi lỗi watermark/email, retry, cảnh báo.
- **Input:** các luồng webhook/scheduler.
- **Output:** log có cấu trúc + retry job lỗi + (tuỳ chọn) thông báo lỗi.
- **Công nghệ sử dụng:** pino (structured logging), BullMQ (retry/backoff), Redis, (tuỳ chọn) Sentry hoặc Slack/email alert, TypeScript.
- **Prompt cho AI agent:**
  > **Mô tả:** Thêm logging có cấu trúc (pino) cho watermark & email; với BullMQ bật retry/backoff; dashboard/route xem job thất bại; (tuỳ chọn) gửi cảnh báo khi tỉ lệ lỗi cao.
  > **Input:** các service hiện có.
  > **Output:** quan sát được lỗi, tự retry, dễ debug.
  > **File path:** `shinewpride-app/app/services/**` (bổ sung), route admin log.
  > **Ảnh hưởng hệ thống:** Tăng độ tin cậy vận hành; không đổi hành vi storefront.

---

## Thứ tự thực hiện đề xuất (phụ thuộc)

1. **PHA 1** (1.1 → 1.2 → 1.3 → 1.4) — nền tảng, làm trước tiên.
2. **PHA 2** (2.1 → 2.2 → 2.3 → 2.4 → 2.5) — watermark.
3. **PHA 4** (4.1 → 4.2 → 4.3 → 4.4 → 4.5) — email theo lịch (cần DB từ PHA 1).
4. **PHA 3** (3.1 → 3.2 → 3.3 → 3.4) — chặn lưu ảnh (độc lập, có thể làm song song sau PHA 1).
5. **PHA 5** (5.1 → 5.2) — deploy & vận hành, cuối cùng.

## Tóm tắt khuyến nghị Database framework cho Shopify
- **Nên dùng:** **Prisma ORM + PostgreSQL** (chuẩn template Shopify Remix, type-safe, host dễ trên Neon/Supabase/Railway/RDS).
- **Dev nhanh:** SQLite (chỉ đổi provider) — không dùng cho production.
- **Thay thế:** MySQL/PlanetScale (vẫn Prisma) hoặc MongoDB + Mongoose (nếu cần NoSQL).
- **Hàng đợi/lịch:** node-cron (đơn giản) hoặc BullMQ + Redis (production, retry, không trùng).
