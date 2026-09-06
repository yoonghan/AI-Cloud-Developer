# Service Bus

## Anatomy
1. **Message Structure**:
    - **Body**: Message payload (bytes, JSON, text, etc.).
    - **Application Properties**: Custom key-value metadata defined by the application, used for routing, filtering, and tracking.
    - **System Properties**: System-defined metadata managed by Service Bus (e.g., `message_id`, `correlation_id`, `content_type`, `time_to_live`, `session_id`, `sequence_number`, `partition_key`, `to`, `reply_to`, `subject`).
2. **Distributed Tracing**:
    - Take note of `traceparent` (W3C Trace Context spec). It is passed in `application_properties` for distributed tracing across services:
```python
message = ServiceBusMessage(
    body=json.dumps(request_payload),
    content_type="application/json",
    message_id=str(uuid.uuid4()),
    correlation_id="req-abc-12345",
    application_properties={
        "traceparent": f"00-{format(span_context.trace_id, '032x')}-{format(span_context.span_id, '016x')}-01",
        "model_name": "gpt-4o",
        "priority": "standard",
        "document_type": "contract"
    }
)
```

## Tiers
- **Basic**:
    - Ideal for low-throughput applications, dev/test scenarios.
    - Supports **Queues only** (no Topics/Subscriptions, no Sessions, no Transactions, no Duplicate Detection).
    - Maximum message size: **256 KB**.
- **Standard**:
    - Shared multi-tenant capacity billed per operation.
    - Supports Topics, Subscriptions, Sessions, Transactions, Scheduled messages, Auto-forwarding, and Duplicate detection.
    - Queue/Topic max storage capacity: 1 GB to 80 GB (with partitioning).
    - Maximum message size: **256 KB**.
- **Premium**:
    - High-throughput, enterprise mission-critical applications.
    - Dedicated resources (Messaging Units) with predictable latency and isolation.
    - Queue/Topic max storage capacity: up to **1 TB**.
    - Maximum message size: up to **100 MB** (default 1 MB, configurable up to 100 MB).
- Reference: [Service Bus Premium Messaging](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-premium-messaging)

## Express Entities
1. Express entities hold messages in memory temporarily before writing them to persistent storage for lower latency.
2. Supported in **Basic and Standard** tiers.
3. **Not supported in Premium tier**. Express messaging must be disabled on entities prior to migrating/upgrading a namespace from Standard to Premium.

## Premium Features
1. **Core Capabilities**:
    - Dedicated Messaging Units (MUs) with resource isolation (predictable throughput/latency).
    - Dynamic scaling: 1, 2, 4, 8, or 16 MUs (scalable up/down).
    - Large messages: Up to 100 MB payload size.
    - Network security: Virtual Network (VNet) integration, IP Firewall, and Private Endpoints (Private Link).
    - Geo-Disaster Recovery (active-passive metadata pairing across regions).
    - Java Message Service (JMS) 2.0 API support.
2. **Messaging Units (MUs)**:
    - Dedicated CPU and memory allocation per unit.
    - Billing is based hourly on allocated Messaging Units rather than operation counts.

## Comparison with Event Grid and Event Hubs
- **Azure Event Grid**: Event-driven reactive routing (discrete notifications).
- **Azure Event Hubs**: Big data streaming ingestion engine (time-ordered event log with Apache Kafka compatibility).
- **Azure Service Bus**: Enterprise transactional messaging (Queues and Topics for workflows and high-value payloads).

| Criterion               | Event Grid                           | Event Hubs                        | Service Bus                     |
| ----------------------- | ------------------------------------ | --------------------------------- | ------------------------------- |
| Primary Purpose         | Reactive event routing               | Big data streaming and ingestion  | Enterprise transactional messaging |
| Data Model              | Events (discrete notifications)      | Event streams (time-ordered series) | Messages (high-value payloads)  |
| Delivery Guarantee      | At least once                        | At least once                     | At least once (optional ordered, exactly once with sessions + deduplication) |
| When to Use             | React to status changes, serverless architectures | Telemetry, distributed data streaming, real-time analytics | Order processing, financial transactions, workflows |

## Filtering & Rules (Subscriptions)
Rules evaluate messages published to a topic and route matching messages to the specific subscription.

> [!IMPORTANT]
> **Default `$Default` Rule**: Every new subscription is automatically created with a rule named `$Default` using a `TrueRuleFilter` (matches all messages). When adding custom rules, you must **remove the `$Default` rule** if you want the subscription to receive *only* filtered messages!

1. **SQL Filter**:
```csharp
await adminClient.CreateRuleAsync(topicName, subscriptionName, new CreateRuleOptions 
{ 
    Name = "RedOrdersWithAction",
    Filter = new SqlRuleFilter("user.color = 'red'"),
    Action = new SqlRuleAction("SET user.quantity = user.quantity / 2;")
});
```
2. **Boolean Filter**:
```csharp
await adminClient.CreateSubscriptionAsync(
    new CreateSubscriptionOptions(topicName, subscriptionAllOrders), 
    new CreateRuleOptions("AllOrders", new TrueRuleFilter())); // Matches all messages
```
3. **Correlation Filter**:
```csharp
// Match messages with Subject = "red" and CorrelationId = "high"
await adminClient.CreateSubscriptionAsync(
    new CreateSubscriptionOptions(topicName, "HighPriorityRedOrders"), 
    new CreateRuleOptions("HighPriorityRedOrdersRule", new CorrelationRuleFilter() { Subject = "red", CorrelationId = "high" }));
```

## Message Sessions (Message Grouping & Ordering)
1. **FIFO Guarantee**: Used to group related messages for strict First-In-First-Out (FIFO) sequential processing by a single consumer.
2. **Mechanism**: When messages share a `SessionId` (e.g., `SessionId = 'Invoice-123'`), Service Bus locks that session to a single receiver. No other receiver can process messages from that session until the lock is released or expires.
3. **Session State**: Receivers can store state data specific to a session (`GetSessionState` / `SetSessionState`), enabling stateful workflow execution.
4. **Requirement**: `RequiresSession` must be enabled at **queue or subscription creation time** (cannot be enabled retroactively).

## Deduplication (Duplicate Detection)
1. **MessageId**: Deduplication relies on tracking unique `MessageId` values within a defined time window.
2. **Creation Constraint**: Must be enabled (**`RequiresDuplicateDetection = true`**) **only during entity creation**.
3. **Deduplication Window**: Configurable duration (default is 10 minutes, selectable between 20 seconds and 7 days).
4. **Behavior on Duplicate**: If a message with an already-seen `MessageId` arrives within the window, Service Bus **accepts the send call (returns success to producer) but drops/ignores the duplicate payload**. It does *not* enqueue or process the duplicate, nor does it delete existing messages.
5. **Trade-off**: Increases processing overhead on Service Bus. If a producer bug reuses the same `MessageId` for distinct payloads, only the first payload will be delivered and subsequent ones will be dropped.

## Patterns
1. **Claim-Check Pattern**: For large payloads exceeding tier limits, upload the payload to Azure Blob Storage and send only the blob SAS URI / reference metadata in the Service Bus message.
2. **Time-to-Live (TTL)**: Expiration timer set on messages or entities. Expired messages are either deleted or automatically moved to the DLQ (`EnableDeadLetteringOnMessageExpiration = true`).
3. **Batching**: Grouping multiple messages into a single network send call (`ServiceBusMessageBatch`) to reduce network round-trip overhead.

### Batch Messaging Behavior
- Maximum batch size is bounded by the **maximum payload size limit of the tier** (256 KB for Standard, 1 MB / up to 100 MB for Premium).
- SDK method `add_message()` / `try_add_message()` returns `false` or raises an exception when adding a message would exceed the total batch size limit.

## Reliability & Settling Messages
1. **Receive & Delete (`ReceiveAndDelete`)**:
    - Message is deleted from Service Bus immediately upon receipt.
    - Higher performance, but risks message loss if consumer crashes during processing (at-most-once delivery).
2. **Peek-Lock (`PeekLock`)**:
    - Message is locked for processing for a specified duration (default 60s, max 5 minutes). The consumer must explicitly settle the message (at-least-once delivery):
    - **Complete**: Acknowledges successful processing and permanently removes the message from the queue.
    - **Abandon**: Releases the lock immediately, placing the message back on the queue for another consumer to pick up.
    - **Dead-Letter**: Moves the message to the Dead-Letter sub-queue along with `dead_letter_reason` and `dead_letter_error_description`.
    - **Defer**: Leaves the message in the main queue but skips it during normal receives. The message can later be retrieved explicitly by its `sequence_number` using `receive_deferred_messages()`. Useful when processing dependencies are not yet met.
3. **Poison Messages (`max_delivery_count`)**:
    - Tracks delivery attempts. If a message is received and abandoned/timed out more than `max_delivery_count` times (default 10), Service Bus automatically transfers it to the DLQ.
4. **Auto-Forwarding**:
    - Automatically forwards messages from a queue/subscription to another target queue or topic within the **same namespace**.
5. **Auto-Lock Renewal**:
    - Client-side background task (`AutoLockRenewer`) that automatically extends the lock duration while long-running processing is active, up to a configured maximum duration limit.

```python
with ServiceBusClient(
    fully_qualified_namespace="<namespace>.servicebus.windows.net",
    credential=credential
) as client:
    renewer = AutoLockRenewer()
    with client.get_queue_receiver(
        queue_name="inference-requests",
        max_wait_time=30
    ) as receiver:
        for msg in receiver.receive_messages():
            # Renew the lock for up to 10 minutes
            renewer.register(receiver, msg, max_lock_renewal_duration=600)
            result = run_long_inference(msg)
            receiver.complete_message(msg)
    renewer.close()
```

### Auto-Forwarding vs Deferral
1. **Auto-Forwarding (Routing)**: Entity-level setting. Seamlessly routes messages or dead-lettered messages (`ForwardDeadLetteredMessagesTo`) from a queue/subscription to another target entity in the same namespace (e.g., consolidating dead-letter messages from multiple topics into a single central queue).
2. **Message Deferral (Pausing)**: Consumer-driven action. Leaves the message in place while allowing other messages to be processed, holding the deferred message for later explicit retrieval by its `sequence_number`.

### Dead-Letter Queues (DLQ)
1. **Built-in Sub-queue**: Every queue and topic subscription automatically has a built-in Dead-Letter sub-queue (`$DeadLetterQueue`). It is **not** a separate top-level queue.
2. **Address Path**:
    - Queue DLQ: `<queue-name>/$DeadLetterQueue`
    - Subscription DLQ: `<topic-name>/Subscriptions/<subscription-name>/$DeadLetterQueue`
3. **Isolation in Topics**: Subscriptions operate independently. If Subscription B fails processing and dead-letters a message, it moves to Subscription B's DLQ only. Other subscriptions remain completely unaffected.
4. **System Reservation**: You **cannot** manually create a queue or topic named `$DeadLetterQueue`. The `$DeadLetterQueue` path is a reserved system sub-entity path managed automatically by Azure Service Bus.