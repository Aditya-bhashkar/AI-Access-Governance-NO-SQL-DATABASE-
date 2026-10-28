"""
Utility: compute the status of an API access record based on its expiry date.
"""

from datetime import date, datetime
from typing import Literal


StatusLiteral = Literal["Active", "Expiring Soon", "Expired"]


# Must match EXPIRING_SOON_DAYS in the frontend's src/constants/index.js
EXPIRING_SOON_DAYS = 30


def compute_status(
    expiry_date: date | datetime,
) -> StatusLiteral:
    """
    Compute the status of an API access record based on its expiry date.

    Supports both:
    - datetime.date
    - datetime.datetime

    MongoDB stores the expiry date as datetime, while Pydantic
    may provide it as date.
    """

    # Convert datetime to date so that both values being compared
    # are of the same type.
    if isinstance(expiry_date, datetime):
        expiry_date = expiry_date.date()

    today = date.today()

    diff = (expiry_date - today).days

    if diff < 0:
        return "Expired"

    if diff <= EXPIRING_SOON_DAYS:
        return "Expiring Soon"

    return "Active"