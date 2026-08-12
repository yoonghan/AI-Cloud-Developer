# Azure Application Configuration

## Grouping
1. Key: A case-sensitive unicode string that identifies the setting. Keys support hierarchical naming through delimiters such as : or /, which lets you organize related settings under logical groupings. 
2. Value
3. Label
4. Content-Type
5. Tags

## Selector
1. Enable label and select only certain values.
```python
selects = [ 
    //this is null label, means selecting keys without any label
    SettingSelector(key_filter="Pipeline:*", label_filter="\0")
    //overrides null, if order is flipped, production get overridden 
    SettingSelector(key_filter="Pipeline:*", label_filter="Production")
]
```
2. Refresh
```python
config = load(
    endpoint=endpoint,
    credential=DefaultAzureCredential(),
    refresh_on=[WatchKey("Sentinel")],
    refresh_interval=60
)

# Later in your application loop or request handler
config.refresh()

```
3. Trim prefix
```python
config = load(
    endpoint=endpoint,
    credential=DefaultAzureCredential(),
    trim_prefixes=["DocPipeline:"]
)
# Access "DocPipeline:OpenAI:Endpoint" as "OpenAI:Endpoint"
model_endpoint = config["OpenAI:Endpoint"]
```

## Feature flag
Code:
```python
from azure.appconfiguration.provider import load
from azure.identity import DefaultAzureCredential
from featuremanagement import FeatureManager

config = load(
    endpoint=endpoint,
    credential=DefaultAzureCredential(),
    feature_flags_enabled=True
    #feature_flag_refresh_enabled=True,
    #refresh_on=[WatchKey("Sentinel")],
    #refresh_interval=30
)

feature_manager = FeatureManager(config)

# In your application loop or request handler
# config.refresh()

if feature_manager.is_enabled("UseNewEmbeddingsModel"):
    # Route to the new embeddings model
    process_with_new_model(document)
else:
    # Use the current embeddings model
    process_with_current_model(document)
```

## Key Vault
1. Requires the secret URI
2. Requires the Data-plane for 
    - Key Vault Secret User
    - Key Vault Reader
3. Best to implement `secret_refresh_interval`
```bash
az appconfig kv set-keyvault \
    --name myAppConfigStore \
    --key "OpenAI:ApiKey" \
    --secret-identifier "https://my-keyvault.vault.azure.net/secrets/openai-api-key" \
    --label "Production"
```
```python
# Code fragment - focus on configuring independent secret refresh
config = load(
    endpoint=endpoint,
    credential=credential,
    keyvault_credential=credential,
    refresh_on=[WatchKey("Sentinel")],
    refresh_interval=60,
    secret_refresh_interval=7200  # Re-resolve Key Vault secrets every 2 hours
)
```

## Differences with KeyVault
1. No Auditing, keyvault audit changes and updates
2. RBAC control not on secret value. Can't control who can access the secret.
3. No limit on key/secret/certificate version.
4. Key Vault is fully encrypted with HSM. App Config is encrypted at rest.
5. Good features
    - Feature toggle
    - Labels - can use for multi-environment management. 