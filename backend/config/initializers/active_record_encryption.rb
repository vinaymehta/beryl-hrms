# ZohoConnection encrypts its access/refresh tokens at rest, which requires
# ActiveRecord::Encryption keys. By default Rails reads those from encrypted
# credentials, which needs config/master.key — and that file is deliberately
# not deployed to servers. Without keys the very first read or write of a
# connection raises, so Mail dies on a deployed box while working locally.
#
# Keys therefore come from the environment when present, falling back to
# credentials so local development (which does have master.key) is unchanged.
#
# Generate a set with:  bin/rails db:encryption:init
Rails.application.configure do
  primary = ENV["ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY"].presence
  deterministic = ENV["ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY"].presence
  salt = ENV["ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT"].presence

  if primary && deterministic && salt
    config.active_record.encryption.primary_key = primary
    config.active_record.encryption.deterministic_key = deterministic
    config.active_record.encryption.key_derivation_salt = salt
  elsif Rails.env.production?
    # Fail loudly at boot rather than at the first mailbox request: a
    # half-configured production box would otherwise look healthy until
    # someone opened Mail.
    configured_via_credentials = Rails.application.credentials.dig(:active_record_encryption, :primary_key).present?

    unless configured_via_credentials
      raise "ActiveRecord::Encryption is not configured. Set ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY, " \
            "ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY and ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT " \
            "(generate them with `bin/rails db:encryption:init`)."
    end
  end
end
