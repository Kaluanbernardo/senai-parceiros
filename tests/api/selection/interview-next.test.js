import { afterEach, describe, expect, it } from 'vitest';
import handler from '../../../api/selection/interview-next.js';
import { createSessionToken } from '../../../server/lib/cookies.js';
import { InterviewPlanner } from '../../../src/domain/interviewPlanner.js';

process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request(state, answer = 'Escola para benchmarking de formação dual') {
  const token = createSessionToken({ username: 'user', role: 'user' });
  return {
    method: 'POST',
    headers: { cookie: `senai_session=${encodeURIComponent(token)}` },
    socket: { remoteAddress: 'interview-test' },
    body: { state, questionId: state.currentQuestion.id, answer },
  };
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

describe('POST /api/selection/interview/next', () => {
  it('returns a transient local fallback when no AI provider is configured', async () => {
    const state = InterviewPlanner.start({ category: 'school', objective: 'benchmark' });
    const res = response();
    await handler(request(state), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.trace.provider).toBe('local-fallback');
    expect(res.body.state.currentQuestion).toBeTruthy();
    expect(res.body.state).not.toHaveProperty('storageKey');
  });

  it('rejects a question mismatch without calling the planner', async () => {
    const state = InterviewPlanner.start({ category: 'researcher', objective: 'speaker' });
    const res = response();
    const req = request(state);
    req.body.questionId = 'different-question';
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_interview_payload');
  });
});
