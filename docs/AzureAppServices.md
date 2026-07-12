# Azure App services

## Plan
App Service plans determine the location, scale, and features available for the web app.

## Configuration 

1. See [environment variables](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings).
2. **health** endpoint are configured in App Service Configuration -> Health Check. It can be /health or /healthz or custom.
3. WEBSITES_ENABLE_APP_SERVICE_STORAGE = true, set to persisted data. Default to false, and useful for persisting data in the container (not recommended, use Azure Storage instead).
4. **always_on**, means does not scale to 0. Take note: App services scales to 0 after 15mins of unused time if always_on is not set.
5. WEBSITES_PORT = 80, App services use dynamic port, make sure you set this value.
6. Start up with 
```bash
az webapp config set \
    --resource-group myResourceGroup \
    --name myDocumentProcessor \
    --startup-file "/bin/bash -c 'python migrate.py && gunicorn app:application'"
```
7. Can use file `--settings @settings.json` instead of `--startup-file` for multiple configurations.
8. Using keyvault.
    - Keyvault reference identity must be set to System-assigned managed identity for App service's Service Principal.
    - Enable with `az webapp update --resource-group <group-name> --name <app-name> --set keyVaultReferenceIdentity=$(az identity show --resource-group <group-name> --name <identity-name> --query id -o tsv)`
    - Set keyvault with `--settings API_KEY="@Microsoft.KeyVault(SecretUri=https://myvault.vault.azure.net/secrets/api-key)"`.
    - Auto update secret change check interval is 24 hours due to cache. [link](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)

## Deployment Slots

1. Enable promote and also change for "API_ENDPOINT".
```bash
az webapp config appsettings set \
    --resource-group myResourceGroup \
    --name myDocumentProcessor \
    --slot staging \
    --slot-settings \
        ENVIRONMENT=staging \
        API_ENDPOINT=https://api-staging.example.com
```

## Kudu
Kudu is a service for deploying and managing web applications.

![Kudu](img/kudu.png)

## Troubleshooting
1. Logs

| Category | Description
| --- | --- |
| AppServiceConsoleLogs | Container stdout and stderr output |
| AppServiceHTTPLogs | HTTP request and response information |
| AppServicePlatformLogs | Container lifecycle events and platform messages |
| AppServiceAppLogs | Application-level logs (when configured) |

2. SSH, but image must have SSH support, `RUN apt-get update && apt-get install -y openssh-server`