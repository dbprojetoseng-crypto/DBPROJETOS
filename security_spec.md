# Security Specification - Multi-Tenant Engineering App

## 1. Data Invariants
- A **User** must belong to a **Workspace** to access most functionalities.
- A **Project** must belong to a **Workspace**.
- Access to **Projects**, **Clients**, and **BMS** is restricted to members of the associated **Workspace**.
- Roles:
  - `admin`: Full access to workspace settings, members, and all data within.
  - `planejador`: Access to projects and operations within their specific `area` (or all if area is empty).
  - `contratada`: Restricted access to view projects and manage their own **BMS**.
- `invites` are single-use and expire after 7 days.

## 2. The "Dirty Dozen" Payloads (Anti-Tests)

1. **Identity Spoofing**: Attempt to update `users/targetUid` with `workspaceId` of another tenant.
2. **Privilege Escalation**: A `contratada` user attempting to invite someone as `admin` in `invites/fakeInvite`.
3. **Ghost Write**: Attempt to create a `BMS` with `status: 'aprovado'` directly.
4. **Member Hijacking**: Attempt to add a member to `workspaces/targetWs/members/attackerUid` without a valid invite.
5. **PII Leak**: A member of Workspace A trying to read `users/otherMemberUid` from Workspace B.
6. **Cross-Tenant Access**: User from Workspace A trying to read `projects/projectFromWsB`.
7. **BMS Update Gap**: Updating a `BMS` that is already in `status: 'pago'`.
8. **Shadow Field injection**: Adding `isAdmin: true` to a project document update.
9. **Invite Link Reuse**: Attempting to use an invite where `used: true`.
10. **ID Poisoning**: Creating a project with a 2KB junk document ID.
11. **Relational Sync Break**: Creating a `BMS` for a `projectId` that doesn't exist.
12. **Role Self-Assignment**: User creating their first workspace but setting `plan: 'enterprise'` which they haven't paid for (if logic existed).

## 3. Test Runner (Conceptual) - firestore.rules.test.ts
Verification that all above scenarios return `PERMISSION_DENIED` and valid flows return success.
