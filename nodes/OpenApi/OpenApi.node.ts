import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ResourceMapperFields,
	ResourceMapperField,
} from 'n8n-workflow'
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow'
import { parseOpenApiSpec } from './lib/parseOpenApiSpec'
import { extractOperations } from './lib/extractOperations'
import { buildRequestOptions } from './lib/buildRequestOptions'
import type { OpenApiDocument, OpenApiSchema, ParsedParameter } from './lib/types'

type FetchContext = ILoadOptionsFunctions | IExecuteFunctions

export class OpenApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OpenAPI',
		name: 'openApi',
		icon: 'file:openapi.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Execute operations from any OpenAPI specification',
		defaults: {
			name: 'OpenAPI',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'openApiCredentialsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation Name or ID',
				name: 'operation',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				noDataExpression: true,
				typeOptions: {
					loadOptionsMethod: 'getOperations',
				},
				default: '',
			},
			{
				displayName: 'Path Parameters',
				name: 'pathParameters',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getPathParameters',
						mode: 'add',
						fieldWords: {
							singular: 'parameter',
							plural: 'parameters',
						},
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
					},
					loadOptionsDependsOn: ['operation'],
				},
				description: 'Path parameters for the URL template',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getQueryParameters',
						mode: 'add',
						fieldWords: {
							singular: 'parameter',
							plural: 'parameters',
						},
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
					},
					loadOptionsDependsOn: ['operation'],
				},
				description: 'Query string parameters',
			},
			{
				displayName: 'Request Body',
				name: 'requestBody',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getBodyFields',
						mode: 'add',
						fieldWords: {
							singular: 'field',
							plural: 'fields',
						},
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
					},
					loadOptionsDependsOn: ['operation'],
				},
				description: 'Request body fields',
			},
		],
	}

	methods = {
		loadOptions: {
			async getOperations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('openApiCredentialsApi')
				const specUrl = credentials.specUrl as string

				const specContent = await fetchSpec(this, specUrl)
				const spec = await parseOpenApiSpec(specContent)
				const operations = extractOperations(spec)

				return operations.map((op) => ({
					name: op.summary || op.operationId,
					value: op.operationId,
					description: `${op.method.toUpperCase()} ${op.path}`,
				}))
			},
		},
		resourceMapping: {
			async getPathParameters(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this)
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' }
				}
				const pathParams = operation.parameters.filter((p) => p.in === 'path')
				if (pathParams.length === 0) {
					return { fields: [], emptyFieldsNotice: 'This operation has no path parameters' }
				}
				return { fields: parametersToResourceMapperFields(pathParams) }
			},
			async getQueryParameters(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this)
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' }
				}
				const queryParams = operation.parameters.filter((p) => p.in === 'query')
				if (queryParams.length === 0) {
					return { fields: [], emptyFieldsNotice: 'This operation has no query parameters' }
				}
				return { fields: parametersToResourceMapperFields(queryParams) }
			},
			async getBodyFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this)
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' }
				}
				if (!operation.requestBodySchema) {
					return { fields: [], emptyFieldsNotice: 'This operation has no request body' }
				}
				return { fields: schemaToResourceMapperFields(operation.requestBodySchema) }
			},
		},
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData()
		const returnData: INodeExecutionData[] = []

		const credentials = await this.getCredentials('openApiCredentialsApi')
		const specUrl = credentials.specUrl as string
		const baseUrlOverride = credentials.baseUrlOverride as string | undefined

		const specContent = await fetchSpec(this, specUrl)
		const spec = await parseOpenApiSpec(specContent)
		const operations = extractOperations(spec)

		const operationId = this.getNodeParameter('operation', 0) as string
		const operation = operations.find((op) => op.operationId === operationId)

		if (!operation) {
			throw new NodeOperationError(
				this.getNode(),
				`Operation "${operationId}" not found in OpenAPI spec`,
			)
		}

		const baseUrl = baseUrlOverride || getBaseUrl(spec)

		for (let i = 0; i < items.length; i++) {
			const pathParams = extractResourceMapperValues(this, 'pathParameters', i)
			const queryParams = extractResourceMapperValues(this, 'queryParameters', i)
			const bodyParams = extractResourceMapperValues(this, 'requestBody', i)

			const requestOptions = buildRequestOptions(
				operation,
				baseUrl,
				{ ...pathParams, ...queryParams },
				bodyParams,
				credentials as Record<string, unknown>,
			)

			const response = await this.helpers.httpRequest(requestOptions)
			returnData.push({ json: response as IDataObject })
		}

		return [returnData]
	}
}

async function fetchSpec(context: FetchContext, url: string): Promise<string> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url,
		returnFullResponse: false,
	}
	const response = await context.helpers.httpRequest(options)
	if (typeof response === 'string') {
		return response
	}
	return JSON.stringify(response)
}

function getBaseUrl(spec: OpenApiDocument): string {
	const servers = spec.servers
	if (servers && servers.length > 0) {
		return servers[0].url
	}
	return ''
}

function extractResourceMapperValues(
	context: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
): Record<string, unknown> {
	const value = context.getNodeParameter(
		`${paramName}.value`,
		itemIndex,
		{},
	) as Record<string, unknown> | null
	return value ?? {}
}

function schemaToResourceMapperFields(schema: OpenApiSchema): ResourceMapperField[] {
	if (schema.type !== 'object' || !schema.properties) {
		return []
	}

	const requiredFields = schema.required ?? []

	return Object.entries(schema.properties).map(([name, propSchema]) => {
		const prop = propSchema as OpenApiSchema
		const required = requiredFields.includes(name)
		return {
			id: name,
			displayName: toDisplayName(name),
			required,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type: mapSchemaTypeToFieldType(prop),
			options: prop.enum?.map((value) => ({ name: String(value), value })),
		}
	})
}

function mapSchemaTypeToFieldType(schema: OpenApiSchema): ResourceMapperField['type'] {
	const schemaType = Array.isArray(schema.type) ? schema.type[0] : schema.type
	switch (schemaType) {
		case 'integer':
		case 'number':
			return 'number'
		case 'boolean':
			return 'boolean'
		case 'array':
		case 'object':
			return 'object'
		case 'string':
		default:
			if (schema.enum) {
				return 'options'
			}
			return 'string'
	}
}

function toDisplayName(name: string): string {
	return name
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/^./, (c) => c.toUpperCase())
}

async function getSelectedOperation(context: ILoadOptionsFunctions) {
	const credentials = await context.getCredentials('openApiCredentialsApi')
	const specUrl = credentials.specUrl as string
	const operationId = context.getNodeParameter('operation', 0) as string

	if (!operationId) {
		return undefined
	}

	const specContent = await fetchSpec(context, specUrl)
	const spec = await parseOpenApiSpec(specContent)
	const operations = extractOperations(spec)
	return operations.find((op) => op.operationId === operationId)
}

function parametersToResourceMapperFields(
	parameters: readonly ParsedParameter[],
): ResourceMapperField[] {
	return parameters.map((param) => ({
		id: param.name,
		displayName: toDisplayName(param.name),
		required: param.required,
		defaultMatch: false,
		canBeUsedToMatch: false,
		display: true,
		type: mapSchemaTypeToFieldType(param.schema),
		options: param.schema.enum?.map((value) => ({ name: String(value), value })),
	}))
}
