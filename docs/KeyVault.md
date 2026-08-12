# KeyVault
1. You cannot change retention period of soft delete once created.
2. Read limit is 4000/s, write is 300/s

## Tiers
1. Standard tier: Encrypts keys using software libraries validated to FIPS 140 Level 1. This tier is suitable for most application scenarios where software-protected keys provide sufficient security.
2. Premium tier: Protects keys using FIPS 140-3 Level 3 validated hardware security modules (HSMs). Key material never leaves the HSM boundary. You can choose this tier when regulatory or compliance requirements mandate HSM-protected keys.
3. Both tier charges the same and have all features. Except for Keys/HSM.

## Limitation
1. Limit names, three to 24 characters long, and contain only alphanumeric characters and hyphens. 
2. Secret
    - Up-to 25kb
    - Up-to 255 characters
3. Key
    - Keys support RSA (2048, 3072, and 4096 bit)
    - elliptic curve (P-256, P-256K, P-384, P-521)
    - symmetric (oct) key types.
4. Certificates
    - X.509 certificates along with their private keys

# RBAC
1. Control plane
    - Owner - can manage user access.
    - Contributor - can manage cannot read.
2. Data plane (THIS IS REQUIRED TO LIST SECRETS/KEYS/CERTIFICATES)
    - Key Vault Secrets User: Grants read-only access to secret values, including the ability to read certificate private keys stored as secrets. Assign this role to application managed identities that need to retrieve credentials at runtime.
    - Key Vault Secrets Officer: Grants full management permissions on **secrets**(no key and certificate), including create, update, delete, and list operations. Assign this role to operators or CI/CD pipelines responsible for secret lifecycle management.
    - Key Vault Administrator: Grants all data plane operations on keys, secrets, and certificates. This role doesn't grant control plane permissions to manage the vault resource itself or modify role assignments.
    - Key Vault Reader: Grants read access to vault metadata (such as secret names and properties) without revealing secret values or key material. Useful for monitoring and discovery tools that need to verify which secrets exist without accessing their contents.

## Soft delete
- Enable by default during vault creation. 
- Once enabled cannot disable.
- Retention is 7 - 90days. Can be set only during creation.
- Key Vault itself is soft-deleted, its RBAC role assignments and Event Grid subscriptions are also deleted.

### Purge Protection
- Prevents permanent deletion of soft-deleted objects during the retention period.
- Once enabled cannot disable.

## Versioning
- We can use versioning. Can even fallback to read old version.

## Rotation
1. Manual
2. Auto has a lifecycle with EventGrid.
    - CertificateNearExpiry - 30days before
    - CertificateExpired - when expired
    - SecretNearExpiry - 30days before
    - SecretExpired - when expired
    - KeyNearExpiry - 30days before
    - KeyExpired - when expired
3. Dual credential rotation (only for secrets)
    - Enable primary and secondary password
4. Secrets can be set to expired manually.
```python
client.set_secret(
    "openai-api-key",
    "sk-newkey789",
    expires_on=expiration_date,
    content_type="text/plain",
    tags={"rotation-policy": "90-days", "service": "azure-openai"}
)
```

## Caching
1. Due to limit, good to cache,
2. To invalidate caching
    - Use a special key. Sentinal Key Pattern.
    - Subscribe to event-grid

## Good to know.
- App Config can be free.