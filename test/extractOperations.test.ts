import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseOpenApiSpec } from '../nodes/OpenApi/lib/parseOpenApiSpec'
import { extractOperations } from '../nodes/OpenApi/lib/extractOperations'

describe('extractOperations', () => {
	it('extracts all operations from petstore spec', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		expect(operations).toHaveLength(5)
		const operationIds = operations.map((op) => op.operationId)
		expect(operationIds).toContain('listPets')
		expect(operationIds).toContain('createPet')
		expect(operationIds).toContain('getPet')
		expect(operationIds).toContain('updatePet')
		expect(operationIds).toContain('deletePet')
	})

	it('extracts method and path for each operation', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const listPets = operations.find((op) => op.operationId === 'listPets')
		expect(listPets?.method).toBe('get')
		expect(listPets?.path).toBe('/pets')

		const createPet = operations.find((op) => op.operationId === 'createPet')
		expect(createPet?.method).toBe('post')
		expect(createPet?.path).toBe('/pets')

		const deletePet = operations.find((op) => op.operationId === 'deletePet')
		expect(deletePet?.method).toBe('delete')
		expect(deletePet?.path).toBe('/pets/{petId}')
	})

	it('extracts summary and description', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const listPets = operations.find((op) => op.operationId === 'listPets')
		expect(listPets?.summary).toBe('List all pets')
	})

	it('extracts path parameters', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const getPet = operations.find((op) => op.operationId === 'getPet')
		expect(getPet?.parameters).toHaveLength(1)
		expect(getPet?.parameters[0]).toMatchObject({
			name: 'petId',
			in: 'path',
			required: true,
			description: 'The pet ID',
		})
	})

	it('extracts query parameters', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const listPets = operations.find((op) => op.operationId === 'listPets')
		expect(listPets?.parameters).toHaveLength(2)

		const limitParam = listPets?.parameters.find((p) => p.name === 'limit')
		expect(limitParam).toMatchObject({
			name: 'limit',
			in: 'query',
			required: false,
			description: 'Maximum number of pets to return',
		})

		const statusParam = listPets?.parameters.find((p) => p.name === 'status')
		expect(statusParam).toMatchObject({
			name: 'status',
			in: 'query',
			required: false,
			description: 'Filter by status',
		})
	})

	it('extracts requestBody schema', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const createPet = operations.find((op) => op.operationId === 'createPet')
		expect(createPet?.requestBodySchema).toBeDefined()
		expect(createPet?.requestBodySchema?.type).toBe('object')
		const properties = createPet?.requestBodySchema?.properties as Record<string, unknown>
		expect(properties?.name).toBeDefined()
		expect(properties?.tag).toBeDefined()
		expect(properties?.age).toBeDefined()
		expect(properties?.vaccinated).toBeDefined()
	})

	it('extracts dereferenced requestBody schema', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const updatePet = operations.find((op) => op.operationId === 'updatePet')
		expect(updatePet?.requestBodySchema).toBeDefined()
		expect(updatePet?.requestBodySchema?.type).toBe('object')
		const properties = updatePet?.requestBodySchema?.properties as Record<string, unknown>
		expect(properties?.name).toBeDefined()
	})

	it('handles operations without requestBody', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')
		const spec = await parseOpenApiSpec(specContent)

		const operations = extractOperations(spec)

		const listPets = operations.find((op) => op.operationId === 'listPets')
		expect(listPets?.requestBodySchema).toBeUndefined()

		const getPet = operations.find((op) => op.operationId === 'getPet')
		expect(getPet?.requestBodySchema).toBeUndefined()
	})
})
