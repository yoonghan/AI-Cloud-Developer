# Open telemetry

## Span
1. Trace ID: A globally unique identifier shared by all spans in the same trace. This ID links every operation in the request flow together.
2. Span ID: A unique identifier for this specific span within the trace.
3. Parent span ID: The span ID of the parent operation that initiated this span. Root spans don't have a parent.
4. Name: A descriptive label for the operation the span represents.
5. Start and end timestamps: The precise timing of the operation, which determines its duration.
6. Attributes: Key-value pairs that provide additional context about the operation, such as the HTTP method, URL, status code, or custom data like a model name.
7. Status: Indicates whether the operation succeeded or failed.

## Tracing
1. OpenTelemetry uses the W3C TraceContext standard to propagate context through HTTP headers. 
2. _traceparent_ header contains the trace ID and the calling span's ID split by hyphen. (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
    * Version (00): The trace context format version.
    * Trace ID: A 32-character hexadecimal string that uniquely identifies the trace.
    * Parent span ID: A 16-character hexadecimal string identifying the calling span.
    * Trace flags (01): Indicates the trace is sampled.
3. _tracestate_ header contains additional tracing information that can be used by other tracing systems.

## Application Insight
OpenTelemetry concept | Python equivalent | Application Insights term
--- | --- | --- 
Tracer | trace.get_tracer("name") | N/A (instrumentation source)
Span | opentelemetry.trace.Span | Request or Dependency
Server Span | SpanKind.SERVER | Request
Client Span | SpanKind.CLIENT | Dependency
Internal Span | SpanKind.INTERNAL | Dependency
Consumer Span | SpanKind.CONSUMER | Request
Producer Span | SpanKind.PRODUCER | Dependency
Trace ID | span.get_span_context().trace_id | Operation ID
Span ID | span.get_span_context().span_id | ID or Operation Parent ID. Derives from Trace.
Span Attributes | span.set_attribute() | customDimensions. Derives from Span

## Cloud role name
1. Required 'service.name' + 'service.namespace'. Optional 'service.instance.id'
2. Possible also with environment variables:
```bash
export OTEL_SERVICE_NAME="embedding-service"
export OTEL_RESOURCE_ATTRIBUTES="service.namespace=rag-pipeline,service.instance.id=embedding-instance-1"
```

## Span types
- SpanKind.SERVER: Represents an incoming request handled by the service. Application Insights maps these spans to the requests table.
- SpanKind.CLIENT: Represents an outgoing call to an external service or resource. Application Insights maps these spans to the dependencies table.
- SpanKind.INTERNAL: Represents an internal operation within the service that doesn't cross process boundaries. Application Insights maps these spans to the dependencies table. This is the default when no kind is specified.
- SpanKind.PRODUCER: Represents a span that initiates an asynchronous operation, such as sending a message to a queue. Application Insights maps these spans to the dependencies table.
- SpanKind.CONSUMER: Represents a span that processes an asynchronous operation, such as receiving a message from a queue. Application Insights maps these spans to the requests table.
```python
with tracer.start_as_current_span("CallLlmApi", kind=SpanKind.CLIENT) as span: # In python "with" can help capture errors automatically.
    span.set_attribute("llm.provider", "azure-openai")
    span.set_attribute("llm.model", "gpt-4o")
    # LLM API call logic
    response = call_llm(prompt)
    span.set_attribute("llm.response_tokens", response.usage.completion_tokens)
```
- *Active* Span vs Span, both are the same, it's just that *active* span automatically copies parent span's attributes(except span kind). Normal span need to include parentId. So it is more convenient to use in nested calls.
```python
with tracer.start_as_current_span("parent") as parent_span:
    with tracer.start_span("child") as child_span:
        # child_span automatically inherits attributes from parent_span
        pass
```

## Sampling
1. Fixed-percentage sampling: Collects a fixed fraction of all traces. You specify a ratio between 0.0 and 1.0 where 0.1 means approximately 10% of traces are sampled.
2. Rate-limited sampling: Caps the number of traces collected per second. You specify the maximum traces per second, such as 1.5 for approximately one and a half traces per second.
```python
# Code fragment - focus on configuring sampling via configure_azure_monitor()
from azure.monitor.opentelemetry import configure_azure_monitor

# Fixed-percentage sampling: sample approximately 10% of traces
configure_azure_monitor(
    sampling_ratio=0.1,
)

# Rate-limited sampling: sample approximately 1.5 traces per second
# configure_azure_monitor(
#     traces_per_second=1.5,
# )
```
```bash
# Fixed-percentage sampling at approximately 10%
export OTEL_TRACES_SAMPLER="microsoft.fixed_percentage"
export OTEL_TRACES_SAMPLER_ARG=0.1
```

## Offline
1. Use Azure Monitor, The Azure Monitor exporter caches telemetry locally when the application loses connectivity to the Application Insights ingestion endpoint and retries sending for up to 48 hours. 
```python
# Code fragment - focus on configuring offline storage directory
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor(
    storage_directory="/var/telemetry/rag-pipeline",
)
```

## Application Insight
1. Store opentelemetry
2. To query:
```sql
requests
| where timestamp > ago(1h)
| project timestamp, name, duration, success, cloud_RoleName
| order by timestamp desc
| take 20
```
3. Security. Go to the Application Insights resource and set "Disable local authentication" to True. (This immediately blocks all Connection String-only traffic). Requires RBAC.
4. You always send to azure monitor.
```yaml
exporters:
  azuremonitor: # Why not applicationinsights?
    connection_string: "InstrumentationKey=12345..."    
```
5. Sampling, why item(count)
```
In the Azure Portal, go to your Container App -> Containers -> Edit and deploy -> Environment variables, and add:

Name: APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE

Value: 100 (to disable sampling and keep everything) or 50 (to keep 50% of traffic).
```

## Others
1. Monkey patching = auto instrumentation. E.g. import a otel http library and any http calls are logged automatically.
2. Application Map is only Macro view. Doesn't show spans.
3. To see Span, look in Performance (under Investigation) blade.
4. The "Missing Child Span" Mystery. The short answer is NO. Reducing your sampling ratio will never result in a broken trace or a missing child span. You will never see an activeSpan floating in the void without its parent.
5. Sampling type. Can use OTEL_TRACES_SAMPLER_ARG + OTEL_TRACES_SAMPLER
    - maxTracesPerSecond: 10 (rate limiting by time)
    - samplingRatio: 0.1 (default is 1.0), uses complex hash to know when to sample; statistically 10 in 100.

## Sampling
1. Using sum(itemCount), not count() when using sampling count in Application Insight.

```sql
exceptions
| summarize 
    StoredRows_Count = count(), 
    ActualExceptions_Sum = sum(itemCount)


requests
| where timestamp > ago(24h)
| summarize 
    StoredRequests_Count = count(), 
    ActualRequests_Sum = sum(itemCount) 
    by success
```

How Sampling Changes the Math
When your application generates high volumes of telemetry, Application Insights uses sampling to reduce costs and network traffic. This means it doesn't send every single exception to the cloud. Instead, it drops some events and only keeps a representative sample.

To make up for the dropped data, Application Insights automatically calculates a weight for the events it does keep and stores that weight in a property called itemCount.

For example, if your sampling rate is 10% (meaning 9 out of 10 exceptions are discarded):

The 1 exception that actually gets saved to your Log Analytics workspace will have an itemCount of 10.

This tells the system: "This single row represents 10 exceptions that actually occurred."

Comparing the Approaches
Because of this mechanism, the two KQL functions do very different things:

count() counts the rows in the database. If 100 exceptions occurred but your sampling rate is 10%, count() will return 10. It only tells you how many records were physically stored, ignoring the dropped data.

sum(itemCount) counts the actual events. It adds up the representative weights. In that same scenario, it adds up the itemCount of 10 for each of the 10 stored rows (10 x 10), returning 100. This gives you the accurate, real-world total of exceptions that your application threw.

(Note: If sampling is completely disabled, itemCount is simply 1 for every record, meaning count() and sum(itemCount) will return the exact same number.)