import { describe, it, expect } from 'vitest';
import { buildRequestOptions, type BodyData } from '../nodes/OpenApi/lib/buildRequestOptions';
import type { ParsedOperation } from '../nodes/OpenApi/lib/types';

describe('buildRequestOptions', () => {
	const baseUrl = 'https://api.example.com/v1';
	const noBody: BodyData = { contentType: undefined, data: {} };

	it('builds a simple GET request', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: 'List pets',
			description: '',
			parameters: [],
			requestBody: undefined,
		};

		const result = buildRequestOptions(operation, baseUrl, {}, noBody);

		expect(result).toMatchObject({
			method: 'GET',
			url: 'https://api.example.com/v1/pets',
		});
	});

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
			requestBody: undefined,
		};

		const result = buildRequestOptions(operation, baseUrl, { petId: '123' }, noBody);

		expect(result.url).toBe('https://api.example.com/v1/pets/123');
	});

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
				{
					name: 'number',
					in: 'path',
					required: true,
					schema: { type: 'integer' },
					description: '',
				},
			],
			requestBody: undefined,
		};

		const result = buildRequestOptions(
			operation,
			baseUrl,
			{ owner: 'octocat', repo: 'hello', number: 42 },
			noBody,
		);

		expect(result.url).toBe('https://api.example.com/v1/repos/octocat/hello/issues/42');
	});

	it('adds query parameters', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [
				{
					name: 'limit',
					in: 'query',
					required: false,
					schema: { type: 'integer' },
					description: '',
				},
				{
					name: 'status',
					in: 'query',
					required: false,
					schema: { type: 'string' },
					description: '',
				},
			],
			requestBody: undefined,
		};

		const result = buildRequestOptions(
			operation,
			baseUrl,
			{ limit: 10, status: 'available' },
			noBody,
		);

		expect(result.qs).toEqual({ limit: 10, status: 'available' });
	});

	it('omits empty query parameters', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [
				{
					name: 'limit',
					in: 'query',
					required: false,
					schema: { type: 'integer' },
					description: '',
				},
				{
					name: 'status',
					in: 'query',
					required: false,
					schema: { type: 'string' },
					description: '',
				},
			],
			requestBody: undefined,
		};

		const result = buildRequestOptions(operation, baseUrl, { limit: 10, status: '' }, noBody);

		expect(result.qs).toEqual({ limit: 10 });
	});

	it('builds POST request with JSON body', () => {
		const operation: ParsedOperation = {
			operationId: 'createPet',
			method: 'post',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBody: {
				contentType: 'application/json',
				schema: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						age: { type: 'integer' },
					},
				},
				required: true,
			},
		};

		const bodyData: BodyData = {
			contentType: 'application/json',
			data: { name: 'Fluffy', age: 3 },
		};

		const result = buildRequestOptions(operation, baseUrl, {}, bodyData);

		expect(result).toMatchObject({
			method: 'POST',
			url: 'https://api.example.com/v1/pets',
			body: { name: 'Fluffy', age: 3 },
			json: true,
		});
	});

	it('applies API key header authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBody: undefined,
		};

		const credentials = {
			authType: 'apiKey',
			apiKey: 'secret-key',
			apiKeyLocation: 'header',
			apiKeyName: 'X-API-Key',
		};

		const result = buildRequestOptions(operation, baseUrl, {}, noBody, credentials);

		expect(result.headers).toMatchObject({
			'X-API-Key': 'secret-key',
		});
	});

	it('applies API key query authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBody: undefined,
		};

		const credentials = {
			authType: 'apiKey',
			apiKey: 'secret-key',
			apiKeyLocation: 'query',
			apiKeyName: 'api_key',
		};

		const result = buildRequestOptions(operation, baseUrl, {}, noBody, credentials);

		expect(result.qs).toMatchObject({
			api_key: 'secret-key',
		});
	});

	it('applies bearer token authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBody: undefined,
		};

		const credentials = {
			authType: 'bearer',
			bearerToken: 'my-token',
		};

		const result = buildRequestOptions(operation, baseUrl, {}, noBody, credentials);

		expect(result.headers).toMatchObject({
			Authorization: 'Bearer my-token',
		});
	});

	it('applies basic authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBody: undefined,
		};

		const credentials = {
			authType: 'basic',
			username: 'user',
			password: 'pass',
		};

		const result = buildRequestOptions(operation, baseUrl, {}, noBody, credentials);

		const expectedAuth = Buffer.from('user:pass').toString('base64');
		expect(result.headers).toMatchObject({
			Authorization: `Basic ${expectedAuth}`,
		});
	});

	it('handles no authentication', () => {
		const operation: ParsedOperation = {
			operationId: 'listPets',
			method: 'get',
			path: '/pets',
			summary: '',
			description: '',
			parameters: [],
			requestBody: undefined,
		};

		const credentials = {
			authType: 'none',
		};

		const result = buildRequestOptions(operation, baseUrl, {}, noBody, credentials);

		expect(result.headers?.Authorization).toBeUndefined();
	});

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
			requestBody: undefined,
		};

		const result = buildRequestOptions(operation, baseUrl, { name: 'hello world' }, noBody);

		expect(result.url).toBe('https://api.example.com/v1/items/hello%20world');
	});
});
