import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DatabaseService, Course } from '../../services/database.service';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css'
})
export class WelcomeComponent implements OnInit {
  features: Feature[] = [
    {
      icon: '🤖',
      title: 'Learn UiPath',
      description: 'Master the art of Robotic Process Automation'
    },
    {
      icon: '📚',
      title: 'Comprehensive Courses',
      description: 'From beginner to advanced automation expert'
    },
    {
      icon: '🎯',
      title: 'Hands-on Practice',
      description: 'Real-world scenarios and interactive exercises'
    },
    {
      icon: '🏆',
      title: 'Get Certified',
      description: 'Earn recognized credentials and badges'
    }
  ];

  courses = signal<Course[]>([]);
  isLoadingCourses = signal(true);

  constructor(private databaseService: DatabaseService) {}

  ngOnInit(): void {
    this.loadCourses();
  }

  private loadCourses(): void {
    this.databaseService.getCourses().subscribe(
      (courses) => {
        this.courses.set(courses);
        this.isLoadingCourses.set(false);
      },
      (error) => {
        console.error('Error loading courses:', error);
        this.isLoadingCourses.set(false);
      }
    );
  }
}
