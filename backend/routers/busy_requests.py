"""Compatibility export for the active busy-request controller.

The application registers ``backend.controllers.busy_requests`` from ``main.py``.
Keep this module as a forwarding alias so importing the legacy router cannot
silently restore the old workflow that notified Admin before nominee consent.
"""
try:
    from ..controllers.busy_requests import router
except ImportError:
    from controllers.busy_requests import router