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
    this.setupAntiCheatProtection();
    this.checkAiConnection();
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
    this.generationMessage.set('Connecting to the AI question generator...');
    this.startGenerationStages();

    let examQuestions: QuizQuestion[];

    try {
      // Economy mode: cap AI generation at 10 questions per exam.
      const aiQuestionCount = Math.min(questionCount, 10);
      const aiQuestions = await this.aiExamService.generateExam(aiQuestionCount, examType);

      if (questionCount > aiQuestionCount) {
        const localQuestions = this.quizService.getShuffledQuestions(questionCount - aiQuestionCount);
        examQuestions = this.shuffleQuestions([...aiQuestions, ...localQuestions]);
        this.questionSource.set('hybrid');
        this.generationStep.set(4);
        this.generationMessage.set(`${aiQuestionCount} AI + ${questionCount - aiQuestionCount} local questions ready.`);
        this.notify('success', `Economy mode ready — ${aiQuestionCount} AI questions + ${questionCount - aiQuestionCount} local questions.`);
      } else {
        examQuestions = aiQuestions;
        this.questionSource.set('ai');
        this.generationStep.set(4);
        this.generationMessage.set(`${examQuestions.length} fresh AI-generated questions are ready.`);
        this.notify('success', `AI questions received — ${examQuestions.length} fresh questions are ready.`);
      }
    } catch (error) {
      console.warn('AI exam generation failed. Falling back to local question bank.', error);
      examQuestions = this.quizService.getShuffledQuestions(questionCount);
      this.questionSource.set('local');
      this.generationStep.set(4);

      const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      this.generationMessage.set(`AI unavailable: ${errorMessage}`);
      this.notify('warning', `AI error: ${errorMessage} — local questions loaded instead.`);
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

  async startTopicTraining(useAi: boolean): Promise<void> {
    if (this.isGenerating()) return;

    const topic = this.selectedTrainingTopic();
    const localPool = this.shuffleQuestions(this.quizService.getQuestionsByTopic(topic));
    let examQuestions: QuizQuestion[] = [];

    this.isTopicTraining.set(true);
    this.selectedExamType.set('small');

    if (useAi) {
      this.isGenerating.set(true);
      this.generationStep.set(1);
      this.generationMessage.set(`Creating a low-token ${topic} drill...`);
      this.startGenerationStages();

      try {
        const aiQuestions = await this.aiExamService.generateExam(2, 'small', topic);
        const localQuestions = localPool.slice(0, 3);
        examQuestions = this.shuffleQuestions([...aiQuestions, ...localQuestions]);
        this.questionSource.set('hybrid');
        this.generationStep.set(4);
        this.generationMessage.set(`Topic drill ready: 2 AI + ${localQuestions.length} local questions.`);
        this.notify('success', `${topic} drill ready — only 2 AI questions used.`);
      } catch (error) {
        examQuestions = localPool.slice(0, 5);
        this.questionSource.set('local');
        const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
        this.generationMessage.set(`AI unavailable: ${errorMessage}`);
        this.notify('warning', `AI unavailable — ${topic} local drill loaded with 0 AI tokens.`);
      } finally {
        this.stopGenerationStages();
        this.isGenerating.set(false);
      }
    } else {
      examQuestions = localPool.slice(0, 5);
      this.questionSource.set('local');
      this.generationMessage.set(`Local-only ${topic} drill: 0 AI tokens used.`);
      this.notify('info', `${topic} local drill ready — 0 AI tokens used.`);
    }

    if (!examQuestions.length) {
      this.notify('warning', `No local questions found for ${topic}.`);
      this.isTopicTraining.set(false);
      return;
    }

    const timeMinutes = 15;
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
    this.startTimer();
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
        return time - 1;
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
  }

  goToQuestion(index: number): void {
    this.currentQuestion.set(index);
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
    }
  }

  previousQuestion(): void {
    const prev = this.currentQuestion() - 1;
    if (prev >= 0) {
      this.currentQuestion.set(prev);
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
    this.quizCompleted.set(true);

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
      '⚠️ Are you sure you want to exit? Your progress will be lost and you can retake the exam later.'
    );

    if (confirmed) {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
      this.isStarted.set(false);
      this.router.navigate(['/']);
    }
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
      event.preventDefault();
      event.returnValue = 'Your exam progress will be lost.';
    }
  };
}
