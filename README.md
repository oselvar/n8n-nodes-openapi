# n8n-nodes-openapi

This is an n8n community node that lets you integrate with **any REST API** that has an OpenAPI specification (OpenAPI 3.0 or 3.1).

Instead of building custom nodes for each API, this universal node dynamically generates the UI and executes operations from any OpenAPI spec.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

The package name is: `@oselvar/n8n-nodes-openapi`

## Operations

The OpenAPI node dynamically loads all operations from your API specification:

- **GET** - Retrieve resources
- **POST** - Create resources
- **PUT** - Update resources (full replacement)
- **PATCH** - Update resources (partial)
- **DELETE** - Remove resources

Each operation from the OpenAPI spec appears as a selectable option with its operation ID, HTTP method, and path.

## Credentials

Create an **OpenAPI Credentials API** credential with the following configuration:

| Field                   | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| **OpenAPI Spec URL**    | URL to your API's OpenAPI specification (JSON or YAML)  |
| **Base URL Override**   | Optional. Override the server URL from the spec         |
| **Authentication Type** | Choose from: None, API Key, Bearer Token, or Basic Auth |

### Authentication Types

- **None** - For public APIs without authentication
- **API Key** - Sends key as a header (default: `X-API-Key`) or query parameter
- **Bearer Token** - Standard OAuth2/JWT token in Authorization header
- **Basic Auth** - Username and password with Base64 encoding

## Usage

1. Add the **OpenAPI** node to your workflow
2. Select your configured credential
3. Choose an operation from the dropdown (populated from your API spec)
4. Configure parameters:
   - **Path Parameters** - Values substituted into the URL (e.g., `/pets/{petId}`)
   - **Query Parameters** - Optional filters and pagination
   - **Request Body** - JSON, XML, or form data depending on content type
5. Execute the node

### Content Types

The node supports multiple request body formats:

| Content Type                        | Description                          |
| ----------------------------------- | ------------------------------------ |
| `application/json`                  | JSON object editor                   |
| `application/xml`                   | XML string editor                    |
| `application/x-www-form-urlencoded` | Form field mapper                    |
| `multipart/form-data`               | Form fields with file upload support |

### File Uploads

For `multipart/form-data` requests with file uploads:

1. Use a previous node to load binary data (e.g., Read Binary File)
2. Set the **Binary Property Name** field to the property containing your file
3. The file will be included in the form data upload

## Example: Petstore API

Using the classic [Petstore API](https://petstore3.swagger.io/):

**Credential Configuration:**

- OpenAPI Spec URL: `https://petstore3.swagger.io/api/v3/openapi.json`
- Authentication Type: API Key
- API Key Header Name: `api_key`
- API Key: `special-key`

**List Pets:**

- Operation: `findPetsByStatus`
- Query Parameters: `status = available`

**Create Pet:**

- Operation: `addPet`
- Content Type: `application/json`
- Body: `{ "name": "Fluffy", "status": "available" }`

**Get Pet by ID:**

- Operation: `getPetById`
- Path Parameters: `petId = 123`

## Compatibility

- **n8n version**: 1.0.0 or later
- **OpenAPI versions**: 3.0.x and 3.1.x

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [OpenAPI Specification](https://www.openapis.org/)
- [GitHub repository](https://github.com/oselvar/n8n-nodes-openapi)

## License

[MIT](LICENSE.md)
