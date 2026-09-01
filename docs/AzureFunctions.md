# Functions

## Tiers
1. Flex Consumption Plan - Pay as you go. This is Microsoft's new recommended serverless tier. It addresses the biggest historical drawbacks of Azure Functions by offering native Virtual Network (VNet) support and the ability to configure optional "always-ready" instances to eliminate cold starts. You are billed per second of active execution time.
2. Legacy Consumption Plan - deprecated
3. Premium Plan - Designed for mission-critical workloads requiring high performance. You pay a fixed monthly fee for a pool of pre-warmed compute instances (guaranteeing zero cold starts). It supports unbounded execution times and full VNet isolation.
4. Dedicated (App Service) Plan - If you already pay for a dedicated App Service plan, you can run functions on it at no extra cost. Scaling is rule-based rather than purely event-driven, but instances remain constantly warm.
5. Container Apps Plan - You can deploy containerized Azure Functions directly into an Azure Container Apps environment. This allows your serverless functions to run alongside your custom Node.js Hono API on the exact same VNet, utilizing the KEDA autoscaling rules you have already configured.

## Project structure

| File Folder | Description | Local | Required for app to run in Azure |
| --- | --- | --- | --- |
| function_app.py | Main script where Azure Functions and triggers are defined using decorators. | X | ✅ |
| host.json | Global configuration for all functions in the app. | X | ✅ |
| requirements.txt | Python dependencies installed during publish when using remote build. | X | ❌ |
| local.settings.json | Local-only app settings and secrets (never published). Get via os.environ["AI_SERVICE_ENDPOINT"]. Also to set `useDevelopmentStorage=true` | YES. Do not commit | ❌ |
| .funcignore | Specifies files and folders to exclude from deployment (for example, .venv/, tests/, local.settings.json). | X, but not for Azure | ❌ (recommended) |
| .venv/ | Local virtual environment for Python (excluded from deployment). | Optinal | ❌ |
| .vscode/ | Editor config for Visual Studio Code. Not required for deployment. | Optional | ❌ |
| shared/	Holds helper code shared across the Function App project | X | ❌ |
| additional_functions/ | Used for modular code organization—typically with blueprints. | X |❌ |
| tests/ | Unit tests for your function app. Not published to Azure. | No, but do not put into Azure | ❌ |
| Dockerfile | Defines a custom container for deployment. | X | ❌ |

## Architecture

### Azurite
1. The Azure Functions runtime requires a storage account connection (configured through the AzureWebJobsStorage setting) .
2. Use Azurite emulator for `local.settings.json`
```json
{
    "IsEncrypted": false,
    "Values": {
        "AzureWebJobsStorage": "UseDevelopmentStorage=true", //Only for emulator
        "FUNCTIONS_WORKER_RUNTIME": "python"
    }
}
```
3. When you deploy a function app to Azure, the platform creates or requires a linked storage account automatically. The `UseDevelopmentStorage=true` setting applies only to local development and has no effect in the cloud.
4. Run with `docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite`

### Limit
1. 230 seconds (2 minute). So create a service bus.

## KeyVault/Configuration
1. Use 
    -`@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/AiServiceKey/)` 
    - `@Microsoft.KeyVault(VaultName=myvault;SecretName=AiServiceKey)`
2. Auto resolves with 24-hours. How should i resolve sentinal keys.
3. How to do version pinning for secrets.
4. What is the method for authentication? Same as all other KeyVault access. I.e. enable System Managed Identity and grant permission to Secret for the roles it needs. Or UAMI with the right Group and authenticate via service principal.
5. How to enable it locally? It mentions local.settings.json, but how?

## Identity via Storage Blob
1. Azure function requires AzureStorage. For
    - **Code Storage**: In serverless plans like Flex Consumption, your actual deployment packages (your Node.js or C# code) are saved in Azure Blob Storage. When the function wakes up, it pulls the code from here.  
    - **State and Coordination**: If your function scales out to 10 instances, the runtime uses Storage Blob leases to ensure that singleton processes—like a Timer Trigger—only fire exactly once, rather than 10 times.
    - **Internal Queuing**: The runtime relies heavily on hidden Azure Storage Queues to manage execution retries, coordinate scale-out behaviors, and handle the state machine for Durable Functions.
    - **Logging**: It serves as a temporary buffer for execution logs before they are ingested by Application Insights.
2. Two ways:
    -  `AzureWebJobsStorage`(Legacy/Local): connection string with identity-based settings, includes accesskey. Still required if cross Tenant or using Local. Sample `DefaultEndpointsProtocol=https;AccountName=<your_storage_account_name>;AccountKey=<your_account_key>;EndpointSuffix=core.windows.net`.
    -  `AzureWebJobsStorage__accountName = mystorageaccount`: The right way, just assign System Managed Identity/UAMI and set the storage account. 
3. Roles
    - Storage Blob Data Owner
    - Storage Queue Data Contributor - if app uses blob triggers
    - Storage Account Contributor - our app uses blob triggers
4. `"AzureWebJobsSecretStorageType": "Files"`, in local.settings.json is special. It means to not generate authentication key (see Authentication) that are non AuthLevel.ANONYMOUS to be stored in local file and not into blob storage.

## Authentication
1. Split to:
    - Function keys: Scoped to a single function. Each function can have multiple named keys. Include the key in the x-functions-key header or the code query parameter when calling the function.
    - Host keys: Scoped to all functions in the function app. A single host key grants access to every HTTP-triggered function in the app. Use host keys for administrative tools or monitoring agents that need to call multiple functions.
    - System keys: Used by specific extensions to authenticate internal operations. For example, the MCP extension uses the mcp_extension system key to authenticate MCP client connections to the function app. System keys are managed by the runtime and shouldn't be shared broadly.
    - Master key: Provides administrative access and overrides all other key types. The master key also grants access to the runtime REST APIs. Treat the master key as a highly sensitive credential and never embed it in client applications.
2. Set with:
    ```python
    @app.route(route="classify", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
    def classify_document(req: func.HttpRequest) -> func.HttpResponse:
        # This function requires a function key or host key to invoke
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

### Roles
1. Azure Service Bus Data Receiver on the Service Bus namespace to receive messages
2. Azure WebJobs Storage on the Storage Account to store and retrieve blobs, queues, and tables
3. Azure Key Vault Secret User on the Key Vault

## Tips.
1. How to find in azure learn
    - Search for Azure function, then use "spaces" to find. E.g. maxConcurrencyCall
    - https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-service-bus?tabs=isolated-process%2Cextensionv5&pivots=programming-language-csharp