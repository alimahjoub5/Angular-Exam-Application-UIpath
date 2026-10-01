import { HttpClient } from '@angular/common/http';
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

  async generateExam(count: number, mode: 'small' | 'real'): Promise<QuizQuestion[]> {
    const response = await firstValueFrom(
      this.http.post<GenerateExamResponse>('/api/generate-exam', {
        count,
        mode
      })
    );

    if (!response.questions?.length) {
      throw new Error('The AI service returned no questions.');
    }

    return response.questions.map((question, index) => ({
      ...question,
      id: question.id ?? Date.now() + index
    }));
  }
}
