import { Buffer } from 'node:buffer';
import type { IDataObject, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';
import type { ParsedOperation } from './types';

type Credentials = {
	readonly authType?: string;
	readonly apiKey?: string;
	readonly apiKeyLocation?: string;
	readonly apiKeyName?: string;
	readonly bearerToken?: string;
	readonly username?: string;
	readonly password?: string;
};

export type BodyData = {
	contentType: string | undefined;
	data: Record<string, unknown> | string;
	binaryPropertyName?: string;
};

export function buildRequestOptions(
	operation: ParsedOperation,
	baseUrl: string,
	params: Record<string, unknown>,
	bodyData: BodyData,
	credentials?: Credentials,
): IHttpRequestOptions {
	const { url, usedParams } = buildUrl(baseUrl, operation.path, params);
	const qs = buildQueryString(params, usedParams, credentials);
	const headers = buildHeaders(credentials, bodyData.contentType);

	const options: IHttpRequestOptions = {
		method: operation.method.toUpperCase() as IHttpRequestMethods,
		url,
		headers,
	};

	if (Object.keys(qs).length > 0) {
		options.qs = qs;
	}

	applyBody(options, bodyData);

	return options;
}

function applyBody(options: IHttpRequestOptions, bodyData: BodyData): void {
	if (!bodyData.contentType) return;

	const { contentType, data } = bodyData;

	switch (contentType) {
		case 'application/json':
			if (typeof data === 'object' && Object.keys(data).length > 0) {
				options.body = data;
				options.json = true;
			}
			break;
		case 'application/xml':
			if (typeof data === 'string' && data.length > 0) {
				options.body = data;
			}
			break;
		case 'application/x-www-form-urlencoded':
			if (typeof data === 'object' && Object.keys(data).length > 0) {
				options.body = data;
			}
			break;
		case 'multipart/form-data':
			if (typeof data === 'object') {
				options.body = data;
				if (bodyData.binaryPropertyName) {
					options.json = false;
				}
			}
			break;
	}
}

function buildUrl(
	baseUrl: string,
	path: string,
	params: Record<string, unknown>,
): { url: string; usedParams: Set<string> } {
	let url = `${baseUrl}${path}`;
	const usedParams = new Set<string>();

	const pathParamRegex = /\{([^}]+)\}/g;
	let match;
	while ((match = pathParamRegex.exec(path)) !== null) {
		const paramName = match[1];
		const value = params[paramName];
		if (value !== undefined) {
			url = url.replace(`{${paramName}}`, encodeURIComponent(String(value)));
			usedParams.add(paramName);
		}
	}

	return { url, usedParams };
}

function buildQueryString(
	params: Record<string, unknown>,
	usedParams: Set<string>,
	credentials?: Credentials,
): IDataObject {
	const qs: IDataObject = {};

	for (const [name, value] of Object.entries(params)) {
		if (!usedParams.has(name) && value !== undefined && value !== '') {
			qs[name] = value;
		}
	}

	if (credentials?.authType === 'apiKey' && credentials.apiKeyLocation === 'query') {
		qs[credentials.apiKeyName ?? 'api_key'] = credentials.apiKey;
	}

	return qs;
}

function buildHeaders(credentials?: Credentials, contentType?: string): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
	};

	if (contentType) {
		headers['Content-Type'] = contentType;
	}

	if (!credentials) return headers;

	switch (credentials.authType) {
		case 'apiKey':
			if (credentials.apiKeyLocation === 'header') {
				headers[credentials.apiKeyName ?? 'X-API-Key'] = credentials.apiKey ?? '';
			}
			break;
		case 'bearer':
			headers.Authorization = `Bearer ${credentials.bearerToken}`;
			break;
		case 'basic': {
			const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString(
				'base64',
			);
			headers.Authorization = `Basic ${encoded}`;
			break;
		}
	}

	return headers;
}
