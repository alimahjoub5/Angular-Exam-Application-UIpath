import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { DatabaseService, Course, Enrollment } from '../../services/database.service';

interface DashboardCourse {
  course: Course;
  enrollment?: Enrollment;
  progress: number;
  lessons: number;
  completed: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  courses = signal<DashboardCourse[]>([]);
  isLoading = signal(true);

  constructor(
    private authService: AuthService,
    private databaseService: DatabaseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserCourses();
  }

  private loadUserCourses(): void {
    // Get all courses and enrollments for the current user
    this.databaseService.getEnrollmentsByUserId(this.currentUser!.id).subscribe(
      (enrollments) => {
        this.databaseService.getCourses().subscribe(
          (allCourses) => {
            const dashboardCourses = enrollments.map(enrollment => {
              const course = allCourses.find(c => c.id === enrollment.courseId);
              return {
                course: course!,
                enrollment: enrollment,
                progress: enrollment.progress,
                lessons: enrollment.totalLessons,
                completed: enrollment.completedLessons
              };
            });
            this.courses.set(dashboardCourses);
            this.isLoading.set(false);
          }
        );
      }
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  continueCourse(courseTitle: string): void {
    console.log('Continue course:', courseTitle);
  }
}
