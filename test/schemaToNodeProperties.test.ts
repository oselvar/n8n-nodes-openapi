import { describe, it, expect } from 'vitest'
import { schemaToNodeProperties } from '../nodes/OpenApi/lib/schemaToNodeProperties'
import type { OpenApiSchema } from '../nodes/OpenApi/lib/types'

describe('schemaToNodeProperties', () => {
	it('converts string property', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'The name',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'createPet')

		expect(properties).toHaveLength(1)
		expect(properties[0]).toMatchObject({
			displayName: 'Name',
			name: 'name',
			type: 'string',
			default: '',
			required: false,
			description: 'The name',
		})
	})

	it('converts required string property', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			required: ['name'],
			properties: {
				name: {
					type: 'string',
					description: 'The name',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'createPet')

		expect(properties[0].required).toBe(true)
	})

	it('converts integer property to number type', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				age: {
					type: 'integer',
					description: 'Age in years',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'createPet')

		expect(properties[0]).toMatchObject({
			displayName: 'Age',
			name: 'age',
			type: 'number',
			default: 0,
			description: 'Age in years',
		})
	})

	it('converts number property', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				price: {
					type: 'number',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'setPrice')

		expect(properties[0]).toMatchObject({
			name: 'price',
			type: 'number',
			default: 0,
		})
	})

	it('converts boolean property', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				vaccinated: {
					type: 'boolean',
					description: 'Whether the pet is vaccinated',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'createPet')

		expect(properties[0]).toMatchObject({
			displayName: 'Vaccinated',
			name: 'vaccinated',
			type: 'boolean',
			default: false,
			description: 'Whether the pet is vaccinated',
		})
	})

	it('converts enum to options type', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['available', 'pending', 'sold'],
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'updateStatus')

		expect(properties[0]).toMatchObject({
			displayName: 'Status',
			name: 'status',
			type: 'options',
		})
		expect(properties[0].options).toEqual([
			{ name: 'Available', value: 'available' },
			{ name: 'Pending', value: 'pending' },
			{ name: 'Sold', value: 'sold' },
		])
	})

	it('includes displayOptions for operation', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				name: {
					type: 'string',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'createPet')

		expect(properties[0].displayOptions).toEqual({
			show: {
				operation: ['createPet'],
			},
		})
	})

	it('includes routing for body property', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				name: {
					type: 'string',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'createPet')

		expect(properties[0].routing).toEqual({
			send: {
				type: 'body',
				property: 'name',
			},
		})
	})

	it('handles schema with default values', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				limit: {
					type: 'integer',
					default: 10,
				},
				active: {
					type: 'boolean',
					default: true,
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'list')

		const limitProp = properties.find((p) => p.name === 'limit')
		expect(limitProp?.default).toBe(10)

		const activeProp = properties.find((p) => p.name === 'active')
		expect(activeProp?.default).toBe(true)
	})

	it('handles multiple properties', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			required: ['markdownBody', 'preview'],
			properties: {
				markdownBody: {
					type: 'string',
					description: 'The markdown content to render',
				},
				preview: {
					type: 'string',
					description: 'Preview text shown in email clients',
				},
			},
		}

		const properties = schemaToNodeProperties(schema, 'renderEmail')

		expect(properties).toHaveLength(2)
		expect(properties[0]).toMatchObject({
			displayName: 'Markdown Body',
			name: 'markdownBody',
			type: 'string',
			required: true,
			description: 'The markdown content to render',
		})
		expect(properties[1]).toMatchObject({
			displayName: 'Preview',
			name: 'preview',
			type: 'string',
			required: true,
			description: 'Preview text shown in email clients',
		})
	})

	it('returns empty array for undefined schema', () => {
		const properties = schemaToNodeProperties(undefined, 'op')
		expect(properties).toEqual([])
	})

	it('returns empty array for non-object schema', () => {
		const schema: OpenApiSchema = {
			type: 'string',
		}
		const properties = schemaToNodeProperties(schema, 'op')
		expect(properties).toEqual([])
	})

	it('converts camelCase to Title Case for displayName', () => {
		const schema: OpenApiSchema = {
			type: 'object',
			properties: {
				firstName: { type: 'string' },
				lastName: { type: 'string' },
				emailAddress: { type: 'string' },
			},
		}

		const properties = schemaToNodeProperties(schema, 'create')

		expect(properties[0].displayName).toBe('First Name')
		expect(properties[1].displayName).toBe('Last Name')
		expect(properties[2].displayName).toBe('Email Address')
	})
})
