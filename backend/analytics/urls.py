from django.urls import path

from analytics import views

urlpatterns = [
    path("health/", views.health),
    path("summary/", views.summary),
    path("customers/", views.customers),
    path("customers/<str:customer_id>/", views.customer_detail),
    path("at-risk/", views.at_risk),
    path("seasonality/", views.seasonality),
    path("pricing-variance/", views.pricing_variance),
    path("predict/", views.predict),
    path("model-metrics/", views.model_metrics),
    path("ingest/", views.ingest),
    path("customer-map/", views.customer_map),
    path("options/", views.options),
    path("example-job/", views.example_job),
]
