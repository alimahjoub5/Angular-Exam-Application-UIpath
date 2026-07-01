import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing';
import { ExamComponent } from './pages/exam/exam';
import { examGuard } from './guards/exam.guard';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent
  },
  {
    path: 'exam',
    component: ExamComponent,
    canDeactivate: [examGuard]
  }
];
