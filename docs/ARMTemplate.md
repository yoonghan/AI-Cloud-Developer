# Azure Resource Manager (ARM) Templates

## Copy.
1. In an ARM template, the copy element acts as a loop. It is only name,count,input. It is just for **property** iteration, not for resource iteration. [link](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/copy-elements)
2. Example

```json
{
  "$schema": "https://azure.com",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "allowedIPs": {
      "type": "array",
      "defaultValue": ["20.30.40.50", "60.70.80.90"]
    }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-01-01",
      "name": "mystorageaccount",
      "location": "[resourceGroup().location]",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2",
      "properties": {
        "minimumTlsVersion": "TLS1_2",
        "networkAcls": {
          "defaultAction": "Deny",
          "copy": [
            {
              "name": "ipRules",
              "count": "[length(parameters('allowedIPs'))]",
              "input": {
                "value": "[parameters('allowedIPs')[copyIndex('ipRules')]]",
                "action": "Allow"
              }
            }
          ]
        }
      }
    }
  ]
}
```

turns to

```json
"ipRules": [
  {
    "value": "20.30.40.50",
    "action": "Allow"
  },
  {
    "value": "60.70.80.90",
    "action": "Allow"
  }
]
```