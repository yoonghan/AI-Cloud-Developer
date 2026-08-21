# Monitor

Read [link](https://yoonghan.github.io/AZ-104-Azure-Administrator-Associate/Monitoring/).

## Azure Monitor Workbooks
Azure Monitor Workbooks provide a flexible canvas for data analysis and the creation of rich visual reports within the Azure portal. They allow you to combine text, log queries (KQL), metrics, and parameters into interactive, shared reports.

- **Key Features:**
  - **Multi-Source Data Integration:** Pull data from Azure Resource Graph, Log Analytics, Metrics, Application Insights, and more into a single view.
  - **Interactive Visualizations:** Build charts, grids, honeycombs, maps, and flow diagrams that update dynamically based on user interaction or parameters.
  - **Collaborative Sharing:** Workbooks can be saved as Azure resources, shared with team members, and integrated directly into Azure Portal dashboards.
  - **Templates:** Azure provides a wide range of pre-built templates for common services (e.g., AKS, Key Vault, Storage) to start monitoring immediately.

## Azure Monitor metrics alerts
Metrics alerts in Azure Monitor provide a way to get notified when one of your resource metrics crosses a specified threshold. They operate on near real-time metric data and are highly responsive.

- **Key Features:**
  - **Static Thresholds:** Triggered when a metric value exceeds or falls below a fixed value (e.g., CPU Usage > 90%).
  - **Dynamic Thresholds:** Uses machine learning algorithms to learn the historical behavior of the metric and dynamically set thresholds, identifying anomalies (e.g., unusual spikes in traffic).
  - **Stateful Alerts:** Metric alerts are stateful, meaning they notify you when the alert fires and also send a resolution notification once the condition is no longer met.
  - **Action Groups:** When triggered, alerts can execute actions such as sending emails/SMS, calling Webhooks, triggering Azure Functions, Logic Apps, or Automation Runbooks.

## DCR (Data Collection Rules)
Data Collection Rules (DCR) define the ETL (Extract, Transform, Load) pipeline for telemetry data entering Azure Monitor. They specify exactly *what* data to collect, *how* to transform it, and *where* (destination) to send it.

- **Key Features:**
  - **Centralized Management:** Define collection settings once and apply them to multiple resources (e.g., virtual machines using the Azure Monitor Agent).
  - **Data Transformation (KQL-based):** Filter, mask, or enrich incoming data in-flight using a subset of Kusto Query Language (KQL) before it is written to the destination.
  - **Flexible Destinations:** Route data to Log Analytics Workspaces, Azure Monitor Metrics, Event Hubs, or Azure Storage.
  - **Use Cases:** Standardizing log collection across VM fleets, collecting custom log formats, and filtering out noisy events to save ingestion costs.

## Sampling
1. Sampling rate is request per-seconds. Default is 5 seconds.
2. In the Azure Portal, go to your Container App -> Containers -> Edit and deploy -> Environment variables, and add:
- Name: APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE
- Value: 100 (to disable sampling and keep everything) or 50 (to keep 50% of traffic).

## Shared AKS.
1. The best way, unlike ACA or Function is to create an OTEL collector.
2. Use OTEL Collector to authenticate(if required) and send to application insights.
