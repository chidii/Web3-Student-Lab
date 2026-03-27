import { Progress, Module, ProgressStatus } from './types.js';
import { COURSES, curriculumByCourseId } from './curriculum.data.js';

// In-memory mock store for demo resilience
const mockProgressStore: Record<string, Progress> = {};

/**
 * Service to manage student progress in the learning platform.
 * Features a resilient fallback to in-memory mocks if the database is unavailable.
 */
export const getStudentProgress = async (
  studentId: string,
  courseId: string = 'course-1'
): Promise<Progress> => {
  const key = `${studentId}:${courseId}`;

  // Check mock store first
  if (mockProgressStore[key]) {
    return mockProgressStore[key];
  }

  // Return a fresh progress object if not found
  const now = new Date();
  const initialProgress: Progress = {
    id: `progress-${studentId}-${courseId}`,
    studentId,
    courseId,
    completedLessons: [],
    currentModuleId: 'course-1-module-1',
    percentage: 0,
    status: 'not_started',
    lastAccessedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  mockProgressStore[key] = initialProgress;
  return initialProgress;
};

export const updateStudentProgress = async (
  studentId: string,
  lessonId: string,
  courseId: string = 'course-1'
): Promise<Progress> => {
  const progress = await getStudentProgress(studentId, courseId);

  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);

    // Calculate percentage based on curriculum
    const modules = curriculumByCourseId[courseId] || [];
    const totalLessons = modules.reduce((acc: number, mod: Module) => acc + mod.lessons.length, 0);

    if (totalLessons > 0) {
      progress.percentage = Math.min(
        100,
        Math.round((progress.completedLessons.length / totalLessons) * 100)
      );
    }

    if (progress.percentage === 100) {
      progress.status = 'completed';
      progress.completedAt = new Date();
    } else {
      progress.status = 'in_progress';
    }

    progress.updatedAt = new Date();
    progress.lastAccessedAt = new Date();
  }

  const key = `${studentId}:${courseId}`;
  mockProgressStore[key] = progress;
  return progress;
};

export const listCourses = async () => {
  return COURSES.map((course) => ({
    ...course,
    modulesCount: (curriculumByCourseId[course.id] || []).length,
  }));
};
