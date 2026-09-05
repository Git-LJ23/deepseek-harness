import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { closeMockServers } from './mock-server.ts'

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockServers()
})

async function installRoute(route: string, models: { id: string }[]): Promise<Context> {
  vi.stubEnv('PI_TEST_KEY', 'test-key')
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, {
    providers: {
      [route]: { apiKeyEnv: 'PI_TEST_KEY', models },
    },
  })
  return ctx
}

describe('catalog-unknown model resolution', () => {
  it('resolves docs-attested ids from the protocol table', async () => {
    const ctx = await installRoute('opencode-go', [{ id: 'omen-alpha' }])
    const models = await ctx.llm.listModels('opencode-go')
    expect(models.map(model => model.id)).toContain('omen-alpha')
  })

  it('resolves unattested ids from a listable catalog sibling', async () => {
    const ctx = await installRoute('opencode-go', [{ id: 'acme-future-1' }])
    const models = await ctx.llm.listModels('opencode-go')
    expect(models.map(model => model.id)).toContain('acme-future-1')
  })

  it('still refuses a model no catalog describes and no route defines', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    vi.stubEnv('PI_TEST_KEY', 'test-key')
    await expect(ctx.plugin(LlmPiAi, {
      providers: { 'azure-openai-responses': { apiKeyEnv: 'PI_TEST_KEY', models: [{ id: 'nope' }] } },
    })).rejects.toThrow(/needs an api|needs a baseURL/)
  })

  it('still refuses an undescribed model on a catalog-less route', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    vi.stubEnv('PI_TEST_KEY', 'test-key')
    await expect(ctx.plugin(LlmPiAi, {
      providers: { 'acme-gateway': { apiKeyEnv: 'PI_TEST_KEY', models: [{ id: 'nope' }] } },
    })).rejects.toThrow(/needs an api|needs a baseURL/)
  })
})
