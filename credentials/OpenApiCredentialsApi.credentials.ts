import type {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow'

export class OpenApiCredentialsApi implements ICredentialType {
	name = 'openApiCredentialsApi'
	displayName = 'OpenAPI Credentials API'
	documentationUrl = 'https://github.com/oselvar/n8n-nodes-openapi'
	icon: Icon = 'file:../nodes/OpenApi/openapi.svg'

	properties: INodeProperties[] = [
		{
			displayName: 'OpenAPI Spec URL',
			name: 'specUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://api.example.com/openapi.json',
			description: 'URL to the OpenAPI specification (JSON or YAML)',
		},
		{
			displayName: 'Base URL Override',
			name: 'baseUrlOverride',
			type: 'string',
			default: '',
			placeholder: 'https://api.example.com/v1',
			description:
				'Override the base URL from the spec. Leave empty to use the URL from the spec.',
		},
		{
			displayName: 'Authentication Type',
			name: 'authType',
			type: 'options',
			options: [
				{ name: 'None', value: 'none' },
				{ name: 'API Key', value: 'apiKey' },
				{ name: 'Bearer Token', value: 'bearer' },
				{ name: 'Basic Auth', value: 'basic' },
			],
			default: 'none',
			description: 'The authentication method to use',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					authType: ['apiKey'],
				},
			},
			description: 'The API key to use for authentication',
		},
		{
			displayName: 'API Key Location',
			name: 'apiKeyLocation',
			type: 'options',
			options: [
				{ name: 'Header', value: 'header' },
				{ name: 'Query Parameter', value: 'query' },
			],
			default: 'header',
			displayOptions: {
				show: {
					authType: ['apiKey'],
				},
			},
			description: 'Where to send the API key',
			typeOptions: { password: true },
		},
		{
			displayName: 'API Key Name',
			name: 'apiKeyName',
			type: 'string',
			default: 'X-API-Key',
			displayOptions: {
				show: {
					authType: ['apiKey'],
				},
			},
			description: 'The name of the header or query parameter for the API key',
			typeOptions: { password: true },
		},
		{
			displayName: 'Bearer Token',
			name: 'bearerToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					authType: ['bearer'],
				},
			},
			description: 'The bearer token to use for authentication',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					authType: ['basic'],
				},
			},
			description: 'The username for basic authentication',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					authType: ['basic'],
				},
			},
			description: 'The password for basic authentication',
		},
	]

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.specUrl}}',
			method: 'GET',
			url: '',
		},
	}
}
