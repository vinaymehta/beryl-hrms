require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Cache assets for far-future expiry since they are all digest stamped.
  config.public_file_server.headers = { "cache-control" => "public, max-age=#{1.year.to_i}" }

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Store uploaded files on the local file system (see config/storage.yml for options).
  config.active_storage.service = :s3_compatible # real S3/R2, via S3_* env vars

  # Blob routes (used directly in <img src> for employee profile photos)
  # stream through Rails instead of 302-ing to a presigned storage URL.
  # That presigned URL is built from S3_ENDPOINT — storage as the SERVER
  # sees it — which on a deployed box is an address the browser cannot
  # reach, so photos silently failed to load.
  config.active_storage.resolve_model_to_route = :rails_storage_proxy

  # TLS is the default and has to be opted OUT of, not into: a deployment that
  # forgets to set this still gets the secure behaviour.
  #
  # FORCE_SSL=false is for a deployment that genuinely has no certificate yet —
  # notably a bare IP address, which Let's Encrypt will not issue a certificate
  # for at all. Leaving these two on in that situation does not merely fail to
  # help, it takes the site down: assume_ssl makes Rails believe the request
  # already arrived over TLS, so force_ssl marks every cookie Secure, and a
  # browser discards Secure cookies delivered over plain HTTP — meaning nobody
  # can log in, with nothing in the logs to say why.
  #
  # Set this back to true (or drop it) the moment a real certificate is in
  # front. The cookies themselves key off request.ssl? rather than this flag,
  # so they start protecting themselves as soon as TLS appears.
  ssl_terminated = ENV.fetch("FORCE_SSL", "true").downcase != "false"

  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  config.assume_ssl = ssl_terminated

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  config.force_ssl = ssl_terminated

  # Skip http-to-https redirect for the default health check endpoint.
  # config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)

  # Change to "debug" to log everything (including potentially personally-identifiable information!).
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Prevent health checks from clogging up the logs.
  config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Replace the default in-process memory cache store with a durable alternative.
  # config.cache_store = :mem_cache_store

  # Replace the default in-process and non-durable queuing backend for Active Job.
  # config.active_job.queue_adapter = :resque

  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Links generated in mailer templates (password reset, the candidate feedback
  # form) must point at the deployed FRONTEND, not at this API host and not at
  # the "example.com" scaffold placeholder this used to carry.
  # Resolved through FrontendOrigins, which REFUSES to fall back to localhost in
  # production — a password-reset link pointing at the recipient's own machine
  # is worse than a boot failure that names exactly what is missing.
  frontend_uri = FrontendOrigins.primary_uri
  config.action_mailer.default_url_options = {
    host: frontend_uri.host,
    port: frontend_uri.port,
    protocol: frontend_uri.scheme || "http"
  }.compact

  # Outgoing SMTP, wired to the SMTP_* variables .env.example has always
  # documented. This block was previously left commented at Rails' scaffold
  # default, so delivery_method fell back to SMTP on localhost:25 and nothing —
  # interview invitations, candidate feedback links, password resets — ever
  # left the box. Credentials come from ENV rather than encrypted credentials
  # to match how every other secret in this app is provisioned.
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.perform_deliveries = true
  # Deliberately loud. These are transactional mails a candidate is waiting on,
  # so a failure should surface as a retrying Sidekiq job rather than being
  # swallowed into a success the admin never questions.
  config.action_mailer.raise_delivery_errors = true
  config.action_mailer.smtp_settings = {
    address: ENV["SMTP_ADDRESS"].presence,
    port: ENV.fetch("SMTP_PORT", 587).to_i,
    user_name: ENV["SMTP_USERNAME"].presence,
    password: ENV["SMTP_PASSWORD"].presence,
    authentication: :plain,
    enable_starttls_auto: true
  }.compact

  # Without a host, ActionMailer quietly falls back to localhost:25 — the exact
  # silent failure this block exists to end. Say so once, at boot, rather than
  # letting it be discovered through candidates who never got their email.
  config.after_initialize do
    if ENV["SMTP_ADDRESS"].blank?
      Rails.logger.warn("[mail] SMTP_ADDRESS is not set — outgoing mail WILL fail. Set SMTP_ADDRESS/PORT/USERNAME/PASSWORD.")
    end
    if ENV["MAIL_FROM"].blank?
      Rails.logger.warn("[mail] MAIL_FROM is not set — mail will be sent from no-reply@localhost and is likely to be rejected.")
    end
  end

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Only use :id for inspections in production.
  config.active_record.attributes_for_inspect = [ :id ]

  # Enable DNS rebinding protection and other `Host` header attacks.
  # config.hosts = [
  #   "example.com",     # Allow requests from example.com
  #   /.*\.example\.com/ # Allow requests from subdomains like `www.example.com`
  # ]
  #
  # Skip DNS rebinding protection for the default health check endpoint.
  # config.host_authorization = { exclude: ->(request) { request.path == "/up" } }
end
