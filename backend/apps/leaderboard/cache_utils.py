"""Invalidação de cache dos endpoints públicos após mudanças de resultado."""

from django.core.cache import cache


def bump_public_api_cache():
    version = cache.get("public_api_cache_v", 1)
    cache.set("public_api_cache_v", version + 1, timeout=None)


def public_cache_key(prefix: str, *parts: str) -> str:
    version = cache.get("public_api_cache_v", 1)
    suffix = ":".join(str(p) for p in parts if p is not None and str(p) != "")
    return f"public:{version}:{prefix}:{suffix}"


def get_public_cached(key: str):
    return cache.get(key)


def set_public_cached(key: str, data, timeout: int):
    cache.set(key, data, timeout)
