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
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { parseOpenApiSpec } from './lib/parseOpenApiSpec';
import { extractOperations } from './lib/extractOperations';
import { buildRequestOptions, type BodyData } from './lib/buildRequestOptions';
import type {
	OpenApiDocument,
	OpenApiSchema,
	ParsedParameter,
	ParsedRequestBody,
} from './lib/types';

type FetchContext = ILoadOptionsFunctions | IExecuteFunctions;

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
				displayName: 'Content Type Name or ID',
				name: 'contentType',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				noDataExpression: true,
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getContentType',
					loadOptionsDependsOn: ['operation'],
				},
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
				displayName: 'JSON Input Mode',
				name: 'jsonInputMode',
				type: 'options',
				options: [
					{
						name: 'Use Schema Fields',
						value: 'fields',
						description: 'Fill in fields based on the API schema',
					},
					{
						name: 'Raw JSON',
						value: 'raw',
						description: 'Enter raw JSON directly',
					},
				],
				default: 'fields',
				displayOptions: {
					show: {
						contentType: ['application/json'],
					},
				},
				description: 'How to provide the JSON request body',
			},
			{
				displayName: 'Request Body',
				name: 'jsonBodyFields',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getJsonBodyFields',
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
				displayOptions: {
					show: {
						contentType: ['application/json'],
						jsonInputMode: ['fields'],
					},
				},
				description: 'JSON body fields based on the API schema',
			},
			{
				displayName: 'Request Body (JSON)',
				name: 'requestBodyJson',
				type: 'json',
				default: '{}',
				description: 'JSON request body',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						contentType: ['application/json'],
						jsonInputMode: ['raw'],
					},
				},
			},
			{
				displayName: 'Request Body (XML)',
				name: 'requestBodyXml',
				type: 'string',
				default: '',
				description: 'XML request body',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						contentType: ['application/xml'],
					},
				},
			},
			{
				displayName: 'Form Data',
				name: 'formData',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getFormFields',
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
				displayOptions: {
					show: {
						contentType: ['application/x-www-form-urlencoded', 'multipart/form-data'],
					},
				},
				description: 'Form fields for form-urlencoded or multipart requests',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property containing the file to upload',
				displayOptions: {
					show: {
						contentType: ['multipart/form-data'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getOperations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('openApiCredentialsApi');
				const specUrl = credentials.specUrl as string;

				const specContent = await fetchSpec(this, specUrl);
				const spec = await parseOpenApiSpec(specContent);
				const operations = extractOperations(spec);

				return operations.map((op) => ({
					name: op.summary || op.operationId,
					value: op.operationId,
					description: `${op.method.toUpperCase()} ${op.path}`,
				}));
			},
			async getContentType(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const operation = await getSelectedOperation(this);
				const contentType = operation?.requestBody?.contentType ?? '';
				return [{ name: contentType, value: contentType }];
			},
		},
		resourceMapping: {
			async getPathParameters(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this);
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' };
				}
				const pathParams = operation.parameters.filter((p) => p.in === 'path');
				if (pathParams.length === 0) {
					return { fields: [], emptyFieldsNotice: 'This operation has no path parameters' };
				}
				return { fields: parametersToResourceMapperFields(pathParams) };
			},
			async getQueryParameters(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this);
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' };
				}
				const queryParams = operation.parameters.filter((p) => p.in === 'query');
				if (queryParams.length === 0) {
					return { fields: [], emptyFieldsNotice: 'This operation has no query parameters' };
				}
				return { fields: parametersToResourceMapperFields(queryParams) };
			},
			async getFormFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this);
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' };
				}
				if (!operation.requestBody) {
					return { fields: [], emptyFieldsNotice: 'This operation has no request body' };
				}
				const contentType = operation.requestBody.contentType;
				if (
					contentType !== 'application/x-www-form-urlencoded' &&
					contentType !== 'multipart/form-data'
				) {
					return {
						fields: [],
						emptyFieldsNotice: `Use ${contentType === 'application/json' ? 'JSON' : 'XML'} input for this operation`,
					};
				}
				return { fields: schemaToResourceMapperFields(operation.requestBody.schema, contentType) };
			},
			async getJsonBodyFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const operation = await getSelectedOperation(this);
				if (!operation) {
					return { fields: [], emptyFieldsNotice: 'Select an operation first' };
				}
				if (!operation.requestBody) {
					return { fields: [], emptyFieldsNotice: 'This operation has no request body' };
				}
				if (operation.requestBody.contentType !== 'application/json') {
					return { fields: [], emptyFieldsNotice: 'This operation does not use JSON body' };
				}
				return { fields: schemaToResourceMapperFields(operation.requestBody.schema) };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('openApiCredentialsApi');
		const specUrl = credentials.specUrl as string;
		const baseUrlOverride = credentials.baseUrlOverride as string | undefined;

		const specContent = await fetchSpec(this, specUrl);
		const spec = await parseOpenApiSpec(specContent);
		const operations = extractOperations(spec);

		const operationId = this.getNodeParameter('operation', 0) as string;
		const operation = operations.find((op) => op.operationId === operationId);

		if (!operation) {
			throw new NodeOperationError(
				this.getNode(),
				`Operation "${operationId}" not found in OpenAPI spec`,
			);
		}

		const baseUrl = baseUrlOverride || getBaseUrl(spec);

		for (let i = 0; i < items.length; i++) {
			const pathParams = extractResourceMapperValues(this, 'pathParameters', i);
			const queryParams = extractResourceMapperValues(this, 'queryParameters', i);

			const bodyData = extractBodyData(this, i, operation.requestBody, items[i]);

			const requestOptions = buildRequestOptions(
				operation,
				baseUrl,
				{ ...pathParams, ...queryParams },
				bodyData,
				credentials as Record<string, unknown>,
			);

			const response = await this.helpers.httpRequest(requestOptions);
			returnData.push({ json: response as IDataObject });
		}

		return [returnData];
	}
}

async function fetchSpec(context: FetchContext, url: string): Promise<string> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url,
		returnFullResponse: false,
	};
	const response = await context.helpers.httpRequest(options);
	if (typeof response === 'string') {
		return response;
	}
	return JSON.stringify(response);
}

function getBaseUrl(spec: OpenApiDocument): string {
	const servers = spec.servers;
	if (servers && servers.length > 0) {
		return servers[0].url;
	}
	return '';
}

function extractResourceMapperValues(
	context: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
): Record<string, unknown> {
	const value = context.getNodeParameter(`${paramName}.value`, itemIndex, {}) as Record<
		string,
		unknown
	> | null;
	return value ?? {};
}

function extractBodyData(
	context: IExecuteFunctions,
	itemIndex: number,
	requestBody: ParsedRequestBody | undefined,
	item: INodeExecutionData,
): BodyData {
	if (!requestBody) {
		return { contentType: undefined, data: {} };
	}

	const contentType = requestBody.contentType;

	switch (contentType) {
		case 'application/json': {
			const jsonInputMode = context.getNodeParameter(
				'jsonInputMode',
				itemIndex,
				'fields',
			) as string;
			if (jsonInputMode === 'fields') {
				const data = extractResourceMapperValues(context, 'jsonBodyFields', itemIndex);
				return { contentType, data };
			}
			const jsonStr = context.getNodeParameter('requestBodyJson', itemIndex, '{}') as string;
			const data = jsonStr && jsonStr.trim() !== '' ? JSON.parse(jsonStr) : {};
			return { contentType, data };
		}
		case 'application/xml': {
			const xmlStr = context.getNodeParameter('requestBodyXml', itemIndex, '') as string;
			return { contentType, data: xmlStr };
		}
		case 'application/x-www-form-urlencoded':
		case 'multipart/form-data': {
			const formData = extractResourceMapperValues(context, 'formData', itemIndex);
			const binaryPropertyName = context.getNodeParameter(
				'binaryPropertyName',
				itemIndex,
				'data',
			) as string;

			if (contentType === 'multipart/form-data' && item.binary?.[binaryPropertyName]) {
				return {
					contentType,
					data: formData,
					binaryPropertyName,
				};
			}
			return { contentType, data: formData };
		}
		default:
			return { contentType: undefined, data: {} };
	}
}

function schemaToResourceMapperFields(
	schema: OpenApiSchema,
	contentType?: string,
): ResourceMapperField[] {
	if (schema.type !== 'object' || !schema.properties) {
		return [];
	}

	const requiredFields = schema.required ?? [];

	return Object.entries(schema.properties).map(([name, propSchema]) => {
		const prop = propSchema as OpenApiSchema;
		const required = requiredFields.includes(name);
		const isBinaryFile = contentType === 'multipart/form-data' && isBinarySchema(prop);
		return {
			id: name,
			displayName: toDisplayName(name) + (isBinaryFile ? ' (Binary)' : ''),
			required,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type: isBinaryFile ? 'string' : mapSchemaTypeToFieldType(prop),
			options: prop.enum?.map((value) => ({ name: String(value), value })),
		};
	});
}

function isBinarySchema(schema: OpenApiSchema): boolean {
	if (schema.format === 'binary' || schema.format === 'byte') {
		return true;
	}
	if (schema.type === 'string' && schema.format === 'binary') {
		return true;
	}
	return false;
}

function mapSchemaTypeToFieldType(schema: OpenApiSchema): ResourceMapperField['type'] {
	const schemaType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
	switch (schemaType) {
		case 'integer':
		case 'number':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'array':
		case 'object':
			return 'object';
		case 'string':
		default:
			if (schema.enum) {
				return 'options';
			}
			return 'string';
	}
}

function toDisplayName(name: string): string {
	return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

async function getSelectedOperation(context: ILoadOptionsFunctions) {
	const credentials = await context.getCredentials('openApiCredentialsApi');
	const specUrl = credentials.specUrl as string;
	const operationId = context.getNodeParameter('operation', 0) as string;

	if (!operationId) {
		return undefined;
	}

	const specContent = await fetchSpec(context, specUrl);
	const spec = await parseOpenApiSpec(specContent);
	const operations = extractOperations(spec);
	return operations.find((op) => op.operationId === operationId);
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
	}));
}
