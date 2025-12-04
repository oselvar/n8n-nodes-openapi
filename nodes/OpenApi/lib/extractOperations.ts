import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type {
	OpenApiDocument,
	OpenApiOperation,
	OpenApiParameter,
	OpenApiRequestBody,
	OpenApiSchema,
	ParsedOperation,
	ParsedParameter,
} from './types'

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

export function extractOperations(spec: OpenApiDocument): readonly ParsedOperation[] {
	const operations: ParsedOperation[] = []

	for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
		if (!pathItem) continue

		for (const method of HTTP_METHODS) {
			const operation = pathItem[method] as OpenApiOperation | undefined
			if (operation) {
				operations.push(parseOperation(path, method, operation, pathItem.parameters))
			}
		}
	}

	return operations
}

function parseOperation(
	path: string,
	method: HttpMethod,
	operation: OpenApiOperation,
	pathLevelParameters: readonly (OpenApiParameter | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject)[] | undefined,
): ParsedOperation {
	const allParameters = [...(pathLevelParameters ?? []), ...(operation.parameters ?? [])]
	const parameters = allParameters
		.filter(isParameterObject)
		.map(parseParameter)

	return {
		operationId: operation.operationId ?? `${method}_${path.replace(/\//g, '_')}`,
		method,
		path,
		summary: operation.summary ?? '',
		description: operation.description ?? '',
		parameters,
		requestBodySchema: extractRequestBodySchema(operation.requestBody),
	}
}

function isParameterObject(
	param: OpenApiParameter | OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject,
): param is OpenApiParameter {
	return !('$ref' in param)
}

function parseParameter(param: OpenApiParameter): ParsedParameter {
	return {
		name: param.name,
		in: param.in as ParsedParameter['in'],
		required: param.required ?? false,
		schema: (param.schema as OpenApiSchema) ?? { type: 'string' },
		description: param.description ?? '',
	}
}

function extractRequestBodySchema(
	requestBody: OpenApiOperation['requestBody'],
): OpenApiSchema | undefined {
	if (!requestBody) return undefined
	if ('$ref' in requestBody) return undefined

	const body = requestBody as OpenApiRequestBody
	const jsonContent = body.content?.['application/json']
	if (!jsonContent) return undefined

	return jsonContent.schema as OpenApiSchema | undefined
}
