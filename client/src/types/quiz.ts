export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of the correct option
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  timeLimit?: number; // In seconds
  createdAt: number;
}

export interface QuizResponse {
  userId: string;
  userName: string;
  quizId: string;
  answers: {
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
  }[];
  score: number;
  timeTaken: number;
  completedAt: number;
}

export interface QuizStats {
  quizId: string;
  totalParticipants: number;
  questionStats: {
    questionId: string;
    correctCount: number;
    incorrectCount: number;
    distribution: number[]; // Count per option
  }[];
  rankings: {
    userId: string;
    userName: string;
    score: number;
    timeTaken: number;
  }[];
}
