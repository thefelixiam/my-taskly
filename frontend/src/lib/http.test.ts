import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { request } from './http'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

it('resolves parsed JSON for successful responses', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { items: ['first'] }))
  await expect(request<{ items: string[] }>('/todos')).resolves.toEqual({
    items: ['first'],
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    headers: { 'Content-Type': 'application/json' },
  })
})

it('sends the method, body, and merged headers to the api', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { id: 1 }))
  await expect(
    request('/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Plan the sprint' }),
      headers: { Authorization: 'Bearer token' },
    }),
  ).resolves.toEqual({ id: 1 })
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title: 'Plan the sprint' }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    },
  })
})

it('returns undefined for 204 no-content responses', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
  await expect(
    request('/todos/1', { method: 'DELETE' }),
  ).resolves.toBeUndefined()
})

it('throws the validation message for 422 responses', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(422, { detail: [{ path: ['title'] }] }),
  )
  await expect(
    request('/todos', { method: 'POST', body: '{}' }),
  ).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it('passes through string error details', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(404, { detail: 'Task not found.' }),
  )
  await expect(request('/todos/999')).rejects.toThrow('Task not found.')
})

it('falls back to a generic message when the detail is not a string', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(502, { detail: { fields: ['title'] } }),
  )
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})

it('falls back to a generic message when the error body is not JSON', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('<html>Server Error</html>', { status: 500 }),
  )
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})

it('wraps network failures in a friendly message', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(
    request('/todos', { signal: new AbortController().signal }),
  ).rejects.toThrow('Cannot connect to the server. Please try again.')
})

it('re-throws the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new Error('The user aborted the request.')
  vi.mocked(fetch).mockRejectedValue(abortError)
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abortError,
  )
})
