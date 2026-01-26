# Code Editor Integration - Hướng dẫn sử dụng

## Tổng quan

Dự án video-call đã được tích hợp thêm tính năng Code Editor với Piston API để compile code trực tiếp. Tính năng này cho phép:

1. **Code Editor cá nhân**: Mỗi người tham gia có thể viết code riêng của mình
2. **Sync code**: Code được sync giữa các người tham gia qua Socket.IO
3. **Admin xem code**: Host của phòng có thể xem code của các học viên khác
4. **Resizable Split View**: Có thể chia đôi màn hình giữa Code Editor và Video Meeting
5. **Input (stdin)**: Có thể nhập input cho chương trình khi chạy

## Tính năng chính

### 1. Code Editor cá nhân
- **Monaco Editor**: Code editor chuyên nghiệp giống VS Code
- **Hỗ trợ nhiều ngôn ngữ**: Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, PHP, Ruby
- **Compile code**: Sử dụng Piston API để compile và chạy code
- **Input (stdin)**: Có thể nhập input cho chương trình (ví dụ: dữ liệu đầu vào)
- **Download code**: Có thể tải code về máy
- **Auto-sync**: Code được tự động sync đến server (debounced 500ms)

### 2. Admin xem code học viên
- **Chỉ host mới xem**: Chỉ người tạo phòng (host) mới có thể xem code người khác
- **Panel sidebar**: Hiển thị danh sách học viên và code của họ
- **Trạng thái**: Hiển thị ai đang code, ai chưa có code
- **Preview code**: Có thể xem code ngay trong sidebar mà không cần mở editor riêng

### 3. Resizable Split View
- **Chia đôi màn hình**: Code Editor ở bên trái, Video Meeting ở bên phải
- **Kéo để resize**: Có thể kéo handle ở giữa để thay đổi tỉ lệ hiển thị
- **Min/Max width**: Code Editor từ 20% đến 80% màn hình

## Cách sử dụng

### Bật Code Editor
1. Tham gia vào phòng meeting
2. Nhấn nút **Code** (icon code) ở góc trên bên phải
3. Màn hình sẽ chia đôi: Code Editor bên trái, Video Meeting bên phải
4. Kéo handle ở giữa để điều chỉnh kích thước Code Editor

### Viết và chạy code
1. Chọn ngôn ngữ lập trình từ dropdown (mặc định: Python 3.10.0)
2. Viết code trong Monaco Editor
3. **Nhập input (nếu cần)**: Trong panel Input, nhập dữ liệu cho chương trình
   - Ví dụ: Với Python, nhập "5 10" để chương trình tính tổng
   - Nút Clear để xóa input
   - Input chỉ có thể chỉnh khi đang code của mình, không khi xem code người khác
4. Nhấn nút **Run** để compile và chạy code
5. Kết quả sẽ hiển thị ở panel Output bên dưới

### Xem code học viên (chỉ cho Host)
1. Đảm bảo bạn là Host của phòng (người tạo phòng)
2. Nhấn nút **Eye** (icon mắt) ở góc trên bên phải
3. Panel sidebar sẽ hiện ra bên phải
4. Nhấn vào học viên muốn xem code
5. Code của học viên sẽ hiển thị trong sidebar

## Socket.IO Events

### Client gửi:
- `code:sync` - Sync code của mình đến server
  ```typescript
  socket.emit('code:sync', { 
    roomId, 
    code, 
    language: { name, version } 
  });
  ```

- `code:request` - Yêu cầu xem code của người khác (chỉ host)
  ```typescript
  socket.emit('code:request', { 
    roomId, 
    targetSocketId 
  });
  ```

### Client nhận:
- `code:sync` - Nhận code sync từ người khác
  ```typescript
  socket.on('code:sync', ({ socketId, code, language }) => {
    // Lưu code của người khác vào store
  });
  ```

- `code:response` - Nhận code từ server khi request
  ```typescript
  socket.on('code:response', ({ socketId, code, language }) => {
    // Lưu code được trả về
  });
  ```

## Server API

### Socket.IO Events
- `code:sync` - Nhận và broadcast code đến tất cả người trong phòng
- `code:request` - Trả về code của người được yêu cầu (chỉ host có thể request)

### REST API
- `POST /api/rooms` - Tạo phòng mới
- `GET /api/rooms` - Lấy danh sách phòng
- `GET /api/token` - Lấy LiveKit JWT token

## Environment Variables

### Client (.env)
```env
VITE_LIVEKIT_URL=your-project.livekit.cloud
```

### Server (.env)
```env
LIVEKIT_URL=https://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
PORT=5000
```

## Piston API

Code sử dụng Piston API (https://emkc.org/api/v2/piston) để compile code:

- **Execute**: `POST /api/v2/piston/execute`
- **Runtimes**: `GET /api/v2/piston/runtimes`

### Ngôn ngữ được hỗ trợ
- Python 3.10.0
- JavaScript 18.15.0
- TypeScript 5.0.3
- Java 17.0.0
- C 10.2.1
- C++ 10.2.1
- C# 6.12.0
- Go 1.19.5
- Rust 1.68.2
- PHP 8.2.3
- Ruby 3.2.1

### Input (stdin) Processing
- Piston API hỗ trợ input (stdin) để truyền dữ liệu vào chương trình
- Ví dụ: Với Python, bạn có thể nhập "5 10" để chương trình tính tổng
- Input được gửi cùng với code khi chạy
- Nút Clear để xóa input hiện tại
- Input chỉ có thể chỉnh khi đang code của mình, không khi xem code người khác

## Cấu trúc file

### Client
```
video-call/client/
├── src/
│   ├── components/
│   │   ├── CodeEditor.tsx          # Monaco Editor với sync và stdin
│   │   ├── PeerCodeViewer.tsx      # Admin xem code người khác
│   │   └── ResizableSplitView.tsx # Layout chia đôi màn hình
│   ├── services/
│   │   ├── piston.ts              # Piston API service
│   │   └── socket.ts             # Socket.IO client
│   ├── store/
│   │   └── useMeetingStore.ts    # Zustand store với state code editor
│   └── pages/
│       └── MeetingPage.tsx        # Meeting page với code editor
```

### Server
```
video-call/server/
├── src/
│   ├── sockets/
│   │   └── meeting.handler.ts    # Socket.IO handlers (code:sync, code:request)
│   ├── room.manager.ts             # Quản lý phòng
│   └── types.ts                  # Types với Participant.code, Participant.language
```

## Lưu ý quan trọng

1. **Chỉ host mới xem code người khác**: Tính năng xem code chỉ hoạt động cho người tạo phòng
2. **Code được sync tự động**: Code được sync mỗi khi có thay đổi (debounced 500ms)
3. **Read-only khi xem code**: Khi đang xem code người khác, editor ở chế độ read-only
4. **Không thể run code người khác**: Nút Run bị vô hiệu hóa khi đang xem code người khác
5. **Peer code được cache**: Code của người khác được lưu trong store để tránh request nhiều lần
6. **Input (stdin) chỉ hoạt động khi chạy code của mình**: Không thể nhập input khi đang xem code người khác
7. **Host có thể edit code học viên**: Host có thể chỉnh code của học viên trong sidebar, và thay đổi sẽ được sync

## Troubleshooting

### Code không sync
- Kiểm tra kết nối Socket.IO
- Kiểm tra xem có đang ở trong cùng phòng không
- Kiểm tra console logs

### Không thể compile code
- Kiểm tra kết nối internet
- Kiểm tra Piston API status (https://emkc.org)
- Kiểm tra syntax code

### Không xem được code học viên
- Đảm bảo bạn là Host của phòng
- Kiểm tra xem học viên đã có code chưa
- Kiểm tra console logs

## Deployment

### Docker
```bash
docker compose up -d --build
```

### Development
```bash
# Server
cd video-call/server
npm run dev

# Client
cd video-call/client
npm run dev

# Hoặc chạy cả hai
cd video-call
npm run dev
```

## Tính năng tương lai (có thể thêm)
- [ ] Share code link để mời người khác xem
- [ ] Code templates cho các bài tập
- [ ] Auto-save code vào localStorage
- [ ] Code history/undo/redo
- [ ] Multi-file support
- [ ] Collaborative coding (real-time sync)
- [ ] Code completion/intellisense
- [ ] Syntax checking/linting
