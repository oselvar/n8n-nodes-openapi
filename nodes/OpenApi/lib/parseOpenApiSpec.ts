import { dereference, validate } from '@scalar/openapi-parser';
import type { OpenApiDocument } from './types';

export async function parseOpenApiSpec(specContent: string): Promise<OpenApiDocument> {
	const { valid, errors } = await validate(specContent);
	if (!valid) {
		const errorMessages = errors?.map((e) => e.message).join(', ') ?? 'Unknown validation error';
		throw new Error(`Invalid OpenAPI spec: ${errorMessages}`);
	}

	const { schema } = await dereference(specContent);
	return schema as OpenApiDocument;
}
