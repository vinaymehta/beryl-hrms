# This file is copied to spec/ when you run 'rails generate rspec:install'
require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
# Prevent database truncation if the environment is production
abort("The Rails environment is running in production mode!") if Rails.env.production?
# Uncomment the line below in case you have `--require rails_helper` in the `.rspec` file
# that will avoid rails generators crashing because migrations haven't been run yet
# return unless Rails.env.test?
require 'rspec/rails'
# Add additional requires below this line. Rails is not loaded until this point!

# rswag-specs 2.17.0's main entrypoint (lib/rswag/specs.rb) never requires
# its own formatter file, even though `rake rswag:specs:swaggerize` passes
# `--format Rswag::Specs::SwaggerFormatter` — without this, that constant
# resolution fails with NameError regardless of --require ordering. A real
# gap in the gem, not a config issue; drop this once a newer rswag-specs
# fixes it upstream.
require 'rswag/specs/swagger_formatter'

# Requires supporting ruby files with custom matchers and macros, etc, in
# spec/support/ and its subdirectories. Files matching `spec/**/*_spec.rb` are
# run as spec files by default. This means that files in spec/support that end
# in _spec.rb will both be required and run as specs, causing the specs to be
# run twice. It is recommended that you do not name files matching this glob to
# end with _spec.rb. You can configure this pattern with the --pattern
# option on the command line or in ~/.rspec, .rspec or `.rspec-local`.
#
# The following line is provided for convenience purposes. It has the downside
# of increasing the boot-up time by auto-requiring all files in the support
# directory. Alternatively, in the individual `*_spec.rb` files, manually
# require only the support files necessary.
#
# Rails.root.glob('spec/support/**/*.rb').sort_by(&:to_s).each { |f| require f }

# Ensures that the test database schema matches the current schema file.
# If there are pending migrations it will invoke `db:test:prepare` to
# recreate the test database by loading the schema.
# If you are not using ActiveRecord, you can remove these lines.
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end
RSpec.configure do |config|
  # Remove this line if you're not using ActiveRecord or ActiveRecord fixtures
  config.fixture_paths = [
    Rails.root.join('spec/fixtures')
  ]

  # If you're not using ActiveRecord, or you'd prefer not to run each of your
  # examples within a transaction, remove the following line or assign false
  # instead of true.
  config.use_transactional_fixtures = true

  # You can uncomment this line to turn off ActiveRecord support entirely.
  # config.use_active_record = false

  # RSpec Rails uses metadata to mix in different behaviours to your tests,
  # for example enabling you to call `get` and `post` in request specs. e.g.:
  #
  #     RSpec.describe UsersController, type: :request do
  #       # ...
  #     end
  #
  # The different available types are documented in the features, such as in
  # https://rspec.info/features/8-0/rspec-rails
  #
  # You can also infer these behaviours automatically by location, e.g.
  # /spec/models would pull in the same behaviour as `type: :model` but this
  # behaviour is considered legacy and will be removed in a future version.
  #
  config.infer_spec_type_from_file_location!

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!
  # arbitrary gems may also be filtered via:
  # config.filter_gems_from_backtrace("gem name")

  config.include FactoryBot::Syntax::Methods

  # Rack::Attack throttles by IP, and every request spec comes from 127.0.0.1,
  # so its counter is shared by the WHOLE suite: a spec file that legitimately
  # makes a few hundred requests would push later, unrelated files past the
  # 300/5min limit and fail them with 429s — nondeterministically, since it
  # depends on file order. Resetting between examples keeps Rack::Attack wired
  # up while making each example independent.
  # (config/initializers/rack_attack.rb keeps a MemoryStore in test so this
  # never touches the dev server's Redis.)
  config.before { Rack::Attack.cache.store.clear if Rack::Attack.cache.store.respond_to?(:clear) }

  # ActiveSupport::CurrentAttributes normally resets on real request/job
  # boundaries — model/policy specs that set Current.session directly have
  # no such boundary, so reset explicitly to avoid leaking into the next example.
  config.after { Current.reset }

  # Seed the global permission catalog once for the whole suite (outside any
  # example's transaction, so it persists across all of them) — mirrors
  # every real environment, which always has this seeded before a company
  # can register. Without it, e.g. Roles::SeedDefaults' "admin" => :all
  # resolves to zero permissions.
  config.before(:suite) do
    Permissions::Catalog.each_definition do |key:, resource:, action:|
      Permission.find_or_create_by!(key: key) { |p| p.resource = resource; p.action = action }
    end
  end
end

Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
