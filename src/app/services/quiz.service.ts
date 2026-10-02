import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseService } from './database.service';

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
}

export interface QuizAttempt {
  id: string;
  quizId: number;
  userId: number;
  questions: QuizQuestion[];
  userAnswers: (number | null)[]; // Index of selected option per question, null if not answered
  score: number;
  totalQuestions: number;
  percentageScore: number;
  timeSpent: number; // in seconds
  startedAt: Date;
  completedAt: Date;
  status: 'in-progress' | 'completed' | 'abandoned';
}

export interface QuizResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  timeSpent: number;
  passed: boolean;
  passingScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  difficultyBreakdown: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private quizAttempts$ = new BehaviorSubject<QuizAttempt[]>([]);
  private currentAttempt$ = new BehaviorSubject<QuizAttempt | null>(null);

  // Legacy static question bank removed. Active training content is AI-generated.
  private quizQuestions: QuizQuestion[] = [];

  constructor(private databaseService: DatabaseService) {
    this.loadAttempts();
  }

  private loadAttempts(): void {
    // Load from localStorage or initialize empty
    const stored = localStorage.getItem('quizAttempts');
    if (stored) {
      this.quizAttempts$.next(JSON.parse(stored));
    }
  }

  private saveAttempts(): void {
    localStorage.setItem('quizAttempts', JSON.stringify(this.quizAttempts$.value));
  }

  /**
   * Get all quiz questions
   */
  getQuizQuestions(): QuizQuestion[] {
    return this.quizQuestions;
  }

  /**
   * Get questions by topic
   */
  getQuestionsByTopic(topic: string): QuizQuestion[] {
    return this.quizQuestions.filter(q => q.topic === topic);
  }

  /**
   * Get shuffled questions for exam
   */
  getShuffledQuestions(count?: number): QuizQuestion[] {
    const questions = [...this.quizQuestions];
    // Fisher-Yates shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    return count ? questions.slice(0, count) : questions;
  }

  /**
   * Start a new quiz attempt
   */
  startQuizAttempt(questionCount: number = 10, timeMinutes: number = 30): QuizAttempt {
    const questions = this.getShuffledQuestions(questionCount);
    const attempt: QuizAttempt = {
      id: this.generateAttemptId(),
      quizId: 1,
      userId: 1, // In real app, get from auth service
      questions: questions,
      userAnswers: new Array(questions.length).fill(null),
      score: 0,
      totalQuestions: questions.length,
      percentageScore: 0,
      timeSpent: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      status: 'in-progress'
    };
    this.currentAttempt$.next(attempt);
    return attempt;
  }

  /**
   * Submit an answer for a question
   */
  submitAnswer(questionIndex: number, selectedOptionIndex: number): void {
    const attempt = this.currentAttempt$.value;
    if (attempt) {
      attempt.userAnswers[questionIndex] = selectedOptionIndex;
      this.currentAttempt$.next(attempt);
    }
  }

  /**
   * Complete the quiz and calculate results
   */
  completeQuiz(timeSpent: number): QuizResult {
    const attempt = this.currentAttempt$.value;
    if (!attempt) throw new Error('No active quiz attempt');

    let correctCount = 0;
    const difficultyBreakdown = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };

    attempt.questions.forEach((question, index) => {
      const difficulty = question.difficulty.toLowerCase() as keyof typeof difficultyBreakdown;
      difficultyBreakdown[difficulty].total++;

      if (attempt.userAnswers[index] === question.correctAnswer) {
        correctCount++;
        difficultyBreakdown[difficulty].correct++;
      }
    });

    const percentageScore = Math.round((correctCount / attempt.totalQuestions) * 100);
    const passingScore = 70;

    attempt.score = correctCount;
    attempt.percentageScore = percentageScore;
    attempt.timeSpent = timeSpent;
    attempt.completedAt = new Date();
    attempt.status = 'completed';

    // Save attempt
    const attempts = this.quizAttempts$.value;
    attempts.push(attempt);
    this.quizAttempts$.next(attempts);
    this.saveAttempts();

    const result: QuizResult = {
      attemptId: attempt.id,
      score: correctCount,
      totalQuestions: attempt.totalQuestions,
      percentageScore: percentageScore,
      timeSpent: timeSpent,
      passed: percentageScore >= passingScore,
      passingScore: passingScore,
      correctAnswers: correctCount,
      incorrectAnswers: attempt.totalQuestions - correctCount,
      unansweredQuestions: attempt.userAnswers.filter(a => a === null).length,
      difficultyBreakdown: difficultyBreakdown
    };

    this.currentAttempt$.next(null);
    return result;
  }

  /**
   * Get user's quiz attempt history
   */
  getUserAttempts(userId: number): Observable<QuizAttempt[]> {
    return this.quizAttempts$.pipe(
      map(attempts => attempts.filter(a => a.userId === userId && a.status === 'completed'))
    );
  }

  /**
   * Get current quiz attempt
   */
  getCurrentAttempt(): Observable<QuizAttempt | null> {
    return this.currentAttempt$.asObservable();
  }

  /**
   * Get quiz statistics
   */
  getQuizStatistics(userId: number) {
    const attempts = this.quizAttempts$.value.filter(a => a.userId === userId && a.status === 'completed');
    
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        totalTimeSpent: 0
      };
    }

    return {
      totalAttempts: attempts.length,
      averageScore: Math.round(attempts.reduce((sum, a) => sum + a.percentageScore, 0) / attempts.length),
      bestScore: Math.max(...attempts.map(a => a.percentageScore)),
      totalTimeSpent: attempts.reduce((sum, a) => sum + a.timeSpent, 0)
    };
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
