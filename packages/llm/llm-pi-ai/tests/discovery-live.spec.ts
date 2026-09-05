import { afterEach, describe, expect, it } from 'vitest'
import { discoverModels } from '../src/discovery.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

afterEach(async () => {
  await closeMockServers()
})

const LISTING_BODY = JSON.stringify({
  data: [
    { id: 'live-model-1', name: 'Live One' },
    { id: 'live-model-2' },
  ],
})

describe('discovery prefers the live endpoint', () => {
  it('enumerates an explicit baseURL instead of the catalog snapshot', async () => {
    const server = await mockServer([{ body: LISTING_BODY }])
    const models = await discoverModels({
      provider: 'opencode-go',
      baseURL: server.url,
      api: 'openai-completions',
    })
    expect(models.map(model => model.id)).toContain('live-model-1')
  })

  it('survives a failing explicit endpoint without throwing', async () => {
    const server = await mockServer([{ status: 500, body: '{}' }])
    const models = await discoverModels({
      provider: 'opencode-go',
      baseURL: server.url,
      api: 'openai-completions',
    })
    expect(models.length).toBeGreaterThan(0)
    expect(models.map(model => model.id)).not.toContain('live-model-1')
  })

  it('falls back to the snapshot when the explicit endpoint fails', async () => {
    const server = await mockServer([{ status: 500, body: '{}' }])
    const models = await discoverModels({
      provider: 'openai-codex',
      baseURL: server.url,
      api: 'openai-completions',
    })
    expect(models.length).toBeGreaterThan(0)
    expect(server.paths.length).toBeGreaterThan(0)
  })

  it('keeps a typed api key for an explicitly configured endpoint', async () => {
    const server = await mockServer([{ body: LISTING_BODY }])
    const models = await discoverModels({
      provider: 'opencode-go',
      baseURL: server.url,
      api: 'openai-completions',
      apiKey: 'probe-key',
    })
    expect(models.map(model => model.id)).toContain('live-model-1')
    expect(server.headers[0]?.authorization).toBe('Bearer probe-key')
  })

  it('aborts a catalog live attempt on caller cancellation', async () => {
    await expect(discoverModels(
      { provider: 'openai', signal: AbortSignal.abort('test cancellation') },
    )).rejects.toMatchObject({ code: 'ABORTED' })
  })
})
