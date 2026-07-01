import { Component, OnInit, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { QuizService, QuizAttempt, QuizQuestion } from '../../services/quiz.service';

@Component({
  selector: 'app-exam',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exam.html',
  styleUrl: './exam.css'
})
export class ExamComponent implements OnInit, OnDestroy {
  currentUser = signal(null as any);
  
  // Exam selection state
  examSelected = signal(false);
  selectedExamType = signal<'small' | 'real' | null>(null);
  
  // Quiz state
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

  // Timer interval
  private timerInterval: any;
  examDuration = { small: 30, real: 90 }; // in minutes
  
  // Anti-cheat tracking
  cheatAttempts = signal(0);
  private maxCheatAttempts = 3;
  private lastBlurWarningTime = 0;
  private blurWarningCooldown = 5000; // 5 seconds between warnings

  // Helper method for character code conversion
  readonly String = String;

  constructor(
    private quizService: QuizService,
    private authService: AuthService,
    private router: Router
  ) {
    // Auto-save selected answer when changed
    effect(() => {
      const answers = this.selectedAnswers();
      if (answers.length > 0) {
        // Could be saved to a backup service
      }
    });
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);
    if (!user) {
      this.router.navigate(['/login']);
    }
    // Prevent page reload while exam is in progress
    window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
    
    // Anti-cheating measures
    this.setupAntiCheatProtection();
  }

  private setupAntiCheatProtection(): void {
    // Disable right-click context menu
    document.addEventListener('contextmenu', (e) => {
      if (this.isStarted()) {
        e.preventDefault();
      }
    });

    // Disable copy/paste
    document.addEventListener('copy', (e) => {
      if (this.isStarted()) {
        e.preventDefault();
      }
    });

    document.addEventListener('paste', (e) => {
      if (this.isStarted()) {
        e.preventDefault();
      }
    });

    // Disable cut
    document.addEventListener('cut', (e) => {
      if (this.isStarted()) {
        e.preventDefault();
      }
    });

    // Detect developer tools opening
    document.addEventListener('keydown', (e) => {
      if (this.isStarted()) {
        // F12 - Developer tools
        if (e.key === 'F12' || e.keyCode === 123) {
          e.preventDefault();
        }
        // Ctrl+Shift+I - Inspector
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
          e.preventDefault();
        }
        // Ctrl+Shift+J - Console
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
          e.preventDefault();
        }
        // Ctrl+Shift+K - Console (alternate)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
          e.preventDefault();
        }
        // Ctrl+Shift+C - Element inspector
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
          e.preventDefault();
        }
      }
    });

    // Detect tab/window blur (switching away from exam)
    window.addEventListener('blur', () => {
      if (this.isStarted()) {
        const now = Date.now();
        // Only count violations every 5 seconds to avoid spam
        if (now - this.lastBlurWarningTime > this.blurWarningCooldown) {
          this.lastBlurWarningTime = now;
          this.cheatAttempts.update(val => val + 1);
          
          // Silent disqualification after 3 violations
          if (this.cheatAttempts() >= this.maxCheatAttempts) {
            this.submitQuiz();
          }
        }
      }
    });

    // Detect fullscreen exit
    document.addEventListener('fullscreenchange', () => {
      if (this.isStarted() && !document.fullscreenElement) {
        this.cheatAttempts.update(val => val + 1);
        
        if (this.cheatAttempts() >= this.maxCheatAttempts) {
          this.submitQuiz();
        }
      }
    });

    // Disable printing
    window.addEventListener('beforeprint', (e) => {
      if (this.isStarted()) {
        e.preventDefault();
      }
    });
  }

  startQuiz(): void {
    const examType = this.selectedExamType();
    if (!examType) return;

    const questionCount = examType === 'small' ? 10 : 60;
    const timeMinutes = examType === 'small' ? 30 : 90;

    const attempt = this.quizService.startQuizAttempt(questionCount, timeMinutes);
    this.questions.set(attempt.questions);
    this.selectedAnswers.set(new Array(attempt.questions.length).fill(null));
    this.lockedAnswers.set(new Array(attempt.questions.length).fill(false));
    this.currentQuestion.set(0);
    this.totalTime.set(timeMinutes * 60);
    this.timeRemaining.set(timeMinutes * 60);
    this.isStarted.set(true);
    
    // Request fullscreen for anti-cheating
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
    // Can't change answer if it's locked (Real Exam)
    if (this.selectedExamType() === 'real' && this.lockedAnswers()[this.currentQuestion()]) {
      return;
    }
    const answers = this.selectedAnswers();
    answers[this.currentQuestion()] = optionIndex;
    this.selectedAnswers.set([...answers]);
  }

  goToQuestion(index: number): void {
    this.currentQuestion.set(index);
  }

  nextQuestion(): void {
    const next = this.currentQuestion() + 1;
    if (next < this.questions().length) {
      // Lock current answer when moving to next (Real Exam only)
      if (this.selectedExamType() === 'real') {
        const locked = this.lockedAnswers();
        locked[this.currentQuestion()] = true;
        this.lockedAnswers.set([...locked]);
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
    // Unlock current answer so user can edit
    if (this.selectedExamType() === 'real') {
      const locked = this.lockedAnswers();
      locked[this.currentQuestion()] = false;
      this.lockedAnswers.set([...locked]);
    }
  }

  isAnswerLocked(): boolean {
    if (this.selectedExamType() !== 'real') return false;
    return this.lockedAnswers()[this.currentQuestion()] || false;
  }

  submitQuiz(): void {
    // Lock all remaining answers
    if (this.selectedExamType() === 'real') {
      const locked = this.lockedAnswers();
      for (let i = 0; i < locked.length; i++) {
        locked[i] = true;
      }
      this.lockedAnswers.set([...locked]);
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    const totalSeconds = this.selectedExamType() === 'small' ? 30 * 60 : 90 * 60;
    const timeSpent = totalSeconds - this.timeRemaining();
    const answers = this.selectedAnswers();

    // Submit answers
    answers.forEach((answer, index) => {
      if (answer !== null) {
        this.quizService.submitAnswer(index, answer);
      }
    });

    // Get results
    this.result = this.quizService.completeQuiz(timeSpent);
    this.quizCompleted.set(true);
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
  }

  selectExamType(type: 'small' | 'real'): void {
    this.selectedExamType.set(type);
    this.examSelected.set(true);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  exitExam(): void {
    if (this.isStarted()) {
      const confirmed = confirm(
        '⚠️ Are you sure you want to exit? Your progress will be lost and you can retake the exam later.'
      );
      if (confirmed) {
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
        }
        this.router.navigate(['/dashboard']);
      }
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
    if (answer === this.questions()[index].correctAnswer) return 'correct';
    return 'incorrect';
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
    // Remove beforeunload listener
    window.removeEventListener('beforeunload', this.onBeforeUnload.bind(this));
    
    // Clean up anti-cheat event listeners when exam is done
    document.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('cut', this.handleCut);
  }

  private handleContextMenu = (e: Event) => {
    if (this.isStarted()) {
      (e as MouseEvent).preventDefault();
    }
  };

  private handleCopy = (e: Event) => {
    if (this.isStarted()) {
      (e as ClipboardEvent).preventDefault();
    }
  };

  private handlePaste = (e: Event) => {
    if (this.isStarted()) {
      (e as ClipboardEvent).preventDefault();
    }
  };

  private handleCut = (e: Event) => {
    if (this.isStarted()) {
      (e as ClipboardEvent).preventDefault();
    }
  };

  private onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isStarted()) {
      event.preventDefault();
      event.returnValue = '⚠️ Are you sure you want to leave? Your exam progress will be lost.';
    }
  }
}
