# Event Hub
1. This is a pull model
2. Everything is like kafka concept, with:
    - partition that enable parallelism
    - offset
    - independant consumer/partition
    - consumer group allow parallel processing of partition
3. This is hight-throughput ingestion

# Limitation
1. Size is up-to 1MB only.