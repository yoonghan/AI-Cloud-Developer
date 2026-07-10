# Azure Container Apps (ACA)

## Container App Environment
1. Base infrastructure for Container Apps. It is a logical isolation boundary.
2. Can be shared by multiple container apps. Creating container apps requires at least one environment.
3. Container apps in the same environment share:
    - virtual network
    - networking rules
    - monitoring
    - log rules
4. Cannot change environment configuration after creation.

## Ingress
1. external - internet/outbound traffic enabled.
2. internal - no out bound traffic to external.
3. Code

```bash
az containerapp update \
    --name myapp \
    --resource-group myresourcegroup \
    --ingress external \
    --target-port 8080 \
    --registry-server myregistry.azurecr.io
```

## Registry authentication
1. Similar to Azure App Service, ACA uses managed identity or service principal for registry authentication.

## Revisions
1. Change in condition of:
    - container image
    - environment variables
    - secrets
    - resource allocation
    - scale rules
    - init containers

## Environment Variables
1. Two types
    - manual
    - secretref - reference to a secret
2. Secrets are encrypted and stored separately from the environment, hence secretref:X.
3. Can be defined in YAML `az containerapp update/create --yaml`

```json
{
  "properties": {
    "configuration": {
      "secrets": [
        {
          "name": "db-password-ref",
          "keyVaultUrl": "https://<VAULT_NAME>.vault.azure.net/secrets/<SECRET_NAME>",
          "identity": "<MANAGED_IDENTITY_RESOURCE_ID_OR_system>"
        }
      ]
    },
    "template": {
      "containers": [
        {
          "name": "my-app",
          "env": [
            {
              "name": "DATABASE_PASSWORD",
              "secretRef": "db-password-ref"
            }
          ]
        }
      ]
    }
  }
}
```

![Environment Variables](img/aca-env-variables.png)

## Health Probes
1. Liveness Probe - determines if the container is running.
2. Readiness Probe - determines if the container is ready to receive traffic.
3. Default is TCP, means it will check the connection to the specified port, not via httpGET.