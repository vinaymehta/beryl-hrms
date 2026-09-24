module Auth
  # Shared response shape for every endpoint that returns "who is the
  # current user" (register, login, GET /me) — kept in one place so the
  # three call sites can't quietly drift apart.
  module MePresenter
    def self.call(user)
      # Current.permissions is only correct for the request's own
      # authenticated user (login/register/GET me) — email verification can
      # be hit unauthenticated for a *different* user than whoever's session
      # cookie (if any) is present, so that case computes fresh instead.
      permissions = user == Current.user ? Current.permissions : user.permission_keys

      {
        user: Api::V1::UserSerializer.new(user).as_json,
        # Drives the forced change-password screen. Sent alongside the user
        # rather than inside it because it is a statement about what this
        # SESSION may do, not a property of the person.
        #
        # camelCase by hand: this is a plain Hash from a service, so it never
        # passes through ApplicationSerializer's `transform_keys :lower_camel`.
        mustChangePassword: user.must_change_password?,
        company: Api::V1::CompanySerializer.new(user.company).as_json,
        roles: Api::V1::RoleSerializer.new(user.roles.to_a).as_json,
        permissions: permissions.to_a.sort
      }
    end
  end
end
