import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

export type OpenApiDocument = OpenAPIV3.Document | OpenAPIV3_1.Document
export type OpenApiOperation = OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject
export type OpenApiSchema = OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
export type OpenApiParameter = OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject
export type OpenApiRequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject

export type ParsedParameter = {
	readonly name: string
	readonly in: 'path' | 'query' | 'header' | 'cookie'
	readonly required: boolean
	readonly schema: OpenApiSchema
	readonly description: string
}

export type ParsedOperation = {
	readonly operationId: string
	readonly method: 'get' | 'post' | 'put' | 'patch' | 'delete'
	readonly path: string
	readonly summary: string
	readonly description: string
	readonly parameters: readonly ParsedParameter[]
	readonly requestBodySchema: OpenApiSchema | undefined
}
