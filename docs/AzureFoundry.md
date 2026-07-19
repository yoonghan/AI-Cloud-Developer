# Azure Foundry 
1. Best to read up on [Develop Generative AI Apps](https://learn.microsoft.com/en-us/training/paths/develop-generative-ai-apps/)
2. Might not be relevant for the exam on AI-200, but good to know for AI-103.

## Key Concepts

- Open AI - Is the core fundamental service that provides the AI models
- Azure AI Studio - Is a IDE for AI development. 
- There are 2 splits
    - Project endpoint 
    - Azure OpenAI endpoint


### Project endpoint
1. Project endpoint can be accessed by multiple Azure OpenAI resources in the same project. It's a way to share models between resources. But it is not available for all models.
2. Uses the SDK "@azure/ai-projects"

### Azure OpenAI endpoint
1. Azure OpenAI endpoint is specific to the Azure OpenAI resource. It's a way to isolate models between resources. 
2. Uses the SDK "openai" libraries works too.
    - OpenAI (Direct):
        - Best For: Individual developers, startups, or teams wanting the quickest setup and immediate access to the latest models and experimental APIs. 
        - Setup: Streamlined and fast. You can sign up, grab an API key, and start making calls within minutes. 
        - Model Updates: Updates are pushed directly by OpenAI, meaning you get new versions and features on day one. 
        - Data Privacy: Data submitted via the API is not used to train OpenAI models. However, it may be retained for abuse monitoring unless you qualify for zero-data retention. 
    - Azure OpenAI Service:
        - Best For: Enterprises, highly regulated industries (e.g., healthcare, finance, government), and organizations already heavily invested in the Microsoft ecosystem. 
        - Setup: Requires an active Azure subscription and an application process for access, which can take days or weeks. 
        - Security & Compliance: Offers strict enterprise features like data residency control, private endpoints, VNETs, and various compliance certifications (HIPAA, SOC 2, FedRAMP). 
        - Data Privacy: Your data remains entirely within your Azure tenant and is strictly isolated. It is never used to train Microsoft or OpenAI foundational models. 
        - Ecosystem Integration: Seamlessly connects with other Azure services and Microsoft tools. 


