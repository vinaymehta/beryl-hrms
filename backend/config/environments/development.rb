require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Make code changes take effect immediately without server restart.
  config.enable_reloading = true

  # Do not eager load code on boot.
  config.eager_load = false

  # Show full error reports.
  config.consider_all_requests_local = true

  # Enable server timing.
  config.server_timing = true

  # Enable/disable Action Controller caching. By default Action Controller caching is disabled.
  # Run rails dev:cache to toggle Action Controller caching.
  if Rails.root.join("tmp/caching-dev.txt").exist?
    config.public_file_server.headers = { "cache-control" => "public, max-age=#{2.days.to_i}" }
  else
    config.action_controller.perform_caching = false
  end

  # Change to :null_store to avoid any caching.
  config.cache_store = :memory_store

  # Store uploaded files on the local file system (see config/storage.yml for options).
  config.active_storage.service = :s3_compatible # MinIO or S3-compatible, via S3_* env vars

  # Blob routes (used directly in <img src> for employee profile photos)
  # stream through Rails instead of 302-ing to a presigned storage URL.
  # That presigned URL is built from S3_ENDPOINT — storage as the SERVER
  # sees it — which on a deployed box is an address the browser cannot
  # reach, so photos silently failed to load.
  config.active_storage.resolve_model_to_route = :rails_storage_proxy

  # Outgoing mail. Three modes, in precedence order:
  #
  #   MAIL_TRANSPORT=zoho  — the Zoho Mail API, through the OAuth connection
  #                          the app already holds. No SMTP credentials needed.
  #   SMTP_ADDRESS set     — ordinary SMTP.
  #   neither              — letter_opener, which has been in the Gemfile's
  #                          development group all along but was never actually
  #                          wired up, so it never ran.
  #
  # Neither used to apply. This block was a bare `raise_delivery_errors = false`,
  # which left delivery_method at Rails' scaffold default of localhost:25 with
  # enable_starttls_auto. On a machine running Postfix with a self-signed
  # certificate that fails in the worst possible way: Ruby verifies the cert,
  # rejects it ("certificate verify failed (hostname mismatch)"), and drops the
  # connection after EHLO — before MAIL FROM. So the message was never
  # submitted, never queued, and, because errors were swallowed, the job
  # reported success. Mail simply evaporated, silently, for every invitation,
  # password reset, interview invite and candidate feedback link.
  if ENV.fetch("MAIL_TRANSPORT", nil) == "zoho"
    # Out through the Zoho mailbox the app is already connected to — the same
    # OAuth connection the Mail feature reads and sends with. No second set of
    # credentials to provision. See Zoho::MailDelivery.
    config.action_mailer.delivery_method = :zoho
    config.action_mailer.raise_delivery_errors = true
  elsif ENV["SMTP_ADDRESS"].present?
    config.action_mailer.delivery_method = :smtp
    config.action_mailer.smtp_settings = {
      address: ENV["SMTP_ADDRESS"],
      port: ENV.fetch("SMTP_PORT", 587).to_i,
      user_name: ENV["SMTP_USERNAME"].presence,
      password: ENV["SMTP_PASSWORD"].presence,
      authentication: :plain,
      enable_starttls_auto: true
    }.compact
    # Loud, like production. A swallowed delivery error is what made the last
    # failure take a mail-log dig to find; here it surfaces as a failed job.
    config.action_mailer.raise_delivery_errors = true
  else
    config.action_mailer.delivery_method = :letter_opener
    config.action_mailer.raise_delivery_errors = false
  end
  config.action_mailer.perform_deliveries = true

  # Say which mode is active at boot, so "did that email go anywhere?" is
  # answered by the startup log rather than by reading /var/log/mail.log.
  config.after_initialize do
    Rails.logger.info("[mail] development delivery_method = #{ActionMailer::Base.delivery_method}")
  end

  # Make template changes take effect immediately.
  config.action_mailer.perform_caching = false

  # Links in mailer templates (invitations, password resets) are built from
  # FRONTEND_ORIGINS when it is set, falling back to localhost:3000 for pure
  # local runs where the recipient is also on the same machine.
  #
  # To send real mails whose links actually work, set FRONTEND_ORIGINS in .env
  # to the address the recipient's browser can reach — e.g. your ngrok URL:
  #   FRONTEND_ORIGINS=https://your-tunnel.ngrok-free.app
  frontend_uri = FrontendOrigins.primary_uri
  config.action_mailer.default_url_options = {
    host: frontend_uri.host,
    port: frontend_uri.port,
    protocol: frontend_uri.scheme || "http"
  }.compact

  # Print deprecation notices to the Rails logger.
  config.active_support.deprecation = :log

  # Raise an error on page load if there are pending migrations.
  config.active_record.migration_error = :page_load

  # Highlight code that triggered database queries in logs.
  config.active_record.verbose_query_logs = true

  # Append comments with runtime information tags to SQL queries in logs.
  config.active_record.query_log_tags_enabled = true

  # Highlight code that enqueued background job in logs.
  config.active_job.verbose_enqueue_logs = true

  # Highlight code that triggered redirect in logs.
  config.action_dispatch.verbose_redirect_logs = true

  # Raises error for missing translations.
  # config.i18n.raise_on_missing_translations = true

  # Annotate rendered view with file names.
  config.action_view.annotate_rendered_view_with_filenames = true

  # Uncomment if you wish to allow Action Cable access from any origin.
  # config.action_cable.disable_request_forgery_protection = true

  # Raise error when a before_action's only/except options reference missing actions.
  config.action_controller.raise_on_missing_callback_actions = true

  # Apply autocorrection by RuboCop to files generated by `bin/rails generate`.
  # config.generators.apply_rubocop_autocorrect_after_generate!

  # Host Authorization only permits localhost in development, which blocks
  # tunnelled testing outright: Calendly's OAuth callback and its webhooks both
  # arrive on the tunnel's hostname, not localhost, and Rails rejects them
  # before they reach a controller.
  #
  # Regexes rather than fixed hosts because free tunnel URLs change on every
  # restart — pinning one would mean editing this file each time.
  config.hosts << /.*\.ngrok-free\.dev\z/
  config.hosts << /.*\.ngrok-free\.app\z/
  config.hosts << /.*\.ngrok\.io\z/
  config.hosts << /.*\.trycloudflare\.com\z/

  # Escape hatch for any other tunnel/host, comma-separated:
  #   DEV_ALLOWED_HOSTS=my-host.example.com,another.example.com
  ENV.fetch("DEV_ALLOWED_HOSTS", "").split(",").map(&:strip).reject(&:empty?).each do |allowed|
    config.hosts << allowed
  end
end
