require_relative "boot"
# Plain require, not autoload: config/environments/production.rb reads this at
# boot, before the autoload paths exist.
require_relative "../lib/frontend_origins"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Backend
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # API-only mode strips ActionDispatch::Cookies by default. Auth here is
    # cookie-based (HttpOnly session cookie + a readable double-submit CSRF
    # cookie), so it's added back explicitly. This app never uses Rails'
    # server-side `session` hash (the auth concern renders JSON 401s instead
    # of the generator's default redirect-based flow), so the full
    # ActionDispatch::Session::CookieStore middleware is intentionally not
    # re-added — only raw signed/encrypted cookie access is needed.
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use Rack::Attack

    # NOTE: CSRF protection is hand-rolled (double-submit cookie/header, see
    # CsrfProtection concern) rather than ActionController::RequestForgeryProtection,
    # which targets ActionController::Base's session/view-rendering flow. The
    # concern includes its own Origin-header check directly — Rails'
    # `forgery_protection_origin_check` setting would be a no-op here since
    # that module is never included.

    # All timestamps stored and reasoned about in UTC; company/user-local
    # display formatting happens in the frontend.
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc

    # Every background job goes through ActiveJob (never raw Sidekiq::Worker)
    # so acts_as_tenant's automatic tenant serialize/restore across job
    # boundaries applies uniformly — see config/initializers/acts_as_tenant.rb.
    config.active_job.queue_adapter = :sidekiq
  end
end
