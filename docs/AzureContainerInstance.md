# Azure Container Instance

This is a container instance! It is a simple way to run a container in Azure. 
1. ACI does not support KEDA or native autoscaling. How it works: An ACI is a static, single container instance. If you want 5 instances, you must script a deployment for 5 instances. If you want ACI to "autoscale," you must build an external orchestrator (like an Azure Logic App or Azure Function) that watches a queue and programmatically fires off API calls to Azure to spin up new ACI instances.