import { Buffer } from 'node:buffer'
import type { IDataObject, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow'
import type { ParsedOperation } from './types'

type Credentials = {
	readonly authType?: string
	readonly apiKey?: string
	readonly apiKeyLocation?: string
	readonly apiKeyName?: string
	readonly bearerToken?: string
	readonly username?: string
	readonly password?: string
}

export function buildRequestOptions(
	operation: ParsedOperation,
	baseUrl: string,
	params: Record<string, unknown>,
	bodyParams: Record<string, unknown>,
	credentials?: Credentials,
): IHttpRequestOptions {
	const url = buildUrl(baseUrl, operation.path, params, operation.parameters)
	const qs = buildQueryString(operation.parameters, params, credentials)
	const headers = buildHeaders(credentials)

	const options: IHttpRequestOptions = {
		method: operation.method.toUpperCase() as IHttpRequestMethods,
		url,
		headers,
	}

	if (Object.keys(qs).length > 0) {
		options.qs = qs
	}

	if (operation.requestBodySchema && Object.keys(bodyParams).length > 0) {
		options.body = bodyParams
		options.json = true
	}

	return options
}

function buildUrl(
	baseUrl: string,
	path: string,
	params: Record<string, unknown>,
	parameters: readonly ParsedOperation['parameters'][number][],
): string {
	let url = `${baseUrl}${path}`

	for (const param of parameters) {
		if (param.in === 'path') {
			const value = params[param.name]
			if (value !== undefined) {
				url = url.replace(`{${param.name}}`, encodeURIComponent(String(value)))
			}
		}
	}

	return url
}

function buildQueryString(
	parameters: readonly ParsedOperation['parameters'][number][],
	params: Record<string, unknown>,
	credentials?: Credentials,
): IDataObject {
	const qs: IDataObject = {}

	for (const param of parameters) {
		if (param.in === 'query') {
			const value = params[param.name]
			if (value !== undefined && value !== '') {
				qs[param.name] = value
			}
		}
	}

	if (credentials?.authType === 'apiKey' && credentials.apiKeyLocation === 'query') {
		qs[credentials.apiKeyName ?? 'api_key'] = credentials.apiKey
	}

	return qs
}

function buildHeaders(credentials?: Credentials): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
	}

	if (!credentials) return headers

	switch (credentials.authType) {
		case 'apiKey':
			if (credentials.apiKeyLocation === 'header') {
				headers[credentials.apiKeyName ?? 'X-API-Key'] = credentials.apiKey ?? ''
			}
			break
		case 'bearer':
			headers.Authorization = `Bearer ${credentials.bearerToken}`
			break
		case 'basic': {
			const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
				'base64',
			)
			headers.Authorization = `Basic ${encoded}`
			break
		}
	}

	return headers
}
