"""Emit the complete CustomerID → Customer Name display-label map."""

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count

from core.models import Job


class Command(BaseCommand):
    help = "Print the distinct CustomerID to Customer Name mapping."

    def handle(self, *args, **options):
        conflicts = (
            Job.objects.values("customer_id")
            .annotate(label_count=Count("customer_name", distinct=True))
            .filter(label_count__gt=1)
        )
        if conflicts.exists():
            raise CommandError("CustomerID to Customer Name mapping is not 1:1")

        pairs = (
            Job.objects.values_list("customer_id", "customer_name")
            .distinct()
            .order_by("customer_id")
        )
        for customer_id, customer_name in pairs:
            self.stdout.write(f"{customer_id}\t{customer_name or ''}")
        self.stdout.write(f"Total pairs: {pairs.count()}")
