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
        company: Api::V1::CompanySerializer.new(user.company).as_json,
        roles: Api::V1::RoleSerializer.new(user.roles.to_a).as_json,
        permissions: permissions.to_a.sort
      }
    end
  end
end
