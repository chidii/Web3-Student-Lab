import { Router, Request, Response } from 'express';
import { getStudentProgress, updateStudentProgress } from './learning.service.js';
import { curriculumByCourseId } from './curriculum.data.js';

const router = Router();

// Use Course 1 as the default for the modules list
const modules = curriculumByCourseId['course-1'] || [];

/**
 * @route   GET /api/learning/modules
 * @desc    Get all learning modules
 * @access  Public
 */
router.get('/modules', (req: Request, res: Response) => {
  try {
    const difficulty = req.query.difficulty as string | undefined;

    let filteredModules = modules;

    if (difficulty) {
      filteredModules = modules.map((mod) => ({
        ...mod,
        lessons: mod.lessons.filter((lesson) => lesson.difficulty === difficulty),
      }));
    }

    res.json({ modules: filteredModules });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning/modules/:moduleId
 * @desc    Get a specific module by ID
 * @access  Public
 */
router.get('/modules/:moduleId', (req: Request, res: Response) => {
  try {
    const moduleId = req.params.moduleId as string;
    const module = modules.find((m) => m.id === moduleId);

    if (!module) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    res.json({ module });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/learning/progress/:userId
 * @desc    Get user learning progress
 * @access  Public
 */
router.get('/progress/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const progress = await getStudentProgress(userId);
    res.json({ progress });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/learning/progress/:userId/complete
 * @desc    Mark a lesson as complete
 * @access  Public
 */
router.post('/progress/:userId/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { lessonId } = req.body;

    if (!lessonId) {
      res.status(400).json({ error: 'Lesson ID is required' });
      return;
    }

    // Verify lesson exists in any module
    const lessonExists = modules.some((mod) => mod.lessons.some((l) => l.id === lessonId));

    if (!lessonExists) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const progress = await updateStudentProgress(userId, lessonId);

    res.json({ progress, message: 'Lesson marked as complete' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
