# Azure Kubernetes Service

1. Use AKS for Kubernetes. 

## Service / Virtual Service
1. To expose, use either Service or Virtual Service. Virtual Service allows you to define traffic management rules, such as routing, load balancing, and circuit breaking. Service is a simpler way to expose a service. Virtual Service is built on top of Service and uses Istio under the hood.
2. To map service to pod, use labels.
```
# Code fragment - focus on selector matching
# In your Deployment:
template:
  metadata:
    labels:
      app: inference-api     # Pods get this label

# In your Service:
selector:
  app: inference-api         # Service routes to Pods with this label
```
3. Get with `kubectl get svc public-webapp-svc`

Service Type | Exposed to Internet? | How it works in AKS | Best Used For
--- | --- | --- | ---
ClusterIP | ❌ | No | Internal-only IP address. | Backend databases, internal APIs, microservices
LoadBalancer | ✅  | Yes | AKS provisions an official Azure Public IP and Azure Load Balancer  |  Exposing a single service directly to the public web.
NodePort | ⚠️ | Port Only | Opens a specific high port (30000–32767) on all cluster VMs. | Testing or legacy setups. Rarely used in cloud production.
ExternalName | ❌ | No | Maps a local Kubernetes service name to an external DNS record. | Pointing cluster apps to an external service (e.g., Azure SQL).

## Expose Services
1. Methods to expose the service to the internet:
    - Use LoadBalancer to expose the service to the internet. Get public IP with `kubectl get svc public-webapp-svc`.
    - Use Ingress to expose the service to the internet. It is more powerful than LoadBalancer.
2. Use port-forward for debugging from local to cluster pod.
```
# Code fragment - focus on port-forwarding
kubectl port-forward <resource-type>/<resource-name> [local-port]:<remote-port> [-n <namespace>]
```

## Config Map 
1. Link [here](https://learn.microsoft.com/en-us/training/modules/configure-apps-azure-kubernetes-service/2-define-configmaps?pivots=text)
2. ConfigMap: A ConfigMap is an API object used to store non-confidential data in key-value pairs. It allows you to decouple configuration from your application code, making it easier to manage and update configurations without rebuilding your application image.
3. Secret: A Secret is an API object used to store sensitive data in key-value pairs. To allow integration with Azure Key Vault, you need to enable `--enable-addons azure-keyvault-secrets-provider`. See [link](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver?pivots=azure-cli-create).
4. Maximum size for a ConfigMap is 1 MiB.
5. Maximum size for a Secret is 1 MiB.
6. Use _valueFrom_ or _envFrom_ to inject ConfigMap into container.

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-api
  template:
    metadata:
      labels:
        app: web-api
    spec:
      containers:
      - name: api
        image: myregistry.azurecr.io/web-api:v1
        env:
        - name: FEATURE_X_ENABLED
          valueFrom:
            configMapKeyRef: # which configMap to use
              name: app-settings
              key: FEATURE_X_ENABLED
        # Alternative: load all keys as environment variables
        # envFrom: # load all key-value pairs in app-settings as environment variables
        # - configMapRef:
        #     name: app-settings
```
7. For larger configuration files or binary data, use persistent volumes or external configuration services. 
```
# Code fragment - focus on volume mount
volumes:
- name: config-volume
  configMap:
    name: app-settings
    # Optional: select specific keys to mount as files
    # items:
    # - key: app.config
    #   path: application.conf
containers:
- name: api
  volumeMounts:
  - name: config-volume
    mountPath: /app/config
    readOnly: true
```

## Storage
1. Link [here](https://learn.microsoft.com/en-us/training/modules/store-data-azure-kubernetes-service/2-define-storage?pivots=text)
2. Volume to choose:
    - CSI
    - Azure Container Storage - Requires to be enabled `az aks update -n myAKSCluster -g myResourceGroup --enable-azure-container-storage ephemeralDisk`, then in YAML specify `storagePools` in `storageClass`.
3. Choose Azure Container Storage for data-heavy AI workloads (like vector databases) because it pools underlying hardware—like lightning-fast local NVMe drives—into a unified, software-defined layer. It also bypasses standard Azure Disk attach/detach bottlenecks, enabling much faster pod failovers and volume scaling across your cluster.

## Troubleshooting
1. Inspect Services using kubectl
You can use kubectl commands to examine Services in detail:

Bash
kubectl get service -n ai-workloads
kubectl describe service <service-name> -n ai-workloads
kubectl get endpointslices -l kubernetes.io/service-name=<service-name> -n ai-workloads
In the Service definition, you check:

Selector labels that should match pod labels
Ports and targetPorts that should align with container ports
EndpointSlices that list the actual pod IPs that receive traffic
If a Service has no EndpointSlices, your AI API can't receive traffic even if pods are healthy. Resolving label mismatches or port configuration restores connectivity.