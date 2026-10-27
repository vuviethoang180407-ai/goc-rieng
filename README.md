# Góc riêng

**[Mở ứng dụng →](https://goc-rieng-workspace-271026.epiclion2049.chatgpt.site/)**

Không gian làm việc cá nhân bằng tiếng Việt, với bốn chỉ số cốt lõi, ghi chép riêng tư và những kết nối có chọn lọc.

## Truy cập

Mở đường link phía trên rồi đăng nhập bằng ChatGPT để sử dụng không gian của bạn. Muốn kết nối với người khác, vào **Bạn bè → Sao chép liên kết mời**.

## Tính năng

- Bốn chỉ số: tên, giá trị hiện tại, mục tiêu, mô tả và tiến độ.
- Ghi chép, việc ưu tiên, tri thức, nhìn lại và mục tiêu cá nhân.
- Kết bạn qua mã hoặc liên kết mời, có xác nhận của người nhận.
- Kế hoạch chung: lịch hẹn, mời thành viên, giao việc và hạn chót.
- Tin nhắn văn bản giữa hai người bạn, cập nhật mỗi 5 giây.
- Dữ liệu cá nhân lưu theo tài khoản; hồ sơ bạn bè chỉ chia sẻ tên và giới thiệu.

## Công nghệ

React, TypeScript, Vinext, Cloudflare Workers, D1 và Drizzle. Bản đang hoạt động được triển khai trên Sites. GitHub lưu mã nguồn và dẫn tới ứng dụng; GitHub Pages không chạy phần máy chủ và cơ sở dữ liệu của ứng dụng này.

## Phát triển cục bộ

Yêu cầu Node.js 24 và npm.

```sh
npm run install:ci
npm run db:generate
npm run build
```

Áp dụng các migration SQL trong thư mục `drizzle/` theo thứ tự bằng Wrangler D1 ở chế độ local; không chạy lại migration đã áp dụng:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clumsy_the_fallen.sql
npm run dev
```

Đăng nhập thử nghiệm chỉ được mô phỏng trong môi trường phát triển loopback. Xác thực khi chạy trên Sites do nền tảng quản lý; không gửi header giả danh người dùng tới bản triển khai.

## Kiểm tra

```sh
node scripts/test-social.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Bộ kiểm tra API dùng cơ sở dữ liệu trong bộ nhớ và ba tài khoản mô phỏng; không tác động tới dữ liệu người dùng thật.

## Triển khai

Bản trực tiếp hiện tại nằm tại [Góc riêng](https://goc-rieng-workspace-271026.epiclion2049.chatgpt.site/). Đẩy mã lên GitHub không tự triển khai ứng dụng. Việc xuất bản bản cập nhật cần quy trình Sites và cấu hình lưu trữ/xác thực của môi trường đó.

Không đưa tệp môi trường, thông tin đăng nhập, dữ liệu cục bộ hay thư mục `.wrangler/` vào kho mã.
