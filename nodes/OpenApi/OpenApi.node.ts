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
import type { OpenApiDocument, OpenApiSchema } from './lib/types'

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
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add Path Parameter',
				options: [
					{
						displayName: 'Parameter',
						name: 'parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the path parameter',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the path parameter',
							},
						],
					},
				],
				description: 'Path parameters to include in the URL (e.g., /users/{ID})',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add Query Parameter',
				options: [
					{
						displayName: 'Parameter',
						name: 'parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the query parameter',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the query parameter',
							},
						],
					},
				],
				description: 'Query parameters to append to the URL',
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
					},
					loadOptionsDependsOn: ['operation'],
				},
				description: 'The request body fields for POST/PUT/PATCH operations',
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
			async getBodyFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const credentials = await this.getCredentials('openApiCredentialsApi')
				const specUrl = credentials.specUrl as string
				const operationId = this.getNodeParameter('operation', 0) as string

				if (!operationId) {
					return { fields: [] }
				}

				const specContent = await fetchSpec(this, specUrl)
				const spec = await parseOpenApiSpec(specContent)
				const operations = extractOperations(spec)
				const operation = operations.find((op) => op.operationId === operationId)

				if (!operation || !operation.requestBodySchema) {
					return { fields: [] }
				}

				const fields = schemaToResourceMapperFields(operation.requestBodySchema)
				return { fields }
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
			const pathParams = collectFixedCollectionParameters(this, 'pathParameters', i)
			const queryParams = collectFixedCollectionParameters(this, 'queryParameters', i)
			const requestBody = extractRequestBody(this, i)

			const allParams = { ...pathParams, ...queryParams }

			const requestOptions = buildRequestOptions(
				operation,
				baseUrl,
				allParams,
				requestBody,
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

type FixedCollectionParameter = {
	parameter?: ReadonlyArray<{ name: string; value: string }>
}

function collectFixedCollectionParameters(
	context: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
): Record<string, unknown> {
	const params: Record<string, unknown> = {}
	const collection = context.getNodeParameter(paramName, itemIndex, {}) as FixedCollectionParameter

	if (collection.parameter) {
		for (const param of collection.parameter) {
			if (param.name && param.value !== undefined && param.value !== '') {
				params[param.name] = param.value
			}
		}
	}

	return params
}

function extractRequestBody(
	context: IExecuteFunctions,
	itemIndex: number,
): Record<string, unknown> {
	const requestBodyValue = context.getNodeParameter(
		'requestBody.value',
		itemIndex,
		{},
	) as Record<string, unknown> | null
	return requestBodyValue ?? {}
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
