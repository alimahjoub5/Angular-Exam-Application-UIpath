import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QuizQuestion } from './quiz.service';

interface GenerateExamResponse {
  questions: QuizQuestion[];
}

export interface AiHealth {
  ok: boolean;
  configured: boolean;
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiExamService {
  constructor(private http: HttpClient) {}

  async health(): Promise<AiHealth> {
    return firstValueFrom(this.http.get<AiHealth>('/api/health'));
  }

  async generateExam(count: number, mode: 'small' | 'real', topic?: string): Promise<QuizQuestion[]> {
    try {
      const response = await firstValueFrom(
        this.http.post<GenerateExamResponse>('/api/generate-exam', {
          count,
          mode,
          topic
        })
      );

      if (!response.questions?.length) {
        throw new Error('The AI service returned no questions.');
      }

      return response.questions.map((question, index) => ({
        ...question,
        id: question.id ?? Date.now() + index
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const backendMessage =
          typeof error.error?.error === 'string'
            ? error.error.error
            : error.message;

        throw new Error(backendMessage || 'AI request failed.');
      }

      throw error;
    }
  }
}
