# Azure Functions

## Tiers
1. **Flex Consumption Plan** - Pay as you go. This is Microsoft's recommended serverless tier. It addresses historical cold-start and networking limitations of Azure Functions by offering native Virtual Network (VNet) integration and optional "always-ready" instances. You are billed per second of active execution time.
2. **Consumption Plan** - Traditional serverless tier with automatic scaling. Cold starts can occur when idling. Billed per execution count and resource consumption (GB-s).
3. **Premium Plan** - Supports extended execution duration (up to 30 min default, configurable to unbounded) and reliable VNet integration for secure backend access. Designed for mission-critical workloads requiring high performance. You pay for pre-warmed compute instances (guaranteeing zero cold starts).
4. **Dedicated (App Service) Plan** - Run functions on an existing App Service plan at no extra compute cost. Scaling is rule-based rather than purely event-driven, but instances remain constantly warm.
5. **Container Apps Plan** - Deploy containerized Azure Functions directly into an Azure Container Apps environment. Runs serverless functions alongside microservices on the exact same VNet using KEDA autoscaling rules.

## Project Structure

| File / Folder | Description | Local | Required for App to Run in Azure |
| --- | --- | --- | --- |
| `function_app.py` | Main script where Azure Functions and triggers are defined using decorators (Python v2 model). | Yes | ✅ |
| `host.json` | Global configuration for all functions in the function app. | Yes | ✅ |
| `requirements.txt` | Python dependencies installed during deployment / remote build (Oryx). | Yes | ✅ (for remote build) |
| `local.settings.json` | Local-only app settings and secrets (never committed). Environment variables (e.g., `os.environ["AI_SERVICE_ENDPOINT"]`). Configures `UseDevelopmentStorage=true`. | Yes (Do not commit) | ❌ |
| `.funcignore` | Specifies files and folders to exclude from deployment (e.g., `.venv/`, `tests/`, `local.settings.json`). | Yes | ❌ (recommended) |
| `.venv/` | Local virtual environment for Python (excluded from deployment). | Optional | ❌ |
| `.vscode/` | Editor configuration for Visual Studio Code. | Optional | ❌ |
| `shared/` | Holds helper code shared across the Function App project. | Yes | ❌ |
| `additional_functions/` | Modular code organization (e.g., using Blueprints). | Yes | ❌ |
| `tests/` | Unit tests for your function app. Excluded from Azure deployment. | Optional | ❌ |
| `Dockerfile` | Defines a custom container image for containerized deployment. | Optional | ❌ |

## Architecture

### Azurite Emulator
1. The Azure Functions runtime requires a storage account connection (configured via `AzureWebJobsStorage`).
2. Use Azurite storage emulator in `local.settings.json`:
```json
{
    "IsEncrypted": false,
    "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "FUNCTIONS_WORKER_RUNTIME": "python"
    }
}
```
3. When deployed to Azure, the platform uses a linked Azure Storage account. `UseDevelopmentStorage=true` applies only to local development.
4. Run Azurite using Docker:
   `docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite`

### Limits & Timeouts
1. **HTTP Trigger Gateway Timeout**: **230 seconds (~3 minutes 50 seconds)**. This is a hard response timeout enforced by the Azure Load Balancer / App Service Gateway for HTTP triggers. For operations exceeding 230s, use an asynchronous pattern (e.g., return `202 Accepted` with a status polling URL) or decouple work via Service Bus or Durable Functions.
2. **Function Execution Duration Limits**:
   - **Consumption Plan**: Default is 5 minutes; maximum configurable limit is 10 minutes.
   - **Flex Consumption Plan**: Default is 5 minutes; maximum configurable limit is 30 minutes.
   - **Premium / Dedicated Plans**: Default is 30 minutes; can be configured to unbounded (`-1` or `0`).

## Key Vault & Configuration

1. **Key Vault Reference Syntax in App Settings**:
   - `@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/<secret-name>/)`
   - `@Microsoft.KeyVault(VaultName=<vault-name>;SecretName=<secret-name>)`
2. **Key Rotation & Refresh**: Key Vault references automatically re-fetch updated secret values within 24 hours. To trigger an immediate refresh, update any app setting (e.g., touch a configuration value) or implement a sentinel key pattern with Azure App Configuration.
3. **Version Pinning**: To pin a specific secret version, append the version GUID to the URI (`https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version-guid>`) or specify `SecretVersion=<version-guid>`.
4. **Authentication**: Enable System-Assigned or User-Assigned Managed Identity on the Function App and grant the identity the `Key Vault Secrets User` role on the Key Vault.
5. **Local Development**: Key Vault references (`@Microsoft.KeyVault(...)`) do **NOT** automatically resolve in `local.settings.json` during local execution (`func start`). For local dev, put actual secret values in `local.settings.json` or fetch secrets in code using `DefaultAzureCredential` from `azure-identity`.

## Identity via Storage (`AzureWebJobsStorage`)

1. **Runtime Storage Usage**: Azure Functions uses `AzureWebJobsStorage` for:
   - **Code Storage**: Deployment package storage for serverless execution.
   - **State & Coordination**: Storage blob leases ensure singleton execution (e.g., Timer Triggers fire on only one instance when scaled out).
   - **Internal Queues**: Managing execution retries, scale-out behavior, and Durable Functions orchestration state.
   - **Logging**: Temporary log buffers before ingestion into Application Insights.
2. **Connection Methods**:
   - **Connection String (Legacy / Local)**: `AzureWebJobsStorage = "DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<key>;EndpointSuffix=core.windows.net"` or `"UseDevelopmentStorage=true"`.
   - **Identity-based Connection (Recommended)**: Configured using `AzureWebJobsStorage__accountName = <account_name>` (or `__blobServiceUri`, `__queueServiceUri`, `__tableServiceUri`). Uses Managed Identity without storing connection keys.
3. **Required Azure RBAC Data Plane Roles**:
   - `Storage Blob Data Contributor`: Required for blob read/write/delete access (deployment packages, state, blob triggers). *(Note: `Storage Account Contributor` is a Management Plane role and does NOT grant data plane access).*
   - `Storage Queue Data Contributor`: Required for queue triggers and runtime coordination.
   - `Storage Table Data Contributor`: Required for keys, locks, and Durable Functions storage tables.
4. **Secret Storage Setting**: Setting `"AzureWebJobsSecretStorageType": "Files"` in `local.settings.json` stores function auth keys in the local file system instead of Azure Blob Storage.

## Authentication & Authorization

1. **Authorization Levels (`auth_level`)**:
   - **Function key**: Scoped to a single function. Passed via `x-functions-key` header or `?code=` query parameter.
   - **Host key**: Scoped to all HTTP-triggered functions in the app.
   - **System key**: Used by runtime extensions (e.g., `mcp_extension` system key).
   - **Master key**: Administrative key that grants full access and overrides all other keys. Keep confidential.
2. **Code Examples**:
   ```python
   @app.route(route="classify", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
   def classify_document(req: func.HttpRequest) -> func.HttpResponse:
       # Requires function key or host key
       pass

   @app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
   def health_check(req: func.HttpRequest) -> func.HttpResponse:
       return func.HttpResponse("OK", status_code=200)
   ```

   ```javascript
   app.http('HttpExample', {
       methods: ['GET', 'POST'],
       authLevel: 'anonymous',
       handler: HttpExample
   });
   ```

### Standard Azure RBAC Roles Summary
1. `Azure Service Bus Data Receiver` / `Azure Service Bus Data Sender`: Grants permission to receive/send Service Bus messages using Managed Identity.
2. `Storage Blob Data Contributor`, `Storage Queue Data Contributor`, `Storage Table Data Contributor`: Data-plane roles required on the Storage Account for `AzureWebJobsStorage`.
3. `Key Vault Secrets User`: Required on Key Vault for reading secrets via Managed Identity.

## Tips & Best Practices

1. **Azure Documentation & `host.json` Settings**:
   - Search for exact binding property names in `host.json` (e.g., `maxConcurrentCalls` for Service Bus triggers).
   - Reference: [Service Bus bindings for Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-service-bus?tabs=isolated-process%2Cextensionv5&pivots=programming-language-csharp)
2. **Log Streaming**: On Linux Function Apps, Application Insights must be configured properly to stream live execution logs.
3. **Durable Functions**: Extension of Azure Functions for stateful workflows. Core components:
   - **Client Function (Starter)**: Triggers orchestrations from HTTP requests, timers, or queue events.
   - **Orchestrator Function**: Defines workflow logic in code (must be deterministic).
   - **Activity Function**: Executes individual steps/tasks (I/O, database access, API calls).
   - *(Optional: Entity Functions for stateful actors)*.