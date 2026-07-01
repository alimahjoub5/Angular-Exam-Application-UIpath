import { Injectable } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ExamComponent } from '../pages/exam/exam';

@Injectable({
  providedIn: 'root'
})
export class ExamGuard {
  canDeactivate(component: ExamComponent): boolean {
    // Allow navigation if exam hasn't started
    if (!component.isStarted() && !component.examSelected()) {
      return true;
    }

    // If exam is in progress, ask for confirmation
    if (component.isStarted()) {
      return confirm(
        '⚠️ Are you sure you want to leave? Your exam progress will be lost.'
      );
    }

    // If on exam selection screen, allow navigation
    return true;
  }
}

export const examGuard: CanDeactivateFn<ExamComponent> = (component) => {
  const guard = new ExamGuard();
  return guard.canDeactivate(component);
};
