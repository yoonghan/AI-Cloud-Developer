# Azure Application Configuration
1. Tier
    - Free, 1k per day
    - Basic, 6k per hour, has revision of 7 days
    - Standard, has revision of 30days
    - Premium, has revision of 30days and has geo-replication
2. Possible to import/export too

| Feature | Developer | Standard | Premium | 
| --- | --- | --- | ---| 
| SLA (Service Level Agreement) | None (Best effort) | 99.9% | 99.99% |
| Hourly Request Quota | 6,000 / hour | 30,000 / hour | Unlimited |
| Guaranteed Throughput | None (Shared pool) | 300 read / 60 write RPS | 450 read / 100 write RPS |
| Geo-Replication | No | No | Yes (1 replica included) |
| Revision History | 7 Days | 30 Days | 30 Days |
| Storage Capacity | 500 MB | 1 GB | 4 GB |

## Grouping
1. Key: A case-sensitive unicode string that identifies the setting. Keys support hierarchical naming through delimiters such as : or /, which lets you organize related settings under logical groupings. 
2. Value
3. Label - Cannot be edited once created
4. Content-Type
5. Tags - useful only for Azure search, also useful for snapshot
6. NOTE: Label & Key cannot be edited after creation. Both has to be unique.

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
 - create a dedicated key
 - in most program you don't need to enable selector to exclude Watch key.
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

## Revision
1. Only basic (7days) and higher (30days) have a revision.
2. Works like keyvault

## Snapshot
1. Two ways to restore it.
    - Import
    - Refer via code to the snapshot
2. Snapshot cannot be deleted, can only be archived.
3. Can add filter of which key to include in snapshot. But cannot exclude.
4. Snapshot has a limit of only 1MB!
5. Free & Basic - 7 days, Standard and above are 90days.
```javascript
this.settings = await load(endpoint, new DefaultAzureCredential(), {
            selectors: [
                // Instead of { keyFilter: "openai*", labelFilter: undefined }
                { snapshotName: "Release_v1" } 
            ]
        });
```

```bash
az appconfig kv import \
  --name <your-app-config-name> \
  --source appconfig \
  --src-name <your-app-config-name> \
  --src-snapshot <your-snapshot-name> \
  --yes
```

## Lock
1. You can lock with. NOTE if using command `--yes` mean force.
```
az appconfig kv lock \
  --name walcronconfig \
  --key openai:domain \
  --yes
```

## Feature flag
1. Can be a type of
    - Switch - On/Off
    - Rollout - It uses "Targeting Filters." You define rules like: "Turn this on for the Beta Testers group, specific user han@example.com, and a random 20% of all other traffic."
    - Experiment - It uses "Variant Feature Flags", instead of just toggling a feature, you define variants (e.g., Variant A: {"buttonColor": "blue", "size": "large"}, Variant B: {"buttonColor": "red", "size": "small"}). You then allocate traffic percentages to each variant.
2. Can enable telemetry.
3. Key must start with "appconfig.featureflag/"
4. For rollout, the complexity is that you need to provide user's context into FeatureManager.
5. Code:
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

![App Configuration Features](img/app-configuration-features.png)

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