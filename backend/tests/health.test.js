<<<<<<< HEAD
'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const supertest_1 = __importDefault(require('supertest'));
const index_1 = require('../src/index');
describe('Health Endpoint Integration Tests', () => {
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await (0, supertest_1.default)(index_1.app).get(
        '/health'
      );
=======
import request from 'supertest';
import { app } from '../src/index';
describe('Health Endpoint Integration Tests', () => {
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/health');
>>>>>>> main
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
    it('should return Web3 Student Lab Backend message', async () => {
<<<<<<< HEAD
      const response = await (0, supertest_1.default)(index_1.app).get(
        '/health'
      );
=======
      const response = await request(app).get('/health');
>>>>>>> main
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Web3 Student Lab Backend is running');
    });
    it('should return JSON content type', async () => {
<<<<<<< HEAD
      const response = await (0, supertest_1.default)(index_1.app).get(
        '/health'
      );
=======
      const response = await request(app).get('/health');
>>>>>>> main
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
  describe('404 Handling', () => {
    it('should return 404 for non-existent routes', async () => {
<<<<<<< HEAD
      const response = await (0, supertest_1.default)(index_1.app).get(
        '/non-existent-route'
      );
=======
      const response = await request(app).get('/non-existent-route');
>>>>>>> main
      expect(response.status).toBe(404);
    });
  });
});
//# sourceMappingURL=health.test.js.map
