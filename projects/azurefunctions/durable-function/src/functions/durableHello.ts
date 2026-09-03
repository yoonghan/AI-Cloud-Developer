import { app, HttpHandler, HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { ActivityHandler, OrchestrationContext, OrchestrationHandler } from 'durable-functions';

const activityName = 'durableHello';

const durableHelloOrchestrator: OrchestrationHandler = function* (context: OrchestrationContext) {
    const outputs = [];
    outputs.push(yield context.df.callActivity(activityName, 'Tokyo'));

    /* 1. Pause orchestration and wait for human intervention
        Event Name: ApprovalEvent
        
        Using JS fetch:
        fetch("http://localhost:7071/runtime/webhooks/durabletask/instances/<INSTANCE_ID>/raiseEvent/ApprovalEvent?taskHub=...", {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify("Approved") // Must be valid JSON!
        })

        fetch("http://localhost:7071/runtime/webhooks/durabletask/instances/<INSTANCE_ID>/terminateEvent?reason=Not allowed&taskHub=...", {
            method: 'POST',
            headers: { "Content-Type": "application/json" }
        })
    */
    const approval = yield context.df.waitForExternalEvent('ApprovalEvent');
    outputs.push(`Received event data: ${JSON.stringify(approval)}`);

    outputs.push(yield context.df.callActivity(activityName, 'Seattle'));
    outputs.push(yield context.df.callActivity(activityName, 'Cairo'));

    return outputs;
};

df.app.orchestration('durableHelloOrchestrator', durableHelloOrchestrator);


const durableHello: ActivityHandler = (input: string): string => {
    return `Hello, ${input}`;
};
df.app.activity(activityName, { handler: durableHello });

const durableHelloHttpStart: HttpHandler = async (request: HttpRequest, context: InvocationContext): Promise<HttpResponse> => {
    const client = df.getClient(context);
    const body: unknown = await request.text();
    const instanceId: string = await client.startNew(request.params.orchestratorName, { input: body });

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    return client.createCheckStatusResponse(request, instanceId);
};

app.http('durableHelloHttpStart', {
    route: 'orchestrators/{orchestratorName}',
    extraInputs: [df.input.durableClient()],
    handler: durableHelloHttpStart,
});