import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeRadarAttempt: vi.fn(),
  getRadarFeedPolicy: vi.fn(),
  getRadarFeedReadiness: vi.fn(),
  getRadarItems: vi.fn(),
  getSession: vi.fn(),
  hydrateRateLimitStore: vi.fn(),
}));

vi.mock('./cookies.js', () => ({ getSession: mocks.getSession }));
vi.mock('./auth.js', () => ({
  consumeRadarAttempt: mocks.consumeRadarAttempt,
  hydrateRateLimitStore: mocks.hydrateRateLimitStore,
}));
vi.mock('./radar.js', () => ({
  getRadarItems: mocks.getRadarItems,
  getRadarFeedPolicy: mocks.getRadarFeedPolicy,
  getRadarFeedReadiness: mocks.getRadarFeedReadiness,
  RADAR_SECTIONS: ['research', 'government', 'international'],
  RADAR_SOURCE_POLICY: [],
  RADAR_WEB_POLICY: [],
}));

const { default: handler } = await import('../../api/radar/items.js');

function responseDouble() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(() => response),
    json: vi.fn((body) => body),
  };
  return response;
}

describe('GET /api/radar/items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue({ role: 'admin' });
    mocks.consumeRadarAttempt.mockResolvedValue(false);
    mocks.getRadarFeedPolicy.mockReturnValue([]);
    mocks.getRadarFeedReadiness.mockReturnValue({});
    mocks.getRadarItems.mockResolvedValue({
      items: [],
      liveProvider: false,
      snapshotLive: true,
      fetchedAt: '2026-07-31T12:52:01.565Z',
    });
  });

  it('nao permite que o navegador reutilize um snapshot antigo', async () => {
    const response = responseDouble();

    await handler({ method: 'GET', url: '/api/radar/items?section=government' }, response);

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
