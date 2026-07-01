import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'student' | 'instructor';
  avatar?: string;
  joinDate?: string;
  bio?: string;
  expertise?: string[];
}

export interface Course {
  id: number;
  title: string;
  level: string;
  description: string;
  duration: string;
  lessons: number;
  instructor: number;
  image: string;
  color: string;
  rating: number;
  students: number;
  skills: string[];
  price: number;
  isFree: boolean;
}

export interface Lesson {
  id: number;
  courseId: number;
  title: string;
  description: string;
  duration: number;
  videoUrl: string;
  content: string;
  completed: boolean;
  order: number;
}

export interface Enrollment {
  id: number;
  userId: number;
  courseId: number;
  enrollDate: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  status: 'not-started' | 'in-progress' | 'completed';
}

export interface Quiz {
  id: number;
  lessonId: number;
  title: string;
  questions: any[];
  passingScore: number;
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  userId?: number;
  unlockedDate?: string;
}

export interface Database {
  users: User[];
  courses: Course[];
  lessons: Lesson[];
  enrollments: Enrollment[];
  quizzes: Quiz[];
  achievements: Achievement[];
  resources: any[];
  comments: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private database$ = new BehaviorSubject<Database | null>(null);

  constructor(private http: HttpClient) {
    this.loadDatabase();
  }

  private loadDatabase(): void {
    this.http.get<Database>('/assets/database.json').subscribe(
      (data) => {
        this.database$.next(data);
      },
      (error) => {
        console.error('Error loading database:', error);
      }
    );
  }

  // Users
  getUsers(): Observable<User[]> {
    return this.database$.pipe(
      map(db => db?.users || [])
    );
  }

  getUserById(id: number): Observable<User | undefined> {
    return this.database$.pipe(
      map(db => db?.users.find(u => u.id === id))
    );
  }

  getUserByEmail(email: string): Observable<User | undefined> {
    return this.database$.pipe(
      map(db => db?.users.find(u => u.email === email))
    );
  }

  // Courses
  getCourses(): Observable<Course[]> {
    return this.database$.pipe(
      map(db => db?.courses || [])
    );
  }

  getCourseById(id: number): Observable<Course | undefined> {
    return this.database$.pipe(
      map(db => db?.courses.find(c => c.id === id))
    );
  }

  getCoursesByLevel(level: string): Observable<Course[]> {
    return this.database$.pipe(
      map(db => db?.courses.filter(c => c.level === level) || [])
    );
  }

  // Lessons
  getLessons(): Observable<Lesson[]> {
    return this.database$.pipe(
      map(db => db?.lessons || [])
    );
  }

  getLessonsByCourseId(courseId: number): Observable<Lesson[]> {
    return this.database$.pipe(
      map(db => db?.lessons.filter(l => l.courseId === courseId) || [])
    );
  }

  getLessonById(id: number): Observable<Lesson | undefined> {
    return this.database$.pipe(
      map(db => db?.lessons.find(l => l.id === id))
    );
  }

  // Enrollments
  getEnrollments(): Observable<Enrollment[]> {
    return this.database$.pipe(
      map(db => db?.enrollments || [])
    );
  }

  getEnrollmentsByUserId(userId: number): Observable<Enrollment[]> {
    return this.database$.pipe(
      map(db => db?.enrollments.filter(e => e.userId === userId) || [])
    );
  }

  getEnrollmentByUserAndCourse(userId: number, courseId: number): Observable<Enrollment | undefined> {
    return this.database$.pipe(
      map(db => db?.enrollments.find(e => e.userId === userId && e.courseId === courseId))
    );
  }

  // Quizzes
  getQuizzes(): Observable<Quiz[]> {
    return this.database$.pipe(
      map(db => db?.quizzes || [])
    );
  }

  getQuizByLessonId(lessonId: number): Observable<Quiz | undefined> {
    return this.database$.pipe(
      map(db => db?.quizzes.find(q => q.lessonId === lessonId))
    );
  }

  // Achievements
  getAchievements(): Observable<Achievement[]> {
    return this.database$.pipe(
      map(db => db?.achievements || [])
    );
  }

  getAchievementsByUserId(userId: number): Observable<Achievement[]> {
    return this.database$.pipe(
      map(db => db?.achievements.filter(a => a.userId === userId) || [])
    );
  }

  // Resources
  getResources(): Observable<any[]> {
    return this.database$.pipe(
      map(db => db?.resources || [])
    );
  }

  getResourcesByCourseId(courseId: number): Observable<any[]> {
    return this.database$.pipe(
      map(db => db?.resources.filter(r => r.courseId === courseId) || [])
    );
  }

  // Comments
  getComments(): Observable<any[]> {
    return this.database$.pipe(
      map(db => db?.comments || [])
    );
  }

  getCommentsByLessonId(lessonId: number): Observable<any[]> {
    return this.database$.pipe(
      map(db => db?.comments.filter(c => c.lessonId === lessonId) || [])
    );
  }

  // Get database snapshot
  getDatabase(): Observable<Database | null> {
    return this.database$.asObservable();
  }
}
