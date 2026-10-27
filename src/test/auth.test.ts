import type { Request, Response } from 'express';

// Mock config so the middleware sees a configured ingest key (and the logger it
// imports gets a valid nodeEnv). No env mutation, no DB — a pure unit test.
jest.mock('../config', () => ({
  config: { nodeEnv: 'test', logLevel: undefined, ingestApiKey: 'test-ingest-key' },
}));

import { requireApiKey } from '../middleware/auth';

const API_KEY = 'test-ingest-key';

function makeReqRes(providedKey?: string) {
  const req = {
    path: '/api/telemetry',
    header: (name: string) => (name.toLowerCase() === 'x-api-key' ? providedKey : undefined),
  } as unknown as Request;

  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  return { req, res, status, json };
}

describe('requireApiKey middleware', () => {
  it('calls next() when the correct key is provided', () => {
    const { req, res, status } = makeReqRes(API_KEY);
    const next = jest.fn();
    requireApiKey(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('responds 401 when no key is provided', () => {
    const { req, res, status } = makeReqRes(undefined);
    const next = jest.fn();
    requireApiKey(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('responds 401 when the key is wrong', () => {
    const { req, res, status } = makeReqRes('wrong-key');
    const next = jest.fn();
    requireApiKey(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});
