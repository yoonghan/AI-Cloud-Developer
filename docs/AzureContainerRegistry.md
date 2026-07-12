# Azure Container Registry (ACR)

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

## acr-task.yaml
# version: v1.1.0
# steps:
#   - build: -t {{.Run.Registry}}/inference-api:{{.Run.ID}} .
#   - push:
#     - {{.Run.Registry}}/inference-api:{{.Run.ID}}
#   - cmd: {{.Run.Registry}}/inference-api:{{.Run.ID}} python -m pytest tests/
```

## Versioning
1. Semantic Versioning is a way to version software. `MAJOR.MINOR.PATCH`. 
2. Unique tags for use once. `1.2.0-build456`.
3. Stable tags. `latest`, `stable`. Careful.
4. Lock deployed images by using digests.
5. Lock enabled to prevent **overrides** and accidental **deletions**.
```bash
az acr repository update \
  --name myregistry \
  --image inference-api:v1.2.0 \
  --write-enabled false
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
