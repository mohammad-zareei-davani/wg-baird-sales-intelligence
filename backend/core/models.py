from django.db import models


class Job(models.Model):
    """One job-level sales transaction. Field names mirror the 36 source
    columns (snake_cased); `purchases` maps to the source column 'Puchases'
    (sic, the typo is in the client's system)."""

    # Stable identity is the hash of all 36 raw source values. Title identifies
    # a recurring product/job definition and is deliberately not unique.
    job_key = models.CharField(max_length=32, unique=True, db_index=True)

    # --- Source columns ---
    title = models.CharField(max_length=255, db_index=True)
    customer_id = models.CharField(max_length=64, db_index=True)
    job_status = models.CharField(max_length=64, null=True, blank=True)
    sales_in = models.DateField(db_index=True, null=True)
    year = models.IntegerField(null=True)
    month = models.CharField(max_length=32, null=True, blank=True)
    week_no = models.IntegerField(null=True)
    sales_out = models.DateField(null=True)
    quantity = models.FloatField(null=True)
    sell_price = models.FloatField(null=True)
    mup_pct = models.FloatField(null=True)
    va_amount = models.FloatField(null=True)
    va_per_24 = models.FloatField(null=True)
    va_pct = models.FloatField(null=True)
    va_per_k = models.FloatField(null=True)
    rebate = models.FloatField(null=True)
    purchases = models.FloatField(null=True)  # source column: 'Puchases'
    press_hrs = models.FloatField(null=True)
    impressions = models.FloatField(null=True)
    handling = models.FloatField(null=True)
    labour = models.FloatField(null=True)
    paper = models.FloatField(null=True)
    labmup = models.FloatField(null=True)
    manadj = models.FloatField(null=True)
    mupnett = models.FloatField(null=True)
    plates = models.FloatField(null=True)
    amt_inv = models.FloatField(null=True)
    customer_name = models.CharField(max_length=255, null=True, blank=True)
    rep = models.CharField(max_length=128, null=True, blank=True)
    region = models.CharField(max_length=128, null=True, blank=True)
    industry = models.CharField(max_length=128, null=True, blank=True)
    work_type = models.CharField(max_length=64, null=True, blank=True)
    product_type = models.CharField(max_length=128, null=True, blank=True)
    binding_type = models.CharField(max_length=128, null=True, blank=True)
    currency = models.CharField(max_length=16, null=True, blank=True)
    ship_date = models.DateField(null=True)

    # --- Derived fields ---
    sell_price_gbp = models.FloatField(null=True)
    va_amount_gbp = models.FloatField(null=True)
    purchases_gbp = models.FloatField(null=True)
    labour_gbp = models.FloatField(null=True)
    paper_gbp = models.FloatField(null=True)
    product_type_norm = models.CharField(max_length=128, db_index=True, null=True, blank=True)
    product_group = models.CharField(max_length=64, db_index=True, null=True, blank=True)
    binding_type_filled = models.CharField(max_length=128, null=True, blank=True)
    is_credit = models.BooleanField(default=False)
    is_closed = models.BooleanField(default=False)
    has_date_anomaly = models.BooleanField(default=False)

    class Meta:
        db_table = "core_job"

    def __str__(self) -> str:
        return self.title


class IngestRun(models.Model):
    """Audit trail: one row per ingestion run."""

    created_at = models.DateTimeField(auto_now_add=True)
    source_filename = models.CharField(max_length=255)
    rows_read = models.IntegerField()
    rows_inserted = models.IntegerField()
    rows_updated = models.IntegerField()
    quality_counts = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return (
            f"IngestRun {self.created_at:%Y-%m-%d %H:%M:%S} {self.source_filename} "
            f"read={self.rows_read} inserted={self.rows_inserted} updated={self.rows_updated}"
        )
