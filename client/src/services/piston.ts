import axios from 'axios';

const PISTON_API_URL = 'https://emkc.org/api/v2/piston';

export interface PistonLanguage {
  name: string;
  version: string;
  aliases: string[];
  runtime: string;
}

export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{
    name: string;
    content: string;
  }>;
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
}

export interface PistonExecuteResponse {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
    message?: string;
  };
  language: string;
  version: string;
}

export const pistonService = {
  async getLanguages(): Promise<PistonLanguage[]> {
    try {
      const response = await axios.get(`${PISTON_API_URL}/runtimes`);
      return response.data;
    } catch (error) {
      console.error('Error fetching languages:', error);
      throw error;
    }
  },

  async executeCode(request: PistonExecuteRequest): Promise<PistonExecuteResponse> {
    try {
      const response = await axios.post(`${PISTON_API_URL}/execute`, request);
      return response.data;
    } catch (error) {
      console.error('Error executing code:', error);
      throw error;
    }
  }
};

// Predefined common languages for quick access
export const commonLanguages = [
  { name: 'python', version: '3.10.0' },
  { name: 'javascript', version: '18.15.0' },
  { name: 'typescript', version: '5.0.3' },
  { name: 'java', version: '17.0.0' },
  { name: 'c', version: '10.2.1' },
  { name: 'cpp', version: '10.2.0' },
  { name: 'csharp', version: '6.12.0' },
  { name: 'go', version: '1.19.5' },
  { name: 'rust', version: '1.68.2' },
  { name: 'php', version: '8.2.3' },
  { name: 'ruby', version: '3.2.1' },
];
