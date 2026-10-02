import { Component, OnInit, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { QuizService, QuizQuestion } from '../../services/quiz.service';
import { AiExamService } from '../../services/ai-exam.service';

@Component({
  selector: 'app-exam',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exam.html',
  styleUrl: './exam.css'
})
export class ExamComponent implements OnInit, OnDestroy {
  currentUser = signal(null as any);

  examSelected = signal(false);
  selectedExamType = signal<'small' | 'real' | null>(null);
  selectedTrainingTopic = signal('UI Automation');
  isTopicTraining = signal(false);

  readonly trainingTopics = [
    'Business Knowledge',
    'Platform Knowledge',
    'Studio Interface',
    'Variables and Arguments',
    'Control Flow',
    'Debugging',
    'Exception Handling',
    'Logging',
    'UI Automation',
    'Excel Automation',
    'Email Automation',
    'PDF Automation',
    'Data Manipulation',
    'Version Control Integration',
    'Libraries and Templates',
    'Workflow Analyzer',
    'Orchestrator',
    'Integration Service',
    'Document Understanding'
  ];

  isStarted = signal(false);
  currentQuestion = signal(0);
  timeRemaining = signal(0);
  totalTime = signal(0);
  selectedAnswers = signal<(number | null)[]>([]);
  lockedAnswers = signal<boolean[]>([]);
  questions = signal<QuizQuestion[]>([]);
  quizCompleted = signal(false);
  showAnswersReview = signal(false);
  result: any = null;

  isGenerating = signal(false);
  questionSource = signal<'ai' | 'hybrid' | 'local'>('local');
  generationMessage = signal('');
  generationStep = signal(0);
  toastMessage = signal('');
  toastType = signal<'success' | 'warning' | 'info'>('info');
  showToast = signal(false);
  aiStatus = signal<'checking' | 'connected' | 'not-configured' | 'offline'>('checking');
  aiModel = signal('');
  resumeAvailable = signal(false);
  savedExamLabel = signal('');
  private readonly savedExamKey = 'uipathSavedExamV2';
  private readonly retryPoolKey = 'uipathAiRetryPoolV2';
  private generationStageTimer: any;
  private toastTimer: any;

  private timerInterval: any;
  examDuration = { small: 30, real: 90 };

  cheatAttempts = signal(0);
  private maxCheatAttempts = 3;
  private lastBlurWarningTime = 0;
  private blurWarningCooldown = 5000;

  readonly String = String;

  constructor(
    private quizService: QuizService,
    private aiExamService: AiExamService,
    private authService: AuthService,
    private router: Router
  ) {
    effect(() => {
      const answers = this.selectedAnswers();
      if (answers.length > 0) {
        // Reserved for future autosave support.
      }
    });
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);

    // The public landing page already allows direct exam access.
    // Keep the current behavior while supporting authenticated users.
    window.addEventListener('beforeunload', this.onBeforeUnload);
    // One-time cleanup of legacy question/cache versions.
    localStorage.removeItem('uipathSavedExamV1');
    localStorage.removeItem('uipathAiRetryPoolV1');

    this.setupAntiCheatProtection();
    this.checkAiConnection();
    this.refreshResumeState();
  }

  async checkAiConnection(): Promise<void> {
    this.aiStatus.set('checking');

    try {
      const health = await this.aiExamService.health();
      this.aiModel.set(health.model);

      if (!health.configured) {
        this.aiStatus.set('not-configured');
        return;
      }

      this.aiStatus.set('connected');
    } catch (error) {
      console.warn('AI backend health check failed.', error);
      this.aiStatus.set('offline');
    }
  }

  private setupAntiCheatProtection(): void {
    document.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('copy', this.handleCopy);
    document.addEventListener('paste', this.handlePaste);
    document.addEventListener('cut', this.handleCut);
    document.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  async startQuiz(): Promise<void> {
    const examType = this.selectedExamType();
    if (!examType || this.isGenerating()) return;

    const questionCount = examType === 'small' ? 10 : 60;
    const timeMinutes = examType === 'small' ? 30 : 90;

    this.isGenerating.set(true);
    this.generationStep.set(1);
    this.generationMessage.set(
      examType === 'real'
        ? 'Building a balanced A-to-Z certification mock...'
        : 'Connecting to the AI question generator...'
    );
    this.startGenerationStages();

    let examQuestions: QuizQuestion[];

    try {
      if (examType === 'real') {
        const retryPool = this.getRetryPool().slice(0, questionCount);
        const freshCount = Math.max(0, questionCount - retryPool.length);
        const freshQuestions = await this.generateAiQuestionsInBatches(freshCount, 'real');
        examQuestions = this.shuffleQuestions([...retryPool, ...freshQuestions]);
        this.questionSource.set('ai');
        this.generationStep.set(4);
        this.generationMessage.set(
          `${retryPool.length} retry questions + ${freshQuestions.length} fresh AI questions ready.`
        );
        this.notify(
          'success',
          `Full AI mock ready — ${retryPool.length} retry + ${freshQuestions.length} fresh questions.`
        );
      } else {
        examQuestions = await this.generateAiQuestionsInBatches(questionCount, 'small');
        this.questionSource.set('ai');
        this.generationStep.set(4);
        this.generationMessage.set(`${examQuestions.length} fresh AI-generated questions are ready.`);
        this.notify('success', `AI questions received — ${examQuestions.length} fresh questions are ready.`);
      }
    } catch (error) {
      console.warn('AI exam generation failed.', error);
      this.stopGenerationStages();
      this.isGenerating.set(false);

      const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      this.generationMessage.set(`AI unavailable: ${errorMessage}`);
      this.notify('warning', `AI generation stopped: ${errorMessage}. No local questions were substituted.`);
      return;
    } finally {
      this.stopGenerationStages();
      this.isGenerating.set(false);
    }

    const attempt = this.quizService.startQuizAttempt(questionCount, timeMinutes);
    attempt.questions = examQuestions;
    attempt.totalQuestions = examQuestions.length;
    attempt.userAnswers = new Array(examQuestions.length).fill(null);

    this.questions.set(examQuestions);
    this.selectedAnswers.set(new Array(examQuestions.length).fill(null));
    this.lockedAnswers.set(new Array(examQuestions.length).fill(false));
    this.currentQuestion.set(0);
    this.totalTime.set(timeMinutes * 60);
    this.timeRemaining.set(timeMinutes * 60);
    this.isStarted.set(true);
    this.saveExamState();

    setTimeout(() => {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          console.warn('Fullscreen not available:', err);
        });
      }
    }, 100);

    this.startTimer();
  }

  selectTrainingTopic(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedTrainingTopic.set(value);
  }

  async startTopicTraining(): Promise<void> {
    if (this.isGenerating()) return;

    const topic = this.selectedTrainingTopic();
    const questionCount = 5;
    const timeMinutes = 15;

    this.isTopicTraining.set(true);
    this.selectedExamType.set('small');
    this.isGenerating.set(true);
    this.generationStep.set(1);
    this.generationMessage.set(`Creating 5 fresh AI questions for ${topic}...`);
    this.startGenerationStages();

    let examQuestions: QuizQuestion[];

    try {
      examQuestions = await this.generateAiQuestionsInBatches(questionCount, 'small', topic);
      this.questionSource.set('ai');
      this.generationStep.set(4);
      this.generationMessage.set(`${examQuestions.length} fresh ${topic} AI questions are ready.`);
      this.notify('success', `${topic} drill ready — 5 fresh AI questions.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      this.generationMessage.set(`AI unavailable: ${errorMessage}`);
      this.notify('warning', `AI generation stopped: ${errorMessage}`);
      return;
    } finally {
      this.stopGenerationStages();
      this.isGenerating.set(false);
    }

    const attempt = this.quizService.startQuizAttempt(examQuestions.length, timeMinutes);
    attempt.questions = examQuestions;
    attempt.totalQuestions = examQuestions.length;
    attempt.userAnswers = new Array(examQuestions.length).fill(null);

    this.questions.set(examQuestions);
    this.selectedAnswers.set(new Array(examQuestions.length).fill(null));
    this.lockedAnswers.set(new Array(examQuestions.length).fill(false));
    this.currentQuestion.set(0);
    this.totalTime.set(timeMinutes * 60);
    this.timeRemaining.set(timeMinutes * 60);
    this.isStarted.set(true);
    this.saveExamState();
    this.startTimer();
  }

  private async generateAiQuestionsInBatches(
    count: number,
    mode: 'small' | 'real',
    topic?: string
  ): Promise<QuizQuestion[]> {
    if (count <= 0) return [];

    const batchSize = 10;
    const generated: QuizQuestion[] = [];
    const generationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let offset = 0; offset < count; offset += batchSize) {
      const size = Math.min(batchSize, count - offset);
      const batchNumber = Math.floor(offset / batchSize) + 1;
      const totalBatches = Math.ceil(count / batchSize);

      this.generationMessage.set(
        `Generating fresh AI questions: batch ${batchNumber}/${totalBatches}...`
      );

      const batch = await this.aiExamService.generateExam(
        size,
        mode,
        topic,
        `${generationId}-${batchNumber}`
      );

      generated.push(
        ...batch.map((question, index) => ({
          ...question,
          id: Date.now() + offset + index
        }))
      );
    }

    return generated;
  }

  private questionKey(question: QuizQuestion): string {
    return question.question.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private getRetryPool(): QuizQuestion[] {
    try {
      const raw = localStorage.getItem(this.retryPoolKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const unique = new Map<string, QuizQuestion>();
      for (const question of parsed as QuizQuestion[]) {
        if (question?.question && Array.isArray(question.options)) {
          unique.set(this.questionKey(question), question);
        }
      }
      return Array.from(unique.values());
    } catch {
      return [];
    }
  }

  private updateRetryPoolAfterFullExam(): void {
    if (this.selectedExamType() !== 'real' || this.isTopicTraining()) return;

    const currentPool = new Map(
      this.getRetryPool().map(question => [this.questionKey(question), question])
    );

    this.questions().forEach((question, index) => {
      const key = this.questionKey(question);
      const answer = this.selectedAnswers()[index];

      if (answer === question.correctAnswer) {
        currentPool.delete(key);
      } else {
        currentPool.set(key, question);
      }
    });

    localStorage.setItem(
      this.retryPoolKey,
      JSON.stringify(Array.from(currentPool.values()))
    );
  }

  getRetryPoolSize(): number {
    return this.getRetryPool().length;
  }

  private shuffleQuestions(items: QuizQuestion[]): QuizQuestion[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.timeRemaining.update(time => {
        if (time <= 1) {
          this.submitQuiz();
          return 0;
        }
        const nextTime = time - 1;
        if (nextTime % 10 === 0) {
          queueMicrotask(() => this.saveExamState());
        }
        return nextTime;
      });
    }, 1000);
  }

  selectAnswer(optionIndex: number): void {
    if (this.selectedExamType() === 'real' && this.lockedAnswers()[this.currentQuestion()]) {
      return;
    }

    const answers = [...this.selectedAnswers()];
    answers[this.currentQuestion()] = optionIndex;
    this.selectedAnswers.set(answers);
    this.saveExamState();
  }

  goToQuestion(index: number): void {
    this.currentQuestion.set(index);
    this.saveExamState();
  }

  nextQuestion(): void {
    const next = this.currentQuestion() + 1;
    if (next < this.questions().length) {
      if (this.selectedExamType() === 'real') {
        const locked = [...this.lockedAnswers()];
        locked[this.currentQuestion()] = true;
        this.lockedAnswers.set(locked);
      }
      this.currentQuestion.set(next);
      this.saveExamState();
    }
  }

  previousQuestion(): void {
    const prev = this.currentQuestion() - 1;
    if (prev >= 0) {
      this.currentQuestion.set(prev);
      this.saveExamState();
    }
  }

  goBackToEdit(): void {
    if (this.selectedExamType() === 'real') {
      const locked = [...this.lockedAnswers()];
      locked[this.currentQuestion()] = false;
      this.lockedAnswers.set(locked);
    }
  }

  isAnswerLocked(): boolean {
    if (this.selectedExamType() !== 'real') return false;
    return this.lockedAnswers()[this.currentQuestion()] || false;
  }

  submitQuiz(): void {
    if (this.quizCompleted()) return;

    if (this.selectedExamType() === 'real') {
      this.lockedAnswers.set(this.lockedAnswers().map(() => true));
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    const timeSpent = this.totalTime() - this.timeRemaining();
    const answers = this.selectedAnswers();

    answers.forEach((answer, index) => {
      if (answer !== null) {
        this.quizService.submitAnswer(index, answer);
      }
    });

    this.result = this.quizService.completeQuiz(timeSpent);
    this.updateRetryPoolAfterFullExam();
    this.quizCompleted.set(true);
    this.isStarted.set(false);
    this.clearSavedExam();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
  }

  restartQuiz(): void {
    this.selectedExamType.set(null);
    this.examSelected.set(false);
    this.isStarted.set(false);
    this.quizCompleted.set(false);
    this.currentQuestion.set(0);
    this.selectedAnswers.set([]);
    this.questions.set([]);
    this.result = null;
    this.generationMessage.set('');
    this.generationStep.set(0);
    this.generationStep.set(0);
    this.questionSource.set('local');
    this.isTopicTraining.set(false);
    this.showToast.set(false);
  }

  selectExamType(type: 'small' | 'real'): void {
    this.selectedExamType.set(type);
    this.examSelected.set(true);
    this.generationMessage.set('');
  }

  goToDashboard(): void {
    this.router.navigate(['/']);
  }

  exitExam(): void {
    if (!this.isStarted()) return;

    const confirmed = confirm(
      'Exit the exam? Your generated questions, answers, current question, and remaining time will be saved so you can resume without using more AI tokens.'
    );

    if (confirmed) {
      this.saveExamState();
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
      this.isStarted.set(false);
      this.router.navigate(['/']);
    }
  }

  private saveExamState(): void {
    if (!this.isStarted() || this.quizCompleted() || !this.questions().length) return;

    const state = {
      version: 1,
      questions: this.questions(),
      answers: this.selectedAnswers(),
      lockedAnswers: this.lockedAnswers(),
      currentQuestion: this.currentQuestion(),
      timeRemaining: this.timeRemaining(),
      totalTime: this.totalTime(),
      examType: this.selectedExamType(),
      questionSource: this.questionSource(),
      isTopicTraining: this.isTopicTraining(),
      trainingTopic: this.selectedTrainingTopic(),
      savedAt: Date.now()
    };

    localStorage.setItem(this.savedExamKey, JSON.stringify(state));
    this.refreshResumeState();
  }

  private refreshResumeState(): void {
    try {
      const raw = localStorage.getItem(this.savedExamKey);
      if (!raw) {
        this.resumeAvailable.set(false);
        this.savedExamLabel.set('');
        return;
      }

      const state = JSON.parse(raw);
      if (!Array.isArray(state.questions) || state.questions.length === 0) {
        this.clearSavedExam();
        return;
      }

      this.resumeAvailable.set(true);
      const answered = Array.isArray(state.answers)
        ? state.answers.filter((answer: number | null) => answer !== null).length
        : 0;
      const mode = state.isTopicTraining
        ? `${state.trainingTopic || 'Topic'} drill`
        : state.examType === 'real'
          ? 'Full mock'
          : 'Practice sprint';
      this.savedExamLabel.set(`${mode} · ${answered}/${state.questions.length} answered`);
    } catch {
      this.clearSavedExam();
    }
  }

  resumeSavedExam(): void {
    try {
      const raw = localStorage.getItem(this.savedExamKey);
      if (!raw) {
        this.refreshResumeState();
        return;
      }

      const state = JSON.parse(raw);
      const savedQuestions = state.questions as QuizQuestion[];
      if (!Array.isArray(savedQuestions) || !savedQuestions.length) {
        this.clearSavedExam();
        return;
      }

      const examType: 'small' | 'real' = state.examType === 'real' ? 'real' : 'small';
      const totalTime = Number(state.totalTime) || (examType === 'real' ? 90 * 60 : 30 * 60);
      const remaining = Math.max(1, Math.min(Number(state.timeRemaining) || totalTime, totalTime));

      this.selectedExamType.set(examType);
      this.isTopicTraining.set(Boolean(state.isTopicTraining));
      if (typeof state.trainingTopic === 'string') {
        this.selectedTrainingTopic.set(state.trainingTopic);
      }
      this.questionSource.set(
        state.questionSource === 'ai' || state.questionSource === 'hybrid' ? state.questionSource : 'local'
      );

      const attempt = this.quizService.startQuizAttempt(savedQuestions.length, Math.ceil(totalTime / 60));
      attempt.questions = savedQuestions;
      attempt.totalQuestions = savedQuestions.length;
      attempt.userAnswers = new Array(savedQuestions.length).fill(null);

      this.questions.set(savedQuestions);
      this.selectedAnswers.set(
        Array.isArray(state.answers) && state.answers.length === savedQuestions.length
          ? state.answers
          : new Array(savedQuestions.length).fill(null)
      );
      this.lockedAnswers.set(
        Array.isArray(state.lockedAnswers) && state.lockedAnswers.length === savedQuestions.length
          ? state.lockedAnswers
          : new Array(savedQuestions.length).fill(false)
      );
      this.currentQuestion.set(
        Math.max(0, Math.min(Number(state.currentQuestion) || 0, savedQuestions.length - 1))
      );
      this.totalTime.set(totalTime);
      this.timeRemaining.set(remaining);
      this.examSelected.set(false);
      this.quizCompleted.set(false);
      this.isStarted.set(true);

      this.startTimer();
      this.notify('success', 'Saved exam restored — no new AI request was made.');
    } catch (error) {
      console.warn('Unable to restore saved exam.', error);
      this.clearSavedExam();
      this.notify('warning', 'The saved exam could not be restored.');
    }
  }

  discardSavedExam(): void {
    const confirmed = confirm('Delete the saved exam and its generated questions?');
    if (confirmed) {
      this.clearSavedExam();
    }
  }

  private clearSavedExam(): void {
    localStorage.removeItem(this.savedExamKey);
    this.resumeAvailable.set(false);
    this.savedExamLabel.set('');
  }

  private startGenerationStages(): void {
    this.stopGenerationStages();
    const stages = [
      'Connecting to the AI question generator...',
      'Building certification-level scenarios...',
      'Checking answers, distractors, and explanations...'
    ];

    let index = 0;
    this.generationMessage.set(stages[index]);

    this.generationStageTimer = setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
      this.generationStep.set(index + 1);
      this.generationMessage.set(stages[index]);

      if (index === stages.length - 1) {
        this.stopGenerationStages();
      }
    }, 1600);
  }

  private stopGenerationStages(): void {
    if (this.generationStageTimer) {
      clearInterval(this.generationStageTimer);
      this.generationStageTimer = null;
    }
  }

  private notify(type: 'success' | 'warning' | 'info', message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastType.set(type);
    this.toastMessage.set(message);
    this.showToast.set(true);

    this.toastTimer = setTimeout(() => {
      this.showToast.set(false);
    }, 5000);
  }

  closeToast(): void {
    this.showToast.set(false);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getAnswerStatus(index: number): string {
    const answer = this.selectedAnswers()[index];
    if (answer === null) return 'unanswered';
    return 'answered';
  }

  isAnswered(index: number): boolean {
    return this.selectedAnswers()[index] !== null;
  }

  toggleAnswersReview(): void {
    this.showAnswersReview.update(val => !val);
  }

  getAnswerStatusClass(index: number): string {
    if (this.selectedAnswers()[index] === null) {
      return 'not-answered';
    }
    return this.selectedAnswers()[index] === this.questions()[index].correctAnswer ? 'correct' : 'incorrect';
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.stopGenerationStages();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    window.removeEventListener('beforeunload', this.onBeforeUnload);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('cut', this.handleCut);
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  private handleContextMenu = (e: Event) => {
    if (this.isStarted()) e.preventDefault();
  };

  private handleCopy = (e: Event) => {
    if (this.isStarted()) e.preventDefault();
  };

  private handlePaste = (e: Event) => {
    if (this.isStarted()) e.preventDefault();
  };

  private handleCut = (e: Event) => {
    if (this.isStarted()) e.preventDefault();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isStarted()) return;

    if (
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'K', 'C'].includes(e.key.toUpperCase()))
    ) {
      e.preventDefault();
    }
  };

  private handleBlur = () => {
    if (!this.isStarted()) return;

    const now = Date.now();
    if (now - this.lastBlurWarningTime > this.blurWarningCooldown) {
      this.lastBlurWarningTime = now;
      this.cheatAttempts.update(val => val + 1);
      if (this.cheatAttempts() >= this.maxCheatAttempts) {
        this.submitQuiz();
      }
    }
  };

  private handleFullscreenChange = () => {
    if (this.isStarted() && !document.fullscreenElement) {
      this.cheatAttempts.update(val => val + 1);
      if (this.cheatAttempts() >= this.maxCheatAttempts) {
        this.submitQuiz();
      }
    }
  };

  private onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this.isStarted()) {
      this.saveExamState();
      event.preventDefault();
      event.returnValue = 'Your exam progress has been saved.';
    }
  };
}
