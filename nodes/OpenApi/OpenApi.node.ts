import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow'
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow'
import { parseOpenApiSpec } from './lib/parseOpenApiSpec'
import { extractOperations } from './lib/extractOperations'
import { schemaToNodeProperties } from './lib/schemaToNodeProperties'
import { buildRequestOptions } from './lib/buildRequestOptions'
import type { OpenApiDocument, ParsedOperation } from './lib/types'

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
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				noDataExpression: true,
				typeOptions: {
					loadOptionsMethod: 'getOperations',
				},
				default: '',
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
		const bodyProperties = schemaToNodeProperties(operation.requestBodySchema, operationId)

		for (let i = 0; i < items.length; i++) {
			const params = collectParameters(this, operation, i)
			const bodyParams = collectBodyParameters(this, bodyProperties, i)

			const requestOptions = buildRequestOptions(
				operation,
				baseUrl,
				params,
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

function collectParameters(
	context: IExecuteFunctions,
	operation: ParsedOperation,
	itemIndex: number,
): Record<string, unknown> {
	const params: Record<string, unknown> = {}

	for (const param of operation.parameters) {
		const value = context.getNodeParameter(param.name, itemIndex, undefined) as unknown
		if (value !== undefined && value !== '') {
			params[param.name] = value
		}
	}

	return params
}

function collectBodyParameters(
	context: IExecuteFunctions,
	bodyProperties: ReturnType<typeof schemaToNodeProperties>,
	itemIndex: number,
): Record<string, unknown> {
	const body: Record<string, unknown> = {}

	for (const prop of bodyProperties) {
		const value = context.getNodeParameter(prop.name, itemIndex, undefined) as unknown
		if (value !== undefined && value !== '') {
			body[prop.name] = value
		}
	}

	return body
}
