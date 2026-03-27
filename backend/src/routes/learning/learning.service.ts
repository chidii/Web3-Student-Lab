import { Progress } from './types.js';
import { getProgress, recordStageCompletion } from '../../learning/progress.js';

/**
 * Service to manage student progress in the learning platform.
 * Delegates to the progress persistence module for database-backed storage.
 */
export const getStudentProgress = async (studentId: string): Promise<Progress> => {
  const progress = await getProgress(studentId);
  return {
    userId: progress.userId,
    completedLessons: progress.completedLessons,
    currentModule: progress.currentModule,
    percentage: progress.percentage,
  };
};

export const updateProgress = async (
  studentId: string,
  lessonId: string,
  moduleId: string = 'mod-1',
  totalLessons: number = 4
): Promise<Progress> => {
  const progress = await recordStageCompletion(
    { studentId, stageId: lessonId, moduleId },
    totalLessons
  );
  return {
    userId: progress.userId,
    completedLessons: progress.completedLessons,
    currentModule: progress.currentModule,
    percentage: progress.percentage,
  };
};
