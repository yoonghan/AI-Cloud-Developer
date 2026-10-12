# Azure Container Instance

This is a container instance! It is a simple way to run a container in Azure. 

1. ACI does not support KEDA or native autoscaling. How it works: An ACI is a static, single container instance. If you want 5 instances, you must script a deployment for 5 instances. If you want ACI to "autoscale," you must build an external orchestrator (like an Azure Logic App or Azure Function) that watches a queue and programmatically fires off API calls to Azure to spin up new ACI instances.
2. It's purpose is not to Host Webapp but more of short lived services. See [Containers](https://yoonghan.github.io/AZ-104-Azure-Administrator-Associate/Containers/) section.

## Restrictions
1. You cannot deploy an Azure Container Instance (ACI) to just any subnet. There are strict networking restrictions for ACIs deployed into a Virtual Network. Here is why those restrictions exist and how they apply to each subnet:
    - Given:
        - A subnet - has a Microsoft.Storage service endpoint.
        - B subnet - container1 is deployed to SubnetB.
        - C subnet - No resources are connected to SubnetC.
    - SubnetB (Valid): To deploy an ACI into a VNet, the subnet must be exclusively delegated to the Microsoft.ContainerInstance/containerGroups service. Because SubnetB already contains container1, it is already properly delegated for ACIs, meaning you can safely deploy container5 there.
    - SubnetC (Valid): This subnet is completely empty. You can deploy container5 here because an empty subnet can be freshly delegated to the Container Instance service during the deployment process.
    - SubnetA (Invalid): This subnet has a Microsoft.Storage service endpoint configured. Azure Container Instances do not support subnets that have service endpoints enabled. Therefore, the deployment to SubnetA would be blocked.