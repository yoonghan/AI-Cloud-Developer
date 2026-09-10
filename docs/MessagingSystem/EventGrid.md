# Event Grid
1. This is a push model. For `Standard Tier`, allows pull model.
2. Concept different than EventHub is that you need to create a subscriber and specify an endpoint for it.

## Tier
1. **Basic Tier**: 
    - Max 1 day retention.
2. **Standard Tier**: 
    - Configurable retention. Max 7 days, with MQTT up to 1 year.
    - Supports pull model.
    - Full MQTT (Message Queuing Telemetry Transport) protocol support.
    - Support namespace - a dedicated domain name (FQDN) and specific endpoints.

## Event Schema
1. Event Grid has two types of event schemas: 
    - **Event Grid event schema**: 
    ```json
    {
        "id": "/subscriptions/{id}/resourceGroups/{groupName}/providers/Microsoft.EventHub/namespaces/{namespaceName}",
        "topic": "/subscriptions/{id}/resourceGroups/{groupName}/providers/Microsoft.EventHub/namespaces/{namespaceName}",
        "subject": "some/path/here",
        "eventType": "Microsoft.Resources.ResourceWriteSuccess",
        "eventTime": "2020-01-01T01:23:45.6789012Z",
        "data": {
            "status": "Succeeded"
        },
        "dataVersion": "2.0",
        "metadataVersion": "1",
        "resourceId": "/subscriptions/{id}/resourceGroups/{groupName}/providers/Microsoft.EventHub/namespaces/{namespaceName}/eventhubs/{eventhubName}",
        "eventGridVersion": "2.0"
    }
    ```
    - **Cloud event schema**: 
    ```json
    {
        "specversion": "1.0",
        "type": "com.contoso.ai.InferenceCompleted",
        "source": "/services/content-moderation",
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "time": "2025-09-15T14:30:00Z",
        "subject": "/pipelines/moderation/batch-42",
        "datacontenttype": "application/json",
        "data": {
            "modelName": "content-classifier-v3",
            "requestId": "req-78901",
            "resultLocation": "https://storage.blob.core.windows.net/results/batch-42.json",
            "processingDurationMs": 1250,
            "status": "success",
            "itemsProcessed": 150
        }
    }
    ```
2. Difference is:
    - **specversion**: Identifies the CloudEvents specification version. Always set this to "1.0".
    - **type**: Categorizes the event. This field drives event type filtering. Use a reverse-DNS naming convention to avoid collisions across organizations and services.
    - **source**: Identifies the originating system or component. Combine with type to uniquely identify the context in which the event happened.
    - **id**: Provides a unique identifier for this specific event. Subscribers use this field to detect and deduplicate repeated deliveries.
    - **time**: Provides a timestamp indicating when the event originated.
    - **subject**: Identifies the context or subject of the event. This field is often used to filter events based on specific resource paths or logical entities.
    - **datacontenttype**: Specifies the MIME type of the "data" field.
    - data: Contains the actual event payload. It can be a JSON object, string, or binary data, depending on the event type.
3. When create topic use `input-schema` to define schema type:
```
az eventgrid topic create --name ai-events --resource-group ai-platform-rg --location eastus --input-schema cloudeventschemav1_0
```

## Filtering
1. Use `--included-event-types com.contoso.ai.InferenceCompleted`, to filter. See type above.
```bash
az eventgrid event-subscription create \
--name inference-handler-sub \
--source-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.EventGrid/topics/ai-events \
--endpoint https://inference-handler.azurewebsites.net/api/events \
--included-event-types com.contoso.ai.InferenceCompleted
```
2. Advance filtering on attribute with `--advanced-filter data.status StringIn flagged`.
    - Supports filters: StringContains, NumberGreaterThan, StringBeginsWith, BoolEquals, and IsNotNull. 
    - You can define up to 25 filter conditions per subscription. 
    - Multiple conditions use AND logic between conditions and OR logic within each condition's values.

## Retries
1. No retries on 4XX errors.
2. Delivery attempt intervals are exponential; 10,30secs...12/24 hours.
3. Use TTL or max-delivery-attempts, both are OR:
    - Example: `--max-delivery-attempts 5 --event-ttl 30`
    - Which ever condition is met first, Event Grid will stop retrying.
    - Default is 30 delivery.
    - Max TTL is 1440 minutes/24 hours.
4. Need to handle transient:
    - Return appropriate status codes: Return 200-204 for successful processing. Return 503 if your service is temporarily overloaded. Don't return 400 for transient issues because Event Grid won't retry 400 responses.
    - Implement idempotent processing: Keep track of event IDs you've already processed. Event Grid's at-least-once guarantee means your handler might receive the same event more than once.
    - Process quickly or acknowledge early: If your inference operation takes longer than 30 seconds, return 202 (Accepted) immediately and process the event asynchronously. Event Grid interprets a 202 response as successful delivery.
5. In monitor, `Dropped event` means retries failed.

## Deadletter
1. Specify with Blob `-deadletter-endpoint /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{storage-account}/blobServices/default/containers/dead-letters`
2. It specifies with:
    - deadLetterReason: The reason the event was dead-lettered (for example, MaxDeliveryAttemptsExceeded or MaxRetryDurationExceeded)
    - deliveryAttempts: The number of delivery attempts before the event was dead-lettered
    - lastDeliveryOutcome: The result of the last delivery attempt (for example, NotFound, TimedOut, Busy, or Forbidden)
    - publishTime: The UTC time when Event Grid accepted the event
    - lastDeliveryAttemptTime: The UTC time of the last delivery attempt
3. A batch of dead-lettered events with `lastDeliveryOutcome` of NotFound might mean your handler endpoint URL changed. A cluster of TimedOut outcomes might indicate that your inference service is overloaded and needs scaling adjustments.

## Batching
1. All or nothing.
2. Specify with `--max-events-per-batch 100` and `--preferred-batch-size-in-kilobytes 512`.
3. Max 1MB and 5000 events.
    