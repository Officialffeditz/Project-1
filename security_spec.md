# Clearline Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Owner Isolation (PII & Private Telemetry)**: Every document under `/users/{userId}` and its subcollections (`devices`, `blocklist`, `schedules`, `activityLogs`, `dailyStats`) contains user-private activity data or PII (`email`). Only the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) may `get`, `list`, `create`, `update`, or `delete` documents in their tree.
2. **Master Gate Parent Existence**: Every subcollection document creation/update verifies that the parent `/users/{userId}` profile document exists via `exists(/databases/$(database)/documents/users/$(userId))`, preventing orphaned subcollection writes.
3. **Immutable Ownership & Timestamps**: `uid` / `ownerId` and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` timestamps must equal `request.time`.
4. **Strict Payload Keys & Bounds**: Every entity validates exact allowed keys (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update), numeric ranges (e.g., `0..1440` minutes), string max lengths, and `isValidId()` regexes (`^[a-zA-Z0-9_\-]+$`) on document IDs.
5. **Bounded Arrays**: `platforms` (`<= 5`, `platforms[0] is string`) and `days` (`<= 7`, `days[0] is string`) are strictly bounded and type-checked.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Cross-User Read (`get /users/otherUid`)**: Authenticated user A attempts to read user B's `/users/userB` PII profile.
2. **Cross-User List (`list /users/otherUid/blocklist`)**: Authenticated user A queries user B's custom blocklist.
3. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempts to create a `/users/{uid}` document.
4. **Shadow Field Injection on Create**: User creates a `BlockRule` with an extra shadow field `isAdmin: true`.
5. **Shadow Field Injection on Update**: User updates a `UserProfile` with an unallowed field `createdAt` or `uid` mutation.
6. **Identity Spoofing on Subcollection**: User A creates `/users/userA/blocklist/rule1` with `ownerId: "userB"`.
7. **ID Poisoning**: User attempts to write `/users/userA/blocklist/../../etc/passwd` or a 200-character invalid ID.
8. **Denial-of-Wallet Oversized String**: User writes a `BlockRule` with `pattern` length 5000 chars (`> 200`).
9. **Client Timestamp Forgery**: User creates a `UserProfile` with `createdAt` set to a past client timestamp instead of `request.time`.
10. **Negative Reward Bank Tampering**: User updates `rewardBankMinutes` to `-50` or `999999` (`> 10000`).
11. **Unbounded Array Attack**: User creates a `DowntimeSchedule` with `days` containing 100 entries (`> 7`).
12. **Orphaned Subcollection Write**: User attempts to create `/users/userA/schedules/s1` before `/users/userA` exists.
