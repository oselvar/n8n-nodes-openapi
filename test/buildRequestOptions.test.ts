import { describe, it, expect } from 'vitest'
import { buildRequestOptions } from '../nodes/OpenApi/lib/buildRequestOptions'
import type { ParsedOperation } from '../nodes/OpenApi/lib/types'

describe('buildRequestOptions', () => {
	const baseUrl = 'https://api.example.com/v1'

	it('builds a simple GET request', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: 'List pets',
			description: '',
			parameters: [],
			requestBodySchema: undefined,
		}

		const result = buildRequestOptions(operation, baseUrl, {}, {})

		expect(result).toMatchObject({
			method: 'GET',
			url: 'https://api.example.com/v1/pets',
		})
	})

	it('replaces path parameters', () => {
		const operation: ParsedOperation = {
			operationId: 'getPet',
			method: 'get',
			path: '/pets/{petId}',
			summary: 'Get pet',
			description: '',
			parameters: [
				{
					name: 'petId',
					in: 'path',
					required: true,
					schema: { type: 'string' },
					description: '',
				},
			],
			requestBodySchema: undefined,
		}

		const result = buildRequestOptions(operation, baseUrl, { petId: '123' }, {})

		expect(result.url).toBe('https://api.example.com/v1/pets/123')
	})

	it('replaces multiple path parameters', () => {
		const operation: ParsedOperation = {
			operationId: 'getRepoIssue',
			method: 'get',
			path: '/repos/{owner}/{repo}/issues/{number}',
			summary: '',
			description: '',
			parameters: [
				{ name: 'owner', in: 'path', required: true, schema: { type: 'string' }, description: '' },
				{ name: 'repo', in: 'path', required: true, schema: { type: 'string' }, description: '' },
				{ name: 'number', in: 'path', required: true, schema: { type: 'integer' }, description: '' },
			],
			requestBodySchema: undefined,
		}

		const result = buildRequestOptions(operation, baseUrl, { owner: 'octocat', repo: 'hello', number: 42 }, {})

		expect(result.url).toBe('https://api.example.com/v1/repos/octocat/hello/issues/42')
	})

	it('adds query parameters', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [
				{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' }, description: '' },
				{ name: 'status', in: 'query', required: false, schema: { type: 'string' }, description: '' },
			],
			requestBodySchema: undefined,
		}

		const result = buildRequestOptions(operation, baseUrl, { limit: 10, status: 'available' }, {})

		expect(result.qs).toEqual({ limit: 10, status: 'available' })
	})

	it('omits empty query parameters', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [
				{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' }, description: '' },
				{ name: 'status', in: 'query', required: false, schema: { type: 'string' }, description: '' },
			],
			requestBodySchema: undefined,
		}

		const result = buildRequestOptions(operation, baseUrl, { limit: 10, status: '' }, {})

		expect(result.qs).toEqual({ limit: 10 })
	})

	it('builds POST request with body', () => {
		const operation: ParsedOperation = {
			operationId: 'createPet',
			method: 'post',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBodySchema: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					age: { type: 'integer' },
				},
			},
		}

		const result = buildRequestOptions(operation, baseUrl, {}, { name: 'Fluffy', age: 3 })

		expect(result).toMatchObject({
			method: 'POST',
			url: 'https://api.example.com/v1/pets',
			body: { name: 'Fluffy', age: 3 },
			json: true,
		})
	})

	it('applies API key header authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBodySchema: undefined,
		}

		const credentials = {
			authType: 'apiKey',
			apiKey: 'secret-key',
			apiKeyLocation: 'header',
			apiKeyName: 'X-API-Key',
		}

		const result = buildRequestOptions(operation, baseUrl, {}, {}, credentials)

		expect(result.headers).toMatchObject({
			'X-API-Key': 'secret-key',
		})
	})

	it('applies API key query authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBodySchema: undefined,
		}

		const credentials = {
			authType: 'apiKey',
			apiKey: 'secret-key',
			apiKeyLocation: 'query',
			apiKeyName: 'api_key',
		}

		const result = buildRequestOptions(operation, baseUrl, {}, {}, credentials)

		expect(result.qs).toMatchObject({
			api_key: 'secret-key',
		})
	})

	it('applies bearer token authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBodySchema: undefined,
		}

		const credentials = {
			authType: 'bearer',
			bearerToken: 'my-token',
		}

		const result = buildRequestOptions(operation, baseUrl, {}, {}, credentials)

		expect(result.headers).toMatchObject({
			Authorization: 'Bearer my-token',
		})
	})

	it('applies basic authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBodySchema: undefined,
		}

		const credentials = {
			authType: 'basic',
			username: 'user',
			password: 'pass',
		}

		const result = buildRequestOptions(operation, baseUrl, {}, {}, credentials)

		const expectedAuth = Buffer.from('user:pass').toString('base64')
		expect(result.headers).toMatchObject({
			Authorization: `Basic ${expectedAuth}`,
		})
	})

	it('handles no authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBodySchema: undefined,
		}

		const credentials = {
			authType: 'none',
		}

		const result = buildRequestOptions(operation, baseUrl, {}, {}, credentials)

		expect(result.headers?.Authorization).toBeUndefined()
	})

	it('URL-encodes path parameter values', () => {
		const operation: ParsedOperation = {
			operationId: 'getItem',
			method: 'get',
			path: '/items/{name}',
			summary: '',
			description: '',
			parameters: [
				{ name: 'name', in: 'path', required: true, schema: { type: 'string' }, description: '' },
			],
			requestBodySchema: undefined,
		}

		const result = buildRequestOptions(operation, baseUrl, { name: 'hello world' }, {})

		expect(result.url).toBe('https://api.example.com/v1/items/hello%20world')
	})
})
