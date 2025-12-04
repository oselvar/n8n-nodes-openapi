import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseOpenApiSpec } from '../nodes/OpenApi/lib/parseOpenApiSpec'

describe('parseOpenApiSpec', () => {
	it('parses a valid OpenAPI 3.0 spec from JSON string', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')

		const result = await parseOpenApiSpec(specContent)

		expect(result.openapi).toBe('3.0.3')
		expect(result.info.title).toBe('Petstore API')
		expect(result.paths).toBeDefined()
		expect(result.paths?.['/pets']).toBeDefined()
	})

	it('parses a valid OpenAPI 3.1 spec from JSON string', async () => {
		const specPath = join(__dirname, 'fixtures/papyria.json')
		const specContent = await readFile(specPath, 'utf-8')

		const result = await parseOpenApiSpec(specContent)

		expect(result.openapi).toBe('3.1.0')
		expect(result.info.title).toBe('Papyria API')
	})

	it('dereferences $ref pointers', async () => {
		const specPath = join(__dirname, 'fixtures/petstore.json')
		const specContent = await readFile(specPath, 'utf-8')

		const result = await parseOpenApiSpec(specContent)

		const putPet = result.paths?.['/pets/{petId}']?.put
		expect(putPet).toBeDefined()
		const requestBody = putPet?.requestBody as { content: Record<string, { schema: unknown }> }
		const schema = requestBody?.content?.['application/json']?.schema as Record<string, unknown>
		expect(schema?.type).toBe('object')
		expect(schema?.properties).toBeDefined()
		expect(schema?.$ref).toBeUndefined()
	})

	it('throws an error for invalid spec', async () => {
		const invalidSpec = JSON.stringify({ invalid: 'not an openapi spec' })

		await expect(parseOpenApiSpec(invalidSpec)).rejects.toThrow()
	})
})
