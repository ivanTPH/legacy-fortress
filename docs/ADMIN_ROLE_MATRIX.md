# Admin Role Matrix

Canonical Phase 1 roles:

| Role | Dashboard | User summary | Vault summary | Invitations | Email summary | Probate summary | Support summary | Audit | Enterprise/licence summary | Local role testing |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `super_admin` | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| `support_agent` | Y | Y | Y | Y | Y | N | Y | N | N | N |
| `probate_reviewer` | Y | N | N | Y | N | Y | N | Limited | N | N |
| `auditor` | Y | N | N | N | N | N | N | Y | N | N |
| `enterprise_admin` | Y | N | N | N | N | N | N | N | Y | N |

`organisation_admin` is treated as a compatibility alias for `enterprise_admin` when older local data contains that value. New code should use `enterprise_admin`.

All admin API routes must enforce capabilities server-side. Client-side hiding is only a usability layer.
