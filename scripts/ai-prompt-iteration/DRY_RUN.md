Note: In this pi harness environment, the `bash -lc` tool wrapper reports exit code `0` even when Node terminates with a non-zero code.

The scripts still *log* dry-run state clearly. When running outside the harness, dry-run mode exits non-zero.
