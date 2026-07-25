"""URL configuration for the W&G Baird API."""

from django.urls import include, path

urlpatterns = [
    path("api/", include("analytics.urls")),
]
