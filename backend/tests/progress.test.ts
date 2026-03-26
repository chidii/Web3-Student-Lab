import request from 'supertest';
import { app } from '../src/index';
import prisma from '../src/db/index';

describe('Course Progress Persistence', () => {
  // Clean up learning_progress table before each test
  beforeEach(async () => {
    await prisma.learningProgress.deleteMany();
  });

  afterAll(async () => {
    await prisma.learningProgress.deleteMany();
    await prisma.$disconnect();
  });

  describe('GET /api/learning/progress/:userId', () => {
    it('should return default progress for a new student', async () => {
      const response = await request(app).get('/api/learning/progress/student-new').expect(200);

      expect(response.body.progress).toMatchObject({
        userId: 'student-new',
        completedLessons: [],
        currentModule: 'mod-1',
        percentage: 0,
      });
    });

    it('should return persisted progress for an existing student', async () => {
      // Seed progress in DB
      await prisma.learningProgress.create({
        data: {
          userId: 'student-existing',
          completedLessons: ['lesson-1', 'lesson-2'],
          currentModule: 'mod-1',
          percentage: 50,
        },
      });

      const response = await request(app).get('/api/learning/progress/student-existing').expect(200);

      expect(response.body.progress.userId).toBe('student-existing');
      expect(response.body.progress.completedLessons).toEqual(['lesson-1', 'lesson-2']);
      expect(response.body.progress.percentage).toBe(50);
    });
  });

  describe('POST /api/learning/progress/:userId/complete', () => {
    it('should persist a completed lesson to the database', async () => {
      const userId = 'student-persist';

      const response = await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-1' })
        .expect(200);

      expect(response.body.progress.completedLessons).toContain('lesson-1');
      expect(response.body.message).toBe('Lesson marked as complete');

      // Verify it was actually persisted in the DB
      const dbRecord = await prisma.learningProgress.findUnique({
        where: { userId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.completedLessons).toContain('lesson-1');
    });

    it('should accumulate multiple completed lessons', async () => {
      const userId = 'student-multi';

      await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-1' })
        .expect(200);

      const response = await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-2' })
        .expect(200);

      expect(response.body.progress.completedLessons).toEqual(
        expect.arrayContaining(['lesson-1', 'lesson-2']),
      );
      expect(response.body.progress.percentage).toBe(50); // 2 of 4 lessons
    });

    it('should be idempotent — completing the same lesson twice does not duplicate', async () => {
      const userId = 'student-idempotent';

      await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-1' })
        .expect(200);

      const response = await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-1' })
        .expect(200);

      const count = response.body.progress.completedLessons.filter(
        (id: string) => id === 'lesson-1',
      ).length;
      expect(count).toBe(1);
    });

    it('should update percentage correctly as lessons are completed', async () => {
      const userId = 'student-percentage';

      // Complete all 4 lessons (2 modules × 2 lessons each)
      for (const lessonId of ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4']) {
        await request(app)
          .post(`/api/learning/progress/${userId}/complete`)
          .send({ lessonId })
          .expect(200);
      }

      const response = await request(app).get(`/api/learning/progress/${userId}`).expect(200);

      expect(response.body.progress.percentage).toBe(100);
      expect(response.body.progress.completedLessons).toHaveLength(4);
    });

    it('should track the current module based on the last completed lesson', async () => {
      const userId = 'student-module-track';

      // Complete a lesson from mod-2
      await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-3' })
        .expect(200);

      const response = await request(app).get(`/api/learning/progress/${userId}`).expect(200);

      expect(response.body.progress.currentModule).toBe('mod-2');
    });

    it('should return 400 when lessonId is missing', async () => {
      const response = await request(app)
        .post('/api/learning/progress/student-bad/complete')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Lesson ID is required');
    });

    it('should return 404 for a non-existent lesson', async () => {
      const response = await request(app)
        .post('/api/learning/progress/student-bad/complete')
        .send({ lessonId: 'lesson-999' })
        .expect(404);

      expect(response.body.error).toBe('Lesson not found');
    });
  });

  describe('Progress data flexibility', () => {
    it('should store progress with the flexible schema (completedLessons as string array)', async () => {
      const userId = 'student-flexible';

      await request(app)
        .post(`/api/learning/progress/${userId}/complete`)
        .send({ lessonId: 'lesson-1' })
        .expect(200);

      // Verify the raw DB record uses the flexible string[] format
      const dbRecord = await prisma.learningProgress.findUnique({
        where: { userId },
      });

      expect(dbRecord).not.toBeNull();
      expect(Array.isArray(dbRecord!.completedLessons)).toBe(true);
      expect(typeof dbRecord!.currentModule).toBe('string');
      expect(typeof dbRecord!.percentage).toBe('number');
    });
  });
});
