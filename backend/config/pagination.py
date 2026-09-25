"""Shared DRF pagination (HVRA prototype).

The default DRF PageNumberPagination hard-codes the page size, so admin
curation screens (e.g. the Libraries page) cannot fetch the full library in a
single request. This subclass exposes the conventional `?limit=` query param
with a sane ceiling.
"""
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "limit"
    max_page_size = 2000
