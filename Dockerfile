# syntax=docker/dockerfile:1
# check=error=true

# Verified multi-platform stable release; see docker/README.md for update sources.
FROM nginx/nginx-unprivileged:1.30.6-alpine-slim@sha256:ea8a305bb7bff1e622c8223a097bf5c7664d36b05371717e23dc69972e1924e6

ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="MOe Model Lab" \
      org.opencontainers.image.description="Model catalogs, comparisons, and evaluation reports" \
      org.opencontainers.image.source="https://github.com/mhamidawad/moe-model-eva" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.licenses="Apache-2.0"

# The app is already static source: no compiler, package manager, or Node runtime.
COPY --chown=0:0 --chmod=0444 docker/nginx.conf /etc/nginx/nginx.conf
COPY --chown=0:0 out/ /usr/share/moe-model-lab/
COPY --chown=0:0 --chmod=0444 LICENSE /usr/share/licenses/moe-model-lab/LICENSE

USER 101:101
EXPOSE 8080
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=15s --timeout=3s --start-period=3s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]

# Configuration is fixed at build time; no startup writes to /etc/nginx.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
