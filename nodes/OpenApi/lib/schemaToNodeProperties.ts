import type { INodeProperties } from 'n8n-workflow'
import type { OpenApiSchema } from './types'

export function schemaToNodeProperties(
	schema: OpenApiSchema | undefined,
	operationId: string,
): INodeProperties[] {
	if (!schema) return []
	if (schema.type !== 'object') return []
	if (!schema.properties) return []

	const requiredFields = schema.required ?? []

	return Object.entries(schema.properties).map(([name, propSchema]) =>
		convertProperty(name, propSchema as OpenApiSchema, requiredFields, operationId),
	)
}

function convertProperty(
	name: string,
	schema: OpenApiSchema,
	requiredFields: readonly string[],
	operationId: string,
): INodeProperties {
	const isRequired = requiredFields.includes(name)
	const baseProperty = {
		displayName: toDisplayName(name),
		name,
		required: isRequired,
		default: getDefaultValue(schema),
		description: schema.description ?? '',
		displayOptions: {
			show: {
				operation: [operationId],
			},
		},
		routing: {
			send: {
				type: 'body' as const,
				property: name,
			},
		},
	}

	if (schema.enum) {
		return {
			...baseProperty,
			type: 'options',
			options: schema.enum.map((value) => ({
				name: toDisplayName(String(value)),
				value,
			})),
		}
	}

	return {
		...baseProperty,
		type: mapSchemaTypeToN8n(schema.type),
	}
}

function mapSchemaTypeToN8n(schemaType: OpenApiSchema['type']): INodeProperties['type'] {
	const normalizedType = Array.isArray(schemaType) ? schemaType[0] : schemaType
	switch (normalizedType) {
		case 'integer':
		case 'number':
			return 'number'
		case 'boolean':
			return 'boolean'
		case 'string':
		default:
			return 'string'
	}
}

function getDefaultValue(schema: OpenApiSchema): string | number | boolean {
	if (schema.default !== undefined) {
		return schema.default as string | number | boolean
	}

	const normalizedType = Array.isArray(schema.type) ? schema.type[0] : schema.type
	switch (normalizedType) {
		case 'integer':
		case 'number':
			return 0
		case 'boolean':
			return false
		case 'string':
		default:
			return ''
	}
}

function toDisplayName(name: string): string {
	return name
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/^./, (c) => c.toUpperCase())
}
