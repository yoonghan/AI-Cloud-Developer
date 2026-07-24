# Azure Kubernetes Service

1. Use AKS for Kubernetes. 

## Authentication to talk with other resources.
1. Need to use UAMI (User Access Management Identity) for authentication with Azure resources. In this case you need to:
  - Create a UAMI in Azure Portal. Note its Client ID and Resource ID.
  - Example UAMI command:
  ```
  az identity create --name my-uami --resource-group my-resource-group --location my-location
  UAMI_CLIENT_ID=$(az identity show --name $UAMI_NAME --resource-group $RESOURCE_GROUP --query 'clientId' -o tsv)
  UAMI_PRINCIPAL_ID=$(az identity show --name $UAMI_NAME --resource-group $RESOURCE_GROUP --query 'principalId' -o tsv)

  ```
  - Not required to assign role to UAMI.
  - Then create a Service Account in the AKS cluster, using the UAMI's Client ID and Resource ID.
  - Example of Service Account:
  ```
  apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    azure.workload.identity/client-id: <UAMI_CLIENT_ID>
  name: azure-workload-identity
  namespace: default
```
  - Enable workload identity in AKS:
  ```
  az aks update \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --enable-workload-identity \
  --attach-acr <acr-name>

  - Link the UAMI to the Service Account in AKS:
  ```
  AKS_OIDC_ISSUER=$(az aks show --resource-group <resource-group> --name <cluster-name> --query "oidcIssuerProfile.issuerUrl" -o tsv)

az identity federated-credential create \
  --name <federated-identity-name> \
  --identity-name <workload-identity-name> \
  --resource-group <resource-group> \
  --issuer "$AKS_OIDC_ISSUER" \
  --subject "system:serviceaccount:<namespace>:<service-account-name>" \
  --audiences "api://AzureADTokenExchange"
  ```
  - Each resources that needs to be accessed by the pod needs to be assigned to the UAMI in Azure Portal. I.e assigne the role to UAMI's UAMI_PRINCIPAL_ID.
  - Federated Identity is required! A ServiceAccount (SA) is a Kubernetes concept (it only exists inside your cluster). A UAMI is an Azure concept (it exists in Entra ID / Azure AD). By default, Azure has absolutely no idea what a Kubernetes ServiceAccount is. The Federated Credential is the literal "bridge of trust" between these two entirely different systems. "Hey Azure, if you ever receive a token request that is cryptographically signed by my specific AKS cluster ($AKS_OIDC_ISSUER), AND the subject asking for it is exactly system:serviceaccount:walcron-app:walcron-sa, I want you to trust that request and let them act as my UAMI."
  
2. System-assigned managed identity does not work as it does not have Client ID.
3. Need to use workload identity for authentication with Azure resources.
4. Service Principal (Client ID + Client Secret) do work, but is not recommended, it can be exposed.
5. For repository, it needs to be specified in Kubernetes.
```
kubectl create secret docker-registry ghcr-secret \
  --namespace $NAMESPACE \
  --docker-server=ghcr.io \
  --docker-username=$GHCR_USERNAME \
  --docker-password=$GHCR_PASSWORD \
  --docker-email="noreply@example.com" \
  --dry-run=client -o yaml | kubectl apply -f -
```

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

## Thoughts
Sure! The way Kubernetes handles network traffic can be a bit confusing at first because it uses a layered approach.

Here is the breakdown of Service vs Ingress vs VirtualService, and why the plan uses an Ingress.

1. Kubernetes Service (Layer 4)
A Service is a core Kubernetes concept used to group your pods together under a single IP address.

ClusterIP (Internal): By default, a Service is internal. It allows App A to talk to App B inside the cluster. (This is what is defined in the service-ingress.yaml artifact).
LoadBalancer (External): You can expose your app directly to the internet by changing the Service type to LoadBalancer. When you do this, AKS talks to Azure to automatically provision a public Azure Standard Load Balancer.
The Catch: A Load Balancer operates at Layer 4 (TCP/UDP). It does not understand HTTP. It cannot do URL-based routing (e.g., send /api to one pod and /web to another), it cannot easily handle CORS, and it cannot terminate SSL/HTTPS certificates effectively. Also, if you have 10 apps, you will pay for 10 Public IP addresses.
2. Kubernetes Ingress (Layer 7) - The Recommended Approach
An Ingress solves the limitations of the LoadBalancer. It is a "smart router" for HTTP/HTTPS traffic.

In the script, we installed the NGINX Ingress Controller. This controller creates one Azure Load Balancer with one Public IP.
The Ingress YAML you deploy acts as the configuration rulebook for NGINX.
Why we use it: It operates at Layer 7. It understands hostnames (www.walcron.com), URL paths, and can terminate SSL certificates. Most importantly for your app, we can use Ingress annotations (like nginx.ingress.kubernetes.io/enable-cors: "true") to perfectly replicate the CORS rules you had set up in your Azure Container App environment!
3. VirtualService (Istio / Service Mesh)
I saw your note in AzureKubernetes.md about VirtualService. It is important to clarify: A VirtualService is not a native Kubernetes object.

It is a custom resource that only exists if you install a Service Mesh called Istio into your cluster.
If you use Istio, you replace the NGINX Ingress Controller with an Istio Gateway, and you replace the Ingress YAML with a VirtualService YAML.
Why use VirtualService? It is incredibly powerful. It allows for advanced traffic management like sending 90% of traffic to v1 of your app and 10% to v2 (Canary deployments), automatic retries, and circuit breakers.
Should you use it? Since you are already using Dapr, I recommend against using Istio right now. Dapr and Istio overlap significantly. Dapr already handles service-to-service mTLS encryption, observability, and retries. Running both Dapr and a Service Mesh like Istio at the same time is extremely complex and usually overkill unless you have a massive enterprise microservice architecture.
Summary
To directly answer your question:

Can you use a Service to expose it? Yes (using type: LoadBalancer), but you lose CORS, SSL termination, and path-based routing. It's too basic for web apps.
Can you use a VirtualService? Yes, but it requires installing Istio, which is very complex and overlaps with your existing Dapr setup.
Why Ingress? It is the sweet spot. It provides the exact Layer 7 HTTP routing, CORS support, and SSL capabilities that your Azure Container App was giving you out of the box, without the overhead of a full Service Mesh.