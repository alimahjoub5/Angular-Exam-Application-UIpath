import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';
import { DatabaseService } from './database.service';

export interface User {
  id: number;
  email: string;
  password?: string;
  name: string;
  role: 'student' | 'instructor';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(!!this.getUserFromStorage());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private databaseService: DatabaseService) {}

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.databaseService.getUserByEmail(email).pipe(
      delay(800), // Simulate network delay
      map(user => {
        if (user && user.password === password) {
          // Remove password from returned user
          const { password: _, ...userWithoutPassword } = user;
          const token = this.generateToken(user);
          
          // Store in localStorage
          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
          localStorage.setItem('authToken', token);
          
          this.currentUserSubject.next(userWithoutPassword as User);
          this.isAuthenticatedSubject.next(true);

          return {
            success: true,
            message: 'Login successful!',
            user: userWithoutPassword as User,
            token: token
          };
        }

        return {
          success: false,
          message: 'Invalid email or password'
        };
      })
    );
  }

  /**
   * Register a new user
   */
  register(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.databaseService.getUserByEmail(email).pipe(
      delay(800),
      map(existingUser => {
        if (existingUser) {
          return {
            success: false,
            message: 'Email already exists'
          };
        }

        // Create new user
        const newUser: User = {
          id: Math.floor(Math.random() * 10000),
          email,
          password,
          name,
          role: 'student'
        };

        const { password: _, ...userWithoutPassword } = newUser;
        const token = this.generateToken(newUser);

        localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        localStorage.setItem('authToken', token);

        this.currentUserSubject.next(userWithoutPassword as User);
        this.isAuthenticatedSubject.next(true);

        return {
          success: true,
          message: 'Registration successful!',
          user: userWithoutPassword as User,
          token: token
        };
      })
    );
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Generate fake JWT token
   */
  private generateToken(user: User): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    }));
    const signature = btoa('fake-signature');
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Get user from localStorage
   */
  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }
}
