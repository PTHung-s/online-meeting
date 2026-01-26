import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';
import 'dotenv/config';
import { roomManager } from './room.manager.js';
import { registerMeetingHandlers } from './sockets/meeting.handler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export for use in meeting.handler
export const getMusicDirectory = () => path.join(__dirname, '../public/music');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 20e6 // 20MB limit for uploading large assignments (PDFs)
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Serve music files
app.use('/music', express.static(path.join(__dirname, '../public/music')));

// API to get music playlist
app.get('/api/music/playlist', (req, res) => {
  const musicDir = path.join(__dirname, '../public/music');
  
  try {
    if (!fs.existsSync(musicDir)) {
      return res.json({ error: 'Music directory not found', path: musicDir, files: [] });
    }
    const files = fs.readdirSync(musicDir).filter((f: string) => f.toLowerCase().endsWith('.mp3'));
    res.json({ path: musicDir, files });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// LiveKit credentials từ .env
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

app.get('/api/token', async (req, res) => {
  const { room, identity, name } = req.query;

  if (typeof room !== 'string' || typeof identity !== 'string') {
    return res.status(400).json({ error: 'room and identity are required' });
  }

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(500).json({ error: 'LiveKit server-side keys not configured' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: identity,
    name: (name as string) || identity,
  });

  at.addGrant({
    roomJoin: true,
    room: room,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: await at.toJwt() });
});

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: roomManager.listRooms() });
});

app.post('/api/rooms', (req, res) => {
  const { name, password } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Tên phòng là bắt buộc' });
  }
  const roomId = roomManager.createRoom(name, password);
  io.emit('room:list', roomManager.listRooms());
  res.json({ id: roomId });
});

// AI Chat Endpoint with Gemini Flash
app.post('/api/ai/chat', async (req, res) => {
  const { message, history, attachments, roomId, userName } = req.body;
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Google AI API Key not configured' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: "Bạn là một giảng viên lập trình cực kỳ nghiêm khắc và khó tính. Nhưng lại rất tận tâm với học sinh, luôn giải thích và hướng dẫn mọi thứ thật dễ hiểu, ngay cả học sinh lớp 5 cũng hiểu được" +
                         "Nhiệm vụ của bạn là hỗ trợ sinh viên hiểu đề bài, tìm ra lỗi sai trong code của họ và gợi ý hướng giải quyết đúng. " +
                         "QUY TẮC CỐT LÕI: " +
                         "1. TUYỆT ĐỐI KHÔNG viết code hộ sinh viên dưới bất kỳ hình thức nào. " +
                         "2. Không cung cấp lời giải trực tiếp hay spoil quá sâu; hãy để sinh viên tự tư duy. " +
                         "3. Chỉ ra vị trí hoặc logic sai và giải thích khái niệm để sinh viên tự sửa. " +
                         "4. Trả lời cực kỳ ngắn gọn, súc tích, đi thẳng vào vấn đề. " +
                         "5. Mỗi câu trả lời KHÔNG ĐƯỢC VƯỢT QUÁ 10 câu văn. " +
                         "6. Nếu bạn thấy phần giải thích dài hoặc hướng dẫn cần nhiều bước thì cứ tách nhỏ hỏi và trao đổi với học sinh qua nhiều lần hội thoại " +
                         "7. Nếu bạn thấy cần thêm thông tin gì như là đề, bài làm của học sinh hay các loại thông tin khác thì luôn yêu cầu học sinh cung cấp thêm để không bịa thông tin " +
                         "8. Luôn giải thích mọi thứ thật dễ hiểu, giống như học sinh chưa từng biết kiến thức đó nhé." +
                         "Ngôn ngữ: Tiếng Việt."
    });

    // Handle current message parts including attachments
    const messageParts: any[] = [{ text: message }];
    
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((att: any) => {
        if (att.fileData && att.mimeType) {
          messageParts.push({
            inlineData: {
              data: att.fileData,
              mimeType: att.mimeType
            }
          });
        } else if (att.content) {
          messageParts[0].text += `\n\n[Đính kèm ${att.label}]:\n${att.content}`;
        }
      });
    }

    // Sanitize history and include attachments as inlineData if present
    const sanitizedHistory = (history || []).map((item: any) => {
      const parts: any[] = Array.isArray(item.parts) 
        ? item.parts.map((p: any) => ({ text: p.text || "" })) 
        : [{ text: String(item.parts) }];
      
      if (item.attachments && Array.isArray(item.attachments)) {
        item.attachments.forEach((att: any) => {
          if (att.fileData && att.mimeType) {
            parts.push({
              inlineData: {
                data: att.fileData,
                mimeType: att.mimeType
              }
            });
          } else if (att.content) {
            parts[0].text += `\n\n[Đính kèm ${att.label}]:\n${att.content}`;
          }
        });
      }
      
      return {
        role: item.role,
        parts: parts
      };
    });

    const chat = model.startChat({
      history: sanitizedHistory,
    });

    const result = await chat.sendMessage(messageParts);
    const response = await result.response;
    const text = response.text();

    // Save history to room manager if we have identifiers
    if (roomId && userName) {
      const room = roomManager.getRoom(roomId);
      if (room) {
        if (!room.aiHistory) room.aiHistory = new Map();
        
        const userHistory = room.aiHistory.get(userName) || [];
        const newUserMsg = { 
          role: 'user', 
          parts: [{ text: message }],
          attachments: attachments // We store full attachments for restoration
        };
        const newModelMsg = { 
          role: 'model', 
          parts: [{ text: text }] 
        };
        
        const updatedHistory = [...userHistory, newUserMsg, newModelMsg].slice(-50);
        room.aiHistory.set(userName, updatedHistory);
      }
    }

    res.json({ reply: text });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: 'Failed to get AI response', details: error.message });
  }
});

app.post('/api/ai/generate-quiz', async (req, res) => {
  const { topic, count, context } = req.body;
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('Quiz Gen Error: API Key missing');
    return res.status(500).json({ error: 'API Key not found' });
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-flash-latest as requested
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    const systemPrompt = `Bạn là một trợ lý giáo dục chuyên nghiệp.
    Hãy tạo ${count || 3} câu hỏi trắc nghiệm về chủ đề: "${topic}".
    Yêu cầu:
    1. Trả về DUY NHẤT một mảng JSON format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "..."}].
    2. correctAnswer là index (0-3).
    3. Tránh trùng lặp với các câu hỏi này: ${JSON.stringify(context || [])}.
    4. Ngôn ngữ: Tiếng Việt.
    5. QUY TẮC CỐT LÕI VỀ ĐỊNH DẠNG:
       - Phần "question" và "explanation" BẮT BUỘC sử dụng Markdown để hiển thị code.
       - Dùng \`code\` cho inline và \`\`\` cho khối code nhiều dòng.
       - !!! QUAN TRỌNG: BẮT BUỘC phải có 2 dấu xuống dòng (\\n\\n) trước và sau mỗi khối code \`\`\` để Markdown renderer hiểu đúng.
       - TRONG JSON: TUYỆT ĐỐI KHÔNG dùng xuống dòng thực tế. Mọi dấu xuống dòng bên trong nội dung phải được tích hợp thành ký tự "\\n".
       - Đảm bảo JSON valid 100%, không có văn bản thừa ngoài mảng JSON.`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const rawText = response.text();
    
    // Clean up potential markdown code blocks around the JSON
    let jsonText = rawText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json/, '').replace(/```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```/, '').replace(/```$/, '');
    }
    
    // Find the first [ and last ] to extract only the JSON array
    const firstBracket = jsonText.indexOf('[');
    const lastBracket = jsonText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonText = jsonText.substring(firstBracket, lastBracket + 1);
    }

    try {
      // 1. Try direct parse first (cleanest)
      const questions = JSON.parse(jsonText);
      console.log(`✅ Generated ${questions.length} questions for topic: ${topic}`);
      return res.json({ questions });
    } catch (parseError: any) {
      console.warn('⚠️ Standard JSON.parse failed, attempting to clean strings...');
      
      try {
        // 2. Try to fix the most common AI error: literal newlines inside double-quoted strings
        // This regex finds content between double quotes and replaces real newlines with \n
        const fixedJson = jsonText.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
          return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        });
        
        const questions = JSON.parse(fixedJson);
        console.log(`✅ Generated ${questions.length} questions after cleanup`);
        return res.json({ questions });
      } catch (secondError: any) {
        console.error('❌ All JSON parse attempts failed');
        console.log('Raw text from AI:', rawText);
        return res.status(500).json({ 
          error: 'AI returned invalid JSON format', 
          details: secondError.message 
        });
      }
    }
  } catch (error: any) {
    console.error('Quiz Gen Error:', error);
    res.status(500).json({ error: 'AI generation failed', details: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  registerMeetingHandlers(io, socket);
});

// Serve index.html for all other routes (SPA)
app.use((req, res, next) => {
  // Skip API and socket.io routes
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
