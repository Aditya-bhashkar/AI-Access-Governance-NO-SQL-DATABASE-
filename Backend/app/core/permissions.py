"""
Centralized RBAC policy.

This module is the single source of truth for:

- the canonical roles
- legacy-role normalization
- the role hierarchy
- every "can actor do X to target?" decision used by user management

Canonical roles:
    user
    admin
    superadmin

Legacy role:
    super_admin -> superadmin

Unknown / missing roles fail closed to `user`.

IMPORTANT
---------
The numeric hierarchy is only used for "is this role at least X?" checks.
Management rights are NOT derived from it, because some rules are explicit
(for example an admin must NOT manage another admin even though both have
the same rank). Management rights come from MANAGEABLE_ROLES below.
"""

from typing import Mapping, Optional

# ============================================================
# Roles
# ============================================================

ROLE_USER = "user"
ROLE_ADMIN = "admin"
ROLE_SUPERADMIN = "superadmin"

VALID_ROLES: tuple[str, ...] = (
    ROLE_USER,
    ROLE_ADMIN,
    ROLE_SUPERADMIN,
)

# Values that may exist in old documents and mean "superadmin".
LEGACY_SUPERADMIN_ROLES: tuple[str, ...] = ("super_admin",)

ROLE_HIERARCHY: dict[str, int] = {
    ROLE_USER: 1,
    ROLE_ADMIN: 2,
    ROLE_SUPERADMIN: 3,
}

# ------------------------------------------------------------
# Who may a given role manage (activate / deactivate / edit /
# delete / change role of)?
#
#   user        -> nobody
#   admin       -> normal users only
#   superadmin  -> normal users and admins
#
# Superadmin accounts are never in any set: they are protected from
# every administrative operation performed through the API
# (including by other superadmins). Superadmins are created only by
# the out-of-band bootstrap script.
# ------------------------------------------------------------
MANAGEABLE_ROLES: dict[str, frozenset[str]] = {
    ROLE_USER: frozenset(),
    ROLE_ADMIN: frozenset({ROLE_USER}),
    ROLE_SUPERADMIN: frozenset({ROLE_USER, ROLE_ADMIN}),
}

# Roles that a superadmin may assign through PATCH /users/{id}/role.
ASSIGNABLE_ROLES: frozenset[str] = frozenset({ROLE_USER, ROLE_ADMIN})


# ============================================================
# Normalization
# ============================================================

def normalize_role(role: Optional[str]) -> str:
    """
    Normalize any stored / supplied role value.

    super_admin -> superadmin
    unknown / missing / non-string -> user (fail closed)
    """

    if not isinstance(role, str):
        return ROLE_USER

    if role in LEGACY_SUPERADMIN_ROLES:
        return ROLE_SUPERADMIN

    if role in VALID_ROLES:
        return role

    return ROLE_USER


def role_rank(role: Optional[str]) -> int:
    """Numeric rank of a (normalized) role."""

    return ROLE_HIERARCHY[normalize_role(role)]


def has_at_least(role: Optional[str], minimum: str) -> bool:
    """True if `role` ranks at or above `minimum`."""

    return role_rank(role) >= role_rank(minimum)


def is_admin_or_above(role: Optional[str]) -> bool:
    return has_at_least(role, ROLE_ADMIN)


def is_superadmin(role: Optional[str]) -> bool:
    return normalize_role(role) == ROLE_SUPERADMIN


# ============================================================
# Identity helpers
# ============================================================

def get_user_id(user: Mapping) -> Optional[str]:
    """Return the string ID of a user dict (`_id` or `id`)."""

    value = user.get("_id") or user.get("id")

    return str(value) if value else None


def is_self(actor: Mapping, target: Mapping) -> bool:
    """True when actor and target are the same account."""

    actor_id = get_user_id(actor)
    target_id = get_user_id(target)

    return bool(actor_id and target_id and actor_id == target_id)


# ============================================================
# Policy decisions
# ============================================================

def can_manage_role(actor_role: Optional[str], target_role: Optional[str]) -> bool:
    """
    Role-level rule: may an actor with `actor_role` manage an account
    whose role is `target_role`?
    """

    return (
        normalize_role(target_role)
        in MANAGEABLE_ROLES[normalize_role(actor_role)]
    )


def can_view_user(actor: Mapping, target: Mapping) -> bool:
    """
    View a user's details.

    - anybody may view themselves
    - admin       -> normal users
    - superadmin  -> everyone
    """

    if is_self(actor, target):
        return True

    actor_role = normalize_role(actor.get("role"))

    if actor_role == ROLE_SUPERADMIN:
        return True

    return can_manage_role(actor_role, target.get("role"))


def can_update_profile(actor: Mapping, target: Mapping) -> bool:
    """
    Edit name / email.

    - anybody may edit their own profile
    - otherwise the actor must be allowed to manage the target
    """

    if is_self(actor, target):
        return True

    return can_manage_role(actor.get("role"), target.get("role"))


def can_change_status(actor: Mapping, target: Mapping) -> bool:
    """Activate / deactivate. Never on yourself."""

    if is_self(actor, target):
        return False

    return can_manage_role(actor.get("role"), target.get("role"))


def can_delete_user(actor: Mapping, target: Mapping) -> bool:
    """Delete an account. Never yourself."""

    if is_self(actor, target):
        return False

    return can_manage_role(actor.get("role"), target.get("role"))


def can_change_role(
    actor: Mapping,
    target: Mapping,
    new_role: Optional[str] = None,
) -> bool:
    """
    Change a user's role.

    Only a superadmin may do this, never on themselves, never on
    another superadmin, and only to an assignable role (user/admin).
    If `new_role` is omitted only the actor/target part is evaluated
    (used to decide whether to offer the control in the UI).
    """

    if normalize_role(actor.get("role")) != ROLE_SUPERADMIN:
        return False

    if is_self(actor, target):
        return False

    if not can_manage_role(ROLE_SUPERADMIN, target.get("role")):
        return False

    if new_role is not None and new_role not in ASSIGNABLE_ROLES:
        return False

    return True


def can_create_admin(actor: Mapping) -> bool:
    """Only a superadmin may create / promote admins."""

    return normalize_role(actor.get("role")) == ROLE_SUPERADMIN


def can_list_users(actor: Mapping) -> bool:
    return is_admin_or_above(actor.get("role"))


def permissions_for(actor: Mapping, target: Mapping) -> dict[str, bool]:
    """
    Per-row permission map returned to the frontend so the UI never
    has to re-implement these rules. The backend still re-checks every
    operation independently.
    """

    return {
        "view": can_view_user(actor, target),
        "edit": can_update_profile(actor, target),
        "change_status": can_change_status(actor, target),
        "change_role": can_change_role(actor, target),
        "delete": can_delete_user(actor, target),
    }


# ============================================================
# Human-readable denial reasons (no sensitive information)
# ============================================================

def denial_reason(actor: Mapping, target: Mapping, action: str) -> str:
    """Explain why an administrative action was refused."""

    if is_self(actor, target) and action != "update":
        return f"You cannot {action} your own account."

    if normalize_role(target.get("role")) == ROLE_SUPERADMIN:
        return "Superadmin accounts are protected."

    return "You do not have permission to perform this action."
