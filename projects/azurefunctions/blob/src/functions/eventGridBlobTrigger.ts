import { app, InvocationContext } from "@azure/functions";

export async function eventGridBlobTrigger(blob: Uint8Array, context: InvocationContext): Promise<void> {
    context.log(`Storage blob function processed blob "${context.triggerMetadata.name}" with size ${blob.length} bytes`);
}

app.storageBlob('eventGridBlobTrigger', {
    path: 'mycontainer/{name}',  //This one is parameter extraction, if wrong context can't extract but no error
    source: 'EventGrid',
    connection: 'fa3ec0_STORAGE',
    handler: eventGridBlobTrigger
});
