# Deployment Stack

// main.bicep
targetScope = 'resourceGroup'

param location string = resourceGroup().location
param appName string = 'order-api'

// 1. Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: 'myregistry${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// 2. Container Apps Environment
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${appName}-env'
  location: location
}

// 3. Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
      }
    }
    template: {
      containers: [
        {
          image: 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'
          name: 'hellocontainer'
          resources: {
            cpu: '0.5'
            memory: '1.0Gi'
          }
        }
      ]
    }
  }
}

1. Instead of running a standard az deployment group create, you use the Deployment Stacks CLI extension (az stack group). You specify what should happen to resources if they are detached or deleted from the stack (known as action-on-unmanage):
```bash
# Create or update a deployment stack at the resource group level
az stack group create \
  --name "ecommerce-stack" \
  --resource-group "rg-ecommerce" \
  --template-file "main.bicep" \
  --action-on-unmanage deleteResources \
  --deny-settings-mode none \
  --yes
```