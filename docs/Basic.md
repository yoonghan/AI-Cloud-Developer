# Basic

## Enable

```bash
az extension add --name containerapp # Container Apps
az provider register --namespace Microsoft.App # Container Apps
az provider register --namespace Microsoft.OperationalInsights # Log Analytics
az provider register --namespace Microsoft.ContainerRegistry # ACR
```

## Authentication
1. The authentication chain follows this order:

- EnvironmentCredential: Reads AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET environment variables for service principal authentication.
- WorkloadIdentityCredential: Authenticates using Kubernetes workload identity tokens.
- ManagedIdentityCredential: Uses the Azure managed identity (system-assigned or user-assigned) attached to the compute resource.
- AzureCliCredential: Authenticates using the account from az login.
- AzureDeveloperCliCredential: Authenticates using the account from azd auth login.
- AzurePowerShellCredential: Authenticates using the account from Connect-AzAccount.

## Sovereign Cloud
To authenticate with a resource in a Sovereign Cloud, you will need to set the audience in the AppConfigurationClient constructor options.

```javascript
import { AppConfigurationClient, KnownAppConfigAudience } from "@azure/app-configuration";
import { DefaultAzureCredential } from "@azure/identity";

// The endpoint for your App Configuration resource
const endpoint = "https://example.azconfig.azure.cn";
// Create an AppConfigurationClient that will authenticate through AAD in the China cloud
const client = new AppConfigurationClient(endpoint, new DefaultAzureCredential(), {
  audience: KnownAppConfigAudience.AzureChina,
});
```

## Python codes

Concept | Python Representation | Purpose
--- | --- | ---
Null Object | None | Represents missing, empty, or unassigned data.Null Character | '\0' | A specific character byte with the numeric value of 0.Empty String | "" | A string object containing zero characters.