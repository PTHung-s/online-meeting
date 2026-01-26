export type AiMessage = {
  id?: string;
  role: 'user' | 'model';
  parts: [{ text: string }];
  attachments?: AiAttachment[];
};

export interface AiAttachment {
  id: string;
  label: string;
  content: string;
  type: 'code' | 'terminal' | 'input' | 'assignment';
  fileData?: string; // Base64 data (without prefix)
  mimeType?: string; // e.g., 'image/png' or 'application/pdf'
}
