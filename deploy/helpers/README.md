# deploy/helpers/

Standalone one-off / diagnostic scripts used during deployment and debugging.
These are **not** part of the numbered runbook (`../01-*.sh` … `../53-*.sh`) and
are not sourced by any other script. They all use absolute `/opt/ollalink/...`
paths and are meant to be run directly on the VM.

| File | Purpose |
| --- | --- |
| `_resources.sh` | Snapshot host resources (CPU, mem, disk, docker stats, build sizes). |
| `_cleanup.sh` / `_cleanup2.sh` | Kill stray `next-server` / `cvxlogs` processes. |
| `_verify-admin.sh` | One-off: verify the legacy admin account so password sign-in works under mandatory verification. |
| `_otpcap_test.sh` | Capture an OTP code from the Convex logs tail and verify it. |
| `p4-faults.sh` | P4 failure injection: webhook auth, job-error path when backend down, OTP single-use. |
| `bootstrap_glitchtip.py` | Bootstrap the GlitchTip org/project/DSN via its API. |
| `discover_glitchtip.py` | Discover GlitchTip endpoints/config. |
| `verify_glitch.py` | Verify GlitchTip received a test Sentry event. |

The numbered runbook scripts live in the parent `deploy/` directory.