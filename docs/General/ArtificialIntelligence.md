# Artificial Intelligence

## Comparison
1. <=> Cosine Distance ("The Angle")
What it measures: The angle between two vectors, completely ignoring how "long" the vectors are.

The Analogy: Imagine you have two documents about dogs. Document A is a 5-word tweet about a dog. Document B is a 500-page encyclopedia about dogs. If you plot them in space, the encyclopedia vector will be massive (long), and the tweet vector will be tiny (short). But because they point in the exact same thematic direction, Cosine Distance says they are a perfect match.

When to use it: Use this as your default for standard NLP/Semantic Text Search unless the exam explicitly states the vectors are normalized.

2. <-> Euclidean / L2 Distance ("The Ruler")
What it measures: The literal, physical straight-line distance between the endpoints of two vectors. It cares heavily about magnitude (length).

The Analogy: If Document A (tweet) and Document B (encyclopedia) are plotted, Euclidean distance draws a ruler between their endpoints. Because one is huge and one is tiny, Euclidean distance will say they are very far apart and completely unrelated, even though they are both about dogs.

When to use it: You almost never use this for text. Use this for Computer Vision (Image similarity), Audio matching, or Spatial data where the magnitude (intensity/size) of the data point actually matters.

3. <#> Inner Product ("The Speed Shortcut"), In CosmosDB this is Dotproduct
What it measures: The mathematical projection of one vector onto another.

The Analogy: This is a pure math hack. Calculating the angles for <=> Cosine Distance requires heavy CPU math (square roots and division). The Inner Product just uses simple multiplication. If you force all your vectors to be the exact same length (normalized to 1.0), the Inner Product perfectly mimics the Cosine Distance, but runs significantly faster.

When to use it: Use this ONLY when the exam explicitly says the embeddings are "normalized to unit length." (This is the industry standard for OpenAI text-embedding-3 models).

The AI-200 Exam Trigger Words
When you are reading a question on the AI-200 exam, look for these specific trigger words to choose your answer:

If the prompt says "Text search, OpenAI, and normalized vectors" 👉 Choose <#> (Inner Product).

If the prompt says "Semantic text search" (and doesn't mention normalization) 👉 Choose <=> (Cosine).

If the prompt says "Image similarity, computer vision, or spatial distances" 👉 Choose <-> (Euclidean).



## Evaluate and improve retrieval quality
Retrieval quality determines RAG effectiveness. Poor retrieval leads to poor generation, regardless of how capable your LLM is. If the retriever returns irrelevant chunks, the LLM wastes context window capacity on useless text. If the retriever misses relevant chunks, the LLM lacks the information needed to answer correctly. Measuring retrieval quality separately from generation quality helps you diagnose where your RAG pipeline needs improvement.

Three metrics capture different aspects of retrieval performance:

    - Precision: The fraction of retrieved chunks that are actually relevant. Low precision means the LLM receives irrelevant context that might confuse it or cause it to generate incorrect information. Improve precision by tightening distance thresholds or reducing the number of retrieved chunks.

    - Recall: The fraction of relevant chunks that are retrieved. Low recall means the LLM misses important information, leading to incomplete or incorrect answers. Improve recall by loosening distance thresholds, increasing retrieved chunk count, or adjusting index parameters like ef_search.

    - Mean Reciprocal Rank (MRR): How high the first relevant result appears in the ranked list. MRR matters because LLMs weight earlier context more heavily, and users scanning citations notice top results first. Improve MRR by refining your embedding model or query preprocessing.

To measure these metrics, you need an evaluation dataset: a set of representative queries paired with human judgments about which chunks are relevant. Building this dataset requires effort upfront—someone must run sample queries and label the results—but it pays off by letting you make data-driven improvements rather than guessing. Start with 20-50 queries that represent the types of questions your users actually ask. For each query, retrieve the top 10-20 chunks and have a domain expert rate their relevance on a simple scale (irrelevant, somewhat relevant, highly relevant).

With this evaluation set in place, you can measure precision and recall at different cutoffs (precision@5, recall@10) and track how changes to your pipeline affect these metrics. Run your retrieval queries against the evaluation set, compare the results to the human judgments, and calculate the metrics. Most teams automate this into a scoring script that runs whenever they change chunking strategies, embedding models, or index parameters.

When metrics fall below target, systematically experiment with parameters that affect the precision-recall trade-off:

    - Chunk size: Smaller chunks improve precision by returning more focused content, but might hurt recall by fragmenting relevant information across multiple chunks. Larger chunks improve recall but dilute relevance.

    - Chunk overlap: More overlap preserves context across boundaries, helping queries that match content near chunk edges. However, overlap increases storage requirements and might return redundant content.

    - Embedding model: Different models capture different semantic relationships. A model trained on legal text might outperform a general-purpose model for legal research. Consider domain-specific or fine-tuned models if general models underperform.

    - Index parameters: Higher ef_search (HNSW) or probes (IVFFlat) improves recall by searching more candidates, at the cost of query latency. Start with default parameters and increase only if recall is insufficient.

Distance thresholds: Tighter thresholds improve precision by excluding marginal matches. Looser thresholds improve recall by including more candidates. Use your evaluation dataset to find the threshold that balances both metrics for your use case.