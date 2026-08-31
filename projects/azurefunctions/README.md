This project is much more complex.
1. Open in VS seperately (unlike the other lab projects). File -> Add folder to workspace.
2. Install Docker with Azurite, if prompted `docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite`
3. Follow the document in https://microsoftlearning.github.io/mslearn-azure-ai/instructions/integrate-services/03-azure-functions-mcp-server.html. Test the `MCP with local docker`.
4. NOTE: This project commits local.settings.json.