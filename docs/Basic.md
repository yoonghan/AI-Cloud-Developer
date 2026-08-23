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

## Network
1. Application Gateway WAF is for HTTP(S) application-layer protection.

## The Golden Rules for Azure CMK
To immediately eliminate wrong answers on the exam, lock these rules into your mental map:

1. Supported RSA Sizes: For Customer-Managed Keys across Azure PaaS (like Storage, Cosmos DB, and Azure AI Services), Azure strictly supports RSA and RSA-HSM keys of sizes 2048, 3072, and 4096 bits.
2. The 1024-bit Trap: Microsoft considers RSA 1024 insecure. It is never supported for CMK. If you see 1024 in an exam option, eliminate it instantly.
3. Elliptic-Curve (EC) Keys: While EC keys are highly efficient and supported in Key Vault for things like TLS certificates, they are generally not supported for wrapping and unwrapping root data encryption keys (CMK) for most Azure services.
4. Mandatory Vault Features: You cannot use an Azure Key Vault for CMK unless both Soft Delete and Purge Protection are explicitly enabled. This protects the enterprise from accidentally deleting the key and instantly crypto-shredding their own databases.

Question: You have an Azure subscription and plan to deploy a new storage account. You need to configure Customer-Managed Key (CMK) encryption for the account. The solution must meet the following requirements:

Use a customer-managed key stored in an Azure Key Vault.

Use the maximum supported bit length to ensure the highest level of security.

Which type of key and which bit length should you use?

A. An EC key that uses the P-521 curve
B. An RSA key with a size of 1024 bits
C. An RSA key with a size of 2048 bits
D. An RSA key with a size of 4096 bits (Correct)

## Core Azure TLS Rules for Exams
1. Minimum TLS Version: Microsoft enforces TLS 1.2 as the minimum standard baseline across PaaS services (such as App Service, Azure Container Apps, and Storage Accounts). Exam distractors will often suggest TLS 1.0 or 1.1; eliminate them immediately.
2. Secure Transfer Required: For Azure Storage, this setting ensures that HTTP requests are rejected and only HTTPS traffic is permitted. For Azure App Service and Container Apps, the equivalent setting is HTTPS Only.
3. Mutual TLS (mTLS): Standard TLS only verifies the server's identity to the client. When an exam scenario requires the Azure service to cryptographically verify the calling client device without changing application code, you must enable Client Certificates (mTLS) on the App Service, Container App Ingress, or API Management gateway.

Scenario: You are architecting a secure web application hosted on Azure App Service that acts as a proxy to Azure OpenAI. Your Chief Information Security Officer (CISO) mandates the following requirements:

All traffic attempting to use deprecated cryptographic protocols must be rejected at the platform level.

Unencrypted HTTP traffic must be automatically redirected or blocked.

The App Service must verify the calling client's identity using a certificate before the request reaches your application code.

Which three configurations must you enable on the Azure App Service?

A. Set the Minimum Inbound TLS Version to 1.2 (Correct)
B. Set the Minimum Inbound TLS Version to 1.0
C. Enable HTTPS Only (Correct)
D. Configure Azure Key Vault with an RSA 4096-bit key
E. Enable Client Certificates (mTLS) (Correct)