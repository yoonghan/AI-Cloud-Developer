# Azure Container Registry (ACR)

## SKU Tiers
1. Premium tier allows: 
    - geo-replication
    - private network access
    - Customer Managed Keys
2. Basic and Standard are the same aside from storage factor. see [link](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-skus)

## RBAC + ABAC

| Feature | Standard Azure RBAC (Registry Permissions) | Azure ABAC (Repository Permissions) |
| --- | --- | --- |
| Core Question Answered | "What actions can this identity perform?" (e.g., read, write, delete) | "What specific repository can they perform these actions on?" |
| Scope | Entire registry or broad resource group/subscription | Individual repositories or naming prefixes (via Microsoft Entra conditions) |
| Role Definitions | Legacy roles like AcrPull, AcrPush, AcrDelete (registry-wide) | Fine-grained repository roles: Container |Registry Repository Reader, Writer, Contributor, Catalog Lister |
Authorization Mode | RBAC Registry Permissions (Default) | RBAC Registry + ABAC Repository Permissions (Enabled on registry)
| Use Case | Single-team registries or broad access (e.g., an AKS cluster pulling any image) | Multi-tenant or multi-team shared registries where Team A shouldn't touch Team B's images |


How They Work Together in ACR

1. RBAC is the Foundation: You still assign an Azure role (like Container Registry Repository Reader) to a user, service principal, or managed identity.
2. ABAC is the Filter: You attach a Microsoft Entra role assignment condition to that role. For example, you can write a condition stating: Grant Reader access only if the repository name starts with team-alpha/ (StringStartsWith condition).

## Authentication options
1. System-assigned managed identity for ACR
2. User-assigned managed identity for ACR
3. Admin enabled, using username/password. Please enable `az acr update --name myregistry --admin-enabled true`

## Namespace
1. Support namespace. E.g. `production/myapp`, `staging/myapp`, `test/myapp`.

## Tagging
1. repository:tag. E.g. `myapp:v1`, `myapp:v1.0.2`, `myapp:stable`.
2. repository@digest. E.g. `myapp@sha256:<digest>`.
3. latest is a special tag, always pointing to the latest image.

## Layers
1. Docker image is composed of layers. This architecture is special as if a Node knows a layer is already cached, it does not have to download the layer again. E.g. the base image of `ubuntu:latest` is the same for all architectures.

## Commands
1. `az acr build --registry myregistry --image inference-api:v1.0.0` .
2. Supports:
    - Build context from GitHub
    - Multi-step build
    - Schedule with `--schedule "0 0 * * *"`
    - Webhook
    - Base image trigger - When you update a base image like python:3.11 or a custom PyTorch image in your registry, ACR detects the change and rebuilds all images that specify that base image in their Dockerfile FROM statement. This automation ensures your application images receive security patches and updates from base images without manual intervention.
3. Layer caching: ACR Tasks cache layers between builds. Order Dockerfile instructions to maximize cache hits by placing frequently changing instructions late in the file.
4. Multi-steps is to automate multi-stage builds in Dockerfile:

```bash
az acr task create \
    --registry myregistry \
    --name build-test-push \
    --context https://github.com/myorg/inference-api.git \
    --file acr-task.yaml \
    --git-access-token $PAT

## acr-task.yaml with multi-step
# version: v1.1.0
# steps:
#   - build: -t {{.Run.Registry}}/inference-api:{{.Run.ID}} .
#   - push:
#     - {{.Run.Registry}}/inference-api:{{.Run.ID}}
#   - cmd: {{.Run.Registry}}/inference-api:{{.Run.ID}} python -m pytest tests/
# Or multistep
#   - cmd: docker run -d --name test {{.Run.Registry}}/hello-world:{{.Run.ID}}
#   - cmd: docker stop test
```

## Versioning
1. Semantic Versioning is a way to version software. `MAJOR.MINOR.PATCH`. 
2. Unique tags for use once. `1.2.0-build456`.
3. Stable tags. `latest`, `stable`. Careful.
4. Lock deployed images by using digests. Digest are SHA-256 and immutable.
5. Lock enabled to prevent **overrides** and accidental **deletions**.
```bash
az acr repository update \
    --name myregistry \
    --image inference-api:v1.2.0 \
    --write-enabled false

az acr tag myImage azure.io/hello:v1 //image to where + tag
```

## Purging
1. For retention (after purge), only **premium** is available.
2. ACR purge
```bash
az acr run --registry myregistry \
    --cmd "acr purge --filter 'inference-api:.*' --untagged --ago 30d" \
  /dev/null

#   or

az acr task create \
    --registry myregistry \
    --name cleanup-untagged \
    --cmd "acr purge --filter '.*:.*' --untagged --ago 7d" \
    --schedule "0 0 * * 0" \
    --context /dev/null
```

## Security
1. Enable Microsoft Defender for Containers at the subscription level to automatically trigger vulnerability scans upon image push.
2. Use private endpoint for ACR to prevent public access. Requires premium tier. Pull from private use `properties.vnetImagePullEnabled`, `az resource update --resource-group <group-name> --name <app-name> --resource-type "Microsoft.Web/sites" --set properties.vnetImagePullEnabled [true|false]`. See [link](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?tabs=debian&pivots=container-linux)
3. There is an auto base-image triggers, to auto patch base image.
4. Task runs with system-assigned managed identity by default.
