# Run MOe Model Lab in Docker

The `Docker` branch builds in **GitHub Actions only**. The runtime is a single NGINX container serving the existing `out/` files on port 8080. No Node runtime, database, API credentials, application compilation, or container volume is required.

The workflow validates native `linux/amd64` and `linux/arm64` images on separate runners, then uploads each tested Docker archive with its checksum and image identity. There is no QEMU emulation or registry login. Registry push is disabled. Artifacts expire after seven days; keep your downloaded archive or run the workflow again.

## Download and run a tested image

1. Open [Docker validation runs](https://github.com/mhamidawad/moe-model-eva/actions/workflows/docker.yml?query=branch%3ADocker), select a successful run, and download `moe-model-lab-amd64` for an Intel/AMD PC or `moe-model-lab-arm64` for an ARM Oracle VM. `uname -m` returns `x86_64` for AMD64 or `aarch64` for ARM64. Unzip the artifact on the deployment host.
2. Clone the branch and load the archive. For an ARM64 VM, assuming the extracted files are in `$HOME/docker-image`:

   ```bash
   git clone --branch Docker --single-branch https://github.com/mhamidawad/moe-model-eva.git
   cd moe-model-eva
   (cd "$HOME/docker-image" && sha256sum --check moe-model-lab-arm64.tar.sha256)
   docker load --input "$HOME/docker-image/moe-model-lab-arm64.tar"
   cp .env.example .env
   docker compose config --quiet
   docker compose up -d --no-build --pull never --wait
   curl --fail http://127.0.0.1:8080/healthz
   ```

   Use `amd64` in the archive filenames for an Intel/AMD host. The loaded image has both an immutable source-commit tag and `moe-model-lab:docker`. The default Compose image uses the latter. To retain an exact release, set `MOE_MODEL_LAB_IMAGE=moe-model-lab:<full source commit>` in `.env`, using the `Source commit` value from `image-info-<arch>.txt`.

3. Open `http://127.0.0.1:8080` on that host. For an optional terminal-based download, authenticate `gh` and run `gh run download RUN_ID --repo mhamidawad/moe-model-eva --name moe-model-lab-arm64 --dir "$HOME/docker-image"`, replacing `RUN_ID` with the successful run number in its URL.

Docker Engine and the Compose v2 plugin must already be installed. The Compose service has no `build` section and uses `pull_policy: never`: starting it cannot compile an image or publish one. A missing image means the archive must be downloaded and loaded first.

## Private access from your other devices

The published port binds to `127.0.0.1`, so Docker does not expose the app on the VM's public or Tailscale interfaces. On `moe-instance`, with Tailscale already configured, you can proxy it privately:

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8080
tailscale serve status
```

Open the exact HTTPS URL printed by Tailscale from an authorized device in your tailnet. Port 8443 avoids taking over an existing Serve route on 443; choose another unused HTTPS port if needed. Access follows your tailnet grants/ACLs. Use Serve for private access; Funnel exposes services publicly. This container has no ChatGPT/Sites sign-in middleware. The app's “Private workspace” text is informational; privacy comes from the localhost binding and your private proxy. The existing owner-only Sites deployment is unaffected.

## Configuration and saved data

| Variable | Default | Purpose |
| --- | --- | --- |
| `MOE_MODEL_LAB_IMAGE` | `moe-model-lab:docker` | An image already loaded on this host |
| `MOE_MODEL_LAB_PORT` | `8080` | Localhost port forwarded to container port 8080 |

If you change the host port, use the same port in your readiness request and private proxy target. These variables configure Compose; they do not configure model providers in the browser. Register providers/models inside the gallery and use the transient catalog-sync key field as before. Model API requests originate from the visiting browser. HTTP/private gateway catalogs can still use the downloadable offline export helper.

Providers, reports, filters, and selections persist in **browser localStorage**, scoped to the website origin. Changing from the Sites URL to your VM's URL creates a separate browser workspace. Export a workspace backup from the original app, then import it at the new origin. Replacing or stopping the container does not delete browser data. There is no server-side database, shared storage, migration, or automatic model inference.

The runtime runs as UID/GID `101:101`, drops Linux capabilities, prohibits privilege escalation, uses a read-only root filesystem with a small writable `/tmp`, caps memory at 128 MB, and rotates access logs. NGINX handles graceful `SIGQUIT` shutdown. `GET /healthz` is the image health check; no upstream model endpoint is contacted.

## Operations and verification

```bash
docker compose ps
docker compose logs --tail 50 web
docker compose stop
docker compose up -d --no-build --pull never --wait
```

To deploy an update, download a new successful artifact, verify its checksum, load it, update the image reference in `.env` if pinned, and run the same `up` command. `docker compose down` removes only this Compose project's containers/network; browser data remains in the browser.

CI runs the existing Node and DOM tests, Compose configuration validation, BuildKit Dockerfile checks, then tests the exported and reloaded image. It checks exact app/asset bytes, JavaScript/CSS MIME types, readiness, cache headers, missing-asset behavior, exclusion of non-runtime files, non-root execution, read-only operation, image architecture/revision, and a clean shutdown. `bash scripts/test-container.sh` can also validate an already-loaded image on a Docker-enabled host; it creates and removes a uniquely named Compose project and uses localhost port 18080 by default. It never builds an image.

The single runtime stage is deliberate: all app assets already exist and no production dependencies are installed. Development dependencies are locked in `pnpm-lock.yaml` for CI tests and excluded from the container. SBOM/provenance attestations are not attached to these single-platform Docker-export archives; the artifact checksum, image ID, and source revision are recorded instead. No vulnerability-free claim is made.

## Maintainer sources

Verified on 2026-10-22. The base is the maintained stable `nginx/nginx-unprivileged:1.30.6-alpine-slim`, pinned to its multi-platform registry digest. The former `nginxinc` Docker Hub namespace is no longer maintained. Update the tag and index digest together, then rerun both architecture jobs. Actions are pinned to verified release commits with version comments.

- [NGINX unprivileged image and registry/platform policy](https://github.com/nginx/docker-nginx-unprivileged)
- [Stable Alpine slim Dockerfile](https://github.com/nginx/docker-nginx-unprivileged/blob/main/stable/alpine-slim/Dockerfile)
- [Docker archive export in GitHub Actions](https://docs.docker.com/build/ci/github-actions/share-image-jobs/)
- [BuildKit build checks](https://docs.docker.com/build/checks/)
- [Compose service configuration](https://docs.docker.com/reference/compose-file/services/)
- [GitHub hosted runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve)
