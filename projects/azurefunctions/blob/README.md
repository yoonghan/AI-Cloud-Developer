# Blob reading
See https://learn.microsoft.com/en-us/azure/azure-functions/functions-event-grid-blob-trigger?pivots=programming-language-javascript

## Install in VS Code
- Azure Storage Extension
- Azurite

## In VS Code
1. Goto Settings and set Azurite -> Location (i think doesn't need after Storage extension was installed). Put any local directory.

## To run
1. In Azure side action:
    - Attached Storage Accounts -> Blob Containers, create mycontainer
    - Click mycontainer and Open in Explorer
    - In the new pop up, create and edit a file. It takes few minutes for each action.
    - NOTE: I couldn't upload file
2. Update the Local Project
    - Right-click and Execute eventGridBlobTrigger
    - enter mycontainer/*** the file you have uploaded
3. Make sure the whole VS Code only open this project else Azure side action might not work correctly.