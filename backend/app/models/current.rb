class Current < ActiveSupport::CurrentAttributes
  attribute :session
  delegate :user, to: :session, allow_nil: true

  # @permissions is a plain ivar, not a declared `attribute` (it's a memo,
  # not request input) — CurrentAttributes#reset only clears the
  # `attribute`-backed store, so without this explicit `resets` hook a
  # previous request/job's permission set would survive on a reused thread
  # and leak into the next one. Verified by a real spec failure, not
  # theoretical: two examples in spec/policies/application_policy_spec.rb
  # shared a stale empty Set until this was added.
  resets { @permissions = nil }

  def company
    user&.company
  end

  # Resolved once per request, not re-queried on every Pundit check.
  def permissions
    @permissions ||= user&.permission_keys || Set.new
  end
end
