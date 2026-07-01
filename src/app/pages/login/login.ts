import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  isLoading = signal(false);
  errorMessage = signal('');
  isSignUp = signal(false);
  signUpName = signal('');
  showPassword = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(): void {
    this.errorMessage.set('');

    if (!this.email() || !this.password()) {
      this.errorMessage.set('Please enter both email and password');
      return;
    }

    this.isLoading.set(true);
    this.authService.login(this.email(), this.password()).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(response.message);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('An error occurred. Please try again.');
      }
    });
  }

  onSignUp(): void {
    this.errorMessage.set('');

    if (!this.email() || !this.password() || !this.signUpName()) {
      this.errorMessage.set('Please fill in all fields');
      return;
    }

    if (this.password().length < 6) {
      this.errorMessage.set('Password must be at least 6 characters');
      return;
    }

    this.isLoading.set(true);
    this.authService.register(this.email(), this.password(), this.signUpName()).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(response.message);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('An error occurred. Please try again.');
      }
    });
  }

  toggleSignUp(): void {
    this.isSignUp.update(v => !v);
    this.errorMessage.set('');
    this.email.set('');
    this.password.set('');
    this.signUpName.set('');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  fillDemoCredentials(type: 'student' | 'instructor'): void {
    if (type === 'student') {
      this.email.set('student@uipath.com');
      this.password.set('password123');
    } else {
      this.email.set('instructor@uipath.com');
      this.password.set('password123');
    }
  }
}
